// Testa a geração do código Pix (BR Code) e a validação das chaves.
//
//   node --no-warnings scripts/test-pix.mjs
//
// Sai com código 1 se algum caso falhar.
import {
  buildPixPayload, crc16, formatBRL, formatPixAmount, guessPixKeyType, isPixReady, isValidCnpj,
  isValidCpf, normalizePixKey, parseMoneyInput, pixTxid, sanitizePixCity, sanitizePixName,
} from "../src/utils/pix.js";

let pass = 0;
const failures = [];
const eq = (name, actual, expected) => {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) pass++; else failures.push(`${name}: esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  console.log(`  ${same ? "✓" : "✗"} ${name}${same ? "" : `  -> ${JSON.stringify(actual)}`}`);
};
const section = (t) => console.log(`\n${t}`);

// Lê o código como lista de campos TLV (id, tamanho de 2 dígitos, valor). Falha se o tamanho não bater.
function parseTlv(text) {
  const out = {};
  let i = 0;
  while (i < text.length) {
    const id = text.slice(i, i + 2);
    const len = Number(text.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len) || i + 4 + len > text.length) throw new Error(`TLV quebrado em ${i}`);
    out[id] = text.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}
const crcOk = (payload) => crc16(payload.slice(0, -4)) === payload.slice(-4);

// ============================================================
section("1. Exemplo oficial do Banco Central (Manual de Padrões do Pix)");
const BCB = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
eq("CRC16 do exemplo oficial = 1D3D", crc16(BCB.slice(0, -4)), "1D3D");
eq("CRC do exemplo bate com o final do código", crcOk(BCB), true);
// O mesmo código, gerado pelo nosso montador, sem o campo 01 e com o texto exatamente como no manual
const sameAsManual = buildPixPayload({ key: "123e4567-e12b-12d1-a456-426655440000", name: "FULANO DE TAL", city: "BRASILIA", txid: "***", initiation: null });
eq("montador reproduz o exemplo do manual (nome em maiúsculas)", sameAsManual, BCB.replace("Fulano de Tal", "FULANO DE TAL").slice(0, -4) + crc16(BCB.replace("Fulano de Tal", "FULANO DE TAL").slice(0, -4)));

section("2. Estrutura do código gerado");
const key = "123e4567-e12b-12d1-a456-426655440000";
const p = buildPixPayload({ key, name: "Barbearia do Zé", city: "São Paulo", amount: 40, txid: pixTxid("AbC123xyz456QwErTy78"), description: "Fila Carlos" });
const top = parseTlv(p);
const account = parseTlv(top["26"]);
eq("CRC válido", crcOk(p), true);
eq("termina em 6304 + 4 hex", /6304[0-9A-F]{4}$/.test(p), true);
eq("formato do payload (00)", top["00"], "01");
eq("QR reutilizável (01)", top["01"], "11");
eq("GUI br.gov.bcb.pix", account["00"], "br.gov.bcb.pix");
eq("chave dentro do 26/01", account["01"], key);
eq("mensagem ao recebedor (26/02)", account["02"], "FILA CARLOS");
eq("categoria 0000", top["52"], "0000");
eq("moeda BRL (986)", top["53"], "986");
eq("valor 40.00", top["54"], "40.00");
eq("país BR", top["58"], "BR");
eq("nome sem acento e em maiúsculas", top["59"], "BARBEARIA DO ZE");
eq("cidade sem acento e em maiúsculas", top["60"], "SAO PAULO");
eq("txid dentro do 62/05", parseTlv(top["62"])["05"], "BFAbC123xyz456QwErTy78");
eq("campo 26 com até 99 caracteres", top["26"].length <= 99, true);

section("3. Valor: sempre o do serviço (nunca fixo)");
for (const [amount, expected] of [[40, "40.00"], [37.5, "37.50"], [5, "5.00"], [25.5, "25.50"], [0.1 + 0.2, "0.30"], [1234.5, "1234.50"], [19.999, "20.00"]]) {
  const code = buildPixPayload({ key, name: "A", city: "B", amount });
  eq(`R$ ${amount} -> campo 54 = ${expected}`, parseTlv(code)["54"], expected);
  eq(`  CRC válido (R$ ${amount})`, crcOk(code), true);
}
eq("sem valor: campo 54 não existe", parseTlv(buildPixPayload({ key, name: "A", city: "B" }))["54"], undefined);
eq("valor 0: campo 54 não existe", parseTlv(buildPixPayload({ key, name: "A", city: "B", amount: 0 }))["54"], undefined);
eq("valor negativo: campo 54 não existe", parseTlv(buildPixPayload({ key, name: "A", city: "B", amount: -5 }))["54"], undefined);
eq("formatPixAmount(NaN) vazio", formatPixAmount(NaN), "");
eq("códigos de valores diferentes são diferentes", buildPixPayload({ key, name: "A", city: "B", amount: 40 }) !== buildPixPayload({ key, name: "A", city: "B", amount: 45 }), true);

section("4. Mensagem ao recebedor só entra se couber no campo 26");
const emailKey = `${"a".repeat(62)}@exemplo.com.br`; // 77 caracteres: o máximo da chave Pix
const longP = buildPixPayload({ key: emailKey, name: "A", city: "B", amount: 10, description: "Fila Carlos" });
eq("chave longa: sem campo 26/02", parseTlv(parseTlv(longP)["26"])["02"], undefined);
eq("chave longa: campo 26 com exatamente 99", parseTlv(longP)["26"].length, 99);
eq("chave grande demais não gera código", (() => { try { buildPixPayload({ key: "a".repeat(78), name: "A", city: "B" }); return "gerou"; } catch { return "erro"; } })(), "erro");
eq("sem chave não gera código", (() => { try { buildPixPayload({ key: "", name: "A", city: "B" }); return "gerou"; } catch { return "erro"; } })(), "erro");
eq("chave longa: CRC válido", crcOk(longP), true);

section("5. Nome, cidade e txid");
eq("nome com acento/símbolos", sanitizePixName("  João & Filhos — Barbearia!  "), "JOAO FILHOS BARBEARIA");
eq("nome limitado a 25", sanitizePixName("Barbearia Grande Nome Muito Comprido Mesmo").length <= 25, true);
eq("nome vazio vira RECEBEDOR", sanitizePixName("!!!"), "RECEBEDOR");
eq("cidade limitada a 15", sanitizePixCity("São José dos Campos do Sul"), "SAO JOSE DOS CA");
eq("cidade vazia vira BRASIL", sanitizePixCity(""), "BRASIL");
eq("txid de ID do Firestore", pixTxid("AbC123xyz456QwErTy78"), "BFAbC123xyz456QwErTy78");
eq("txid sem ID vira ***", pixTxid(""), "***");
eq("txid nunca passa de 25", pixTxid("x".repeat(40)).length, 25);
eq("txid inválido no montador vira ***", parseTlv(parseTlv(buildPixPayload({ key, name: "A", city: "B", txid: "tem espaço" }))["62"])["05"], "***");

section("6. CPF");
eq("CPF válido (com máscara)", isValidCpf("529.982.247-25"), true);
eq("CPF válido (só números)", isValidCpf("52998224725"), true);
eq("CPF com dígito verificador errado", isValidCpf("52998224724"), false);
eq("CPF com todos os dígitos iguais", isValidCpf("11111111111"), false);
eq("CPF curto", isValidCpf("1234567"), false);
eq("normaliza CPF para só números", normalizePixKey("cpf", "529.982.247-25"), { valid: true, key: "52998224725", message: "" });
eq("CPF inválido tem mensagem clara", normalizePixKey("cpf", "123").message, "CPF inválido. Confira os 11 números.");

section("7. CNPJ (numérico e alfanumérico de 2026)");
eq("CNPJ numérico válido", isValidCnpj("11.222.333/0001-81"), true);
eq("CNPJ numérico sem máscara", isValidCnpj("11222333000181"), true);
eq("CNPJ alfanumérico oficial (Receita): 12.ABC.345/01DE-35", isValidCnpj("12.ABC.345/01DE-35"), true);
eq("CNPJ alfanumérico em minúsculas", isValidCnpj("12abc34501de35"), true);
eq("CNPJ com dígito errado", isValidCnpj("11222333000182"), false);
eq("CNPJ alfanumérico com dígito errado", isValidCnpj("12ABC34501DE36"), false);
eq("CNPJ com dígitos verificadores em letra", isValidCnpj("12ABC34501DEAB"), false);
eq("CNPJ com todos os caracteres iguais", isValidCnpj("00000000000000"), false);
eq("normaliza CNPJ", normalizePixKey("cnpj", "12.abc.345/01de-35").key, "12ABC34501DE35");
eq("CNPJ inválido tem mensagem clara", normalizePixKey("cnpj", "1").message, "CNPJ inválido. Confira os 14 caracteres.");

section("8. Celular, e-mail e chave aleatória");
eq("celular com máscara vira +55...", normalizePixKey("phone", "(11) 98877-6655"), { valid: true, key: "+5511988776655", message: "" });
eq("celular com +55 já digitado", normalizePixKey("phone", "+55 11 98877-6655").key, "+5511988776655");
eq("celular sem o 9", normalizePixKey("phone", "(11) 88877-6655").valid, false);
eq("celular com DDD inexistente", normalizePixKey("phone", "(00) 98877-6655").valid, false);
eq("celular incompleto", normalizePixKey("phone", "11988").valid, false);
eq("e-mail válido vira minúsculo", normalizePixKey("email", "  Barbeiro@Exemplo.com.BR "), { valid: true, key: "barbeiro@exemplo.com.br", message: "" });
eq("e-mail sem @", normalizePixKey("email", "barbeiro.exemplo.com").valid, false);
eq("e-mail sem domínio", normalizePixKey("email", "barbeiro@").valid, false);
eq("e-mail com mais de 77 caracteres", normalizePixKey("email", `${"a".repeat(70)}@exemplo.com`).valid, false);
eq("chave aleatória válida", normalizePixKey("random", "123E4567-E12B-12D1-A456-426655440000").key, "123e4567-e12b-12d1-a456-426655440000");
eq("chave aleatória incompleta", normalizePixKey("random", "123e4567-e12b").valid, false);
eq("chave vazia", normalizePixKey("cpf", "   ").message, "Informe a chave Pix.");
eq("tipo desconhecido", normalizePixKey("boleto", "x").valid, false);
eq("adivinha e-mail", guessPixKeyType("a@b.com"), "email");
eq("adivinha chave aleatória", guessPixKeyType("123e4567-e12b-12d1-a456-426655440000"), "random");
eq("não adivinha número (CPF x celular)", guessPixKeyType("11988776655"), null);

section("9. Dinheiro");
eq("formatBRL(40)", formatBRL(40).replace(/\s/g, " "), "R$ 40,00");
eq("formatBRL(37.5)", formatBRL(37.5).replace(/\s/g, " "), "R$ 37,50");
eq("formatBRL(inválido) = R$ 0,00", formatBRL(undefined).replace(/\s/g, " "), "R$ 0,00");
eq("parseMoneyInput('40')", parseMoneyInput("40"), 40);
eq("parseMoneyInput('40,5')", parseMoneyInput("40,5"), 40.5);
eq("parseMoneyInput('R$ 1.234,50')", parseMoneyInput("R$ 1.234,50"), 1234.5);
eq("parseMoneyInput('37.5')", parseMoneyInput("37.5"), 37.5);
eq("parseMoneyInput('abc')", Number.isNaN(parseMoneyInput("abc")), true);
eq("parseMoneyInput('')", Number.isNaN(parseMoneyInput("")), true);

section("10. Config pronta");
const cfg = { enabled: true, keyType: "cpf", key: "52998224725", receiverName: "BARBEARIA", city: "RECIFE" };
eq("config completa", isPixReady(cfg), true);
eq("config desativada", isPixReady({ ...cfg, enabled: false }), false);
eq("config sem chave", isPixReady({ ...cfg, key: "" }), false);
eq("sem config", isPixReady(null), false);

console.log(`\n${pass} casos conferidos, ${failures.length} falha(s).`);
if (failures.length) failures.forEach((f) => console.log("  - " + f));
process.exit(failures.length ? 1 : 0);
