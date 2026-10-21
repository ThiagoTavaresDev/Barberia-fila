// Testa as regras de senha forte da redefinição de senha.
//
//   node --no-warnings scripts/test-password.mjs
//
// Sai com código 1 se algum caso falhar.
import { evaluatePassword, maskEmail, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../src/utils/password.js";

let pass = 0;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) pass++; else failures.push(`${name} ${detail}`);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : `  ${detail}`}`);
};
const section = (t) => console.log(`\n${t}`);
const problemsOf = (pw, email = "") => evaluatePassword(pw, { email }).problems.join(" | ");

section("1. Senhas fortes são aceitas");
for (const pw of ["Zx9!vQ#4pLm", "Corte&Navalha77x", "Tz9!kQp#4mLw", "Vai-Chover_2026?Sim", "Çã0!Mmz9Wq", "aB3$eF7&hJ", "Marcos&Cabelo#58q"]) {
  const r = evaluatePassword(pw);
  check(`aceita "${pw}"`, r.strong, `(${r.problems.join(" | ") || r.checks.filter((c) => !c.ok).map((c) => c.id).join(",")})`);
}

section("2. Regras obrigatórias (uma por vez)");
{
  const only = (pw) => evaluatePassword(pw).checks.filter((c) => !c.ok).map((c) => c.id).join(",");
  check("curta demais (7 caracteres)", only("Zx9!vQ#") === "length", `veio ${only("Zx9!vQ#")}`);
  check("exatamente o mínimo (8) passa no tamanho", !only("Zx9!vQ#4").includes("length"));
  check("sem maiúscula", only("zx9!vq#4pl") === "upper", `veio ${only("zx9!vq#4pl")}`);
  check("sem minúscula", only("ZX9!VQ#4PL") === "lower", `veio ${only("ZX9!VQ#4PL")}`);
  check("sem número", only("Zxk!vQ#mpL") === "number", `veio ${only("Zxk!vQ#mpL")}`);
  check("sem símbolo", only("Zx9kvQ4pLm") === "symbol", `veio ${only("Zx9kvQ4pLm")}`);
  check("maiúscula acentuada conta (É)", !only("Édu9!vq#4p").includes("upper"));
  check("minúscula acentuada conta (ç)", !only("ZÇ9!VQ#4PçX").includes("lower"));
  check("espaço não conta como símbolo", only("Zx9 vQ4pLm").includes("symbol"));
  check("senha vazia não é forte", !evaluatePassword("").strong);
}

section("3. Senhas fracas conhecidas são recusadas");
for (const pw of ["senha123", "Senha@123", "12345678", "Abcdef1!", "Password1!", "P@ssw0rd!", "Qwerty@123", "Admin#2026a", "Brasil@2026", "Barbearia#2026", "Mudar@123x", "Teste@123Ab", "Flamengo#10", "Iloveyou1!"]) {
  check(`recusa "${pw}"`, !evaluatePassword(pw).strong);
}

section("4. Palavras comuns com letras trocadas por números");
check("P@ssw0rd é reconhecida como password", problemsOf("P@ssw0rd!A1").includes("palavras muito comuns"));
check("S3nh4 é reconhecida como senha", problemsOf("S3nh4#Zk9m").includes("palavras muito comuns"));
check("B4rb34r14 é reconhecida como barbearia", problemsOf("B4rb34r14!Zk9").includes("palavras muito comuns"));
check("palavra comum acentuada (Barbéaria)", problemsOf("Barbéaria#Zk9").includes("palavras muito comuns"));
check("palavra comum exata + números (Flamengo10!)", problemsOf("Flamengo10!").includes("palavras muito comuns"));
check("palavra parecida mas segura não é barrada (Navalha)", !problemsOf("Navalha#Zk9mP").includes("palavras muito comuns"));

section("5. E-mail dentro da senha");
check("usuário do e-mail na senha", problemsOf("Zebarbeiro#9Kq", "zebarbeiro@gmail.com").includes("e-mail"));
check("usuário com pontos (ze.barbeiro)", problemsOf("ZeBarbeiro#9Kq", "ze.barbeiro@gmail.com").includes("e-mail"));
check("maiúsculas e acentos não escapam (JOÃOSILVA)", problemsOf("JOÃOsilva#9Kq", "joaosilva@x.com").includes("e-mail"));
check("usuário curto (2 letras) não é barrado", !problemsOf("Ze#Kq9Wm2p", "ze@x.com").includes("e-mail"));
check("sem e-mail informado não barra", !problemsOf("Zebarbeiro#9Kq").includes("e-mail"));

section("6. Repetição e sequências");
check("aaa", problemsOf("Zaaa!9Kq#m").includes("repetir"));
check("111", problemsOf("Zk111!Wq#m").includes("repetir"));
check("dois iguais seguidos podem (aa)", !problemsOf("Zaa!9Kq#mP").includes("repetir"));
check("1234", problemsOf("Zk1234!Wq#").includes("sequências"));
check("4321 (decrescente)", problemsOf("Zk4321!Wq#").includes("sequências"));
check("abcd", problemsOf("Zabcd!9Kq#").includes("sequências"));
check("DCBA (maiúsculas, decrescente)", problemsOf("Zk!DCBA9q#m").includes("sequências"));
check("qwer (teclado)", problemsOf("Zk!qwer9Wm#").includes("sequências"));
check("rewq (teclado ao contrário)", problemsOf("Zk!rewq9Wm#").includes("sequências"));
check("asdf (teclado)", problemsOf("Zk!asdf9Wm#").includes("sequências"));
check("123 (só 3) pode", !problemsOf("Zk123!Wq#mP").includes("sequências"));
check("2026 não é sequência", !problemsOf("Zk2026!Wq#mP").includes("sequências"));
check("misturar sentido não conta (abcba)", !problemsOf("Zk!abcba9Wm#").includes("sequências"));

section("7. Espaços e tamanho máximo");
check("espaço no início", problemsOf(" Zx9!vQ#4pLm").includes("espaço"));
check("espaço no fim", problemsOf("Zx9!vQ#4pLm ").includes("espaço"));
check("espaço no meio é permitido (frase-senha)", evaluatePassword("Vou Cortar#2026 Zk").strong);
check(`mais de ${PASSWORD_MAX_LENGTH} caracteres`, problemsOf("Zx9!" + "kQp".repeat(50)).includes("no máximo"));
check(`mínimo configurado = ${PASSWORD_MIN_LENGTH}`, PASSWORD_MIN_LENGTH === 8);

section("8. Medidor de força");
check("vazia: nível 0", evaluatePassword("").score === 0);
check("curta: Fraca", evaluatePassword("abc").label === "Fraca");
check("tem tudo mas é comum: Razoável (não forte)", (() => { const r = evaluatePassword("Senha@1234"); return r.score === 2 && !r.strong; })());
check("forte com 11 caracteres: Forte", evaluatePassword("Zx9!vQ#4pLm").label === "Forte");
check("forte com 12+ caracteres: Muito forte", evaluatePassword("Zx9!vQ#4pLmW").label === "Muito forte");
check("só a força boa libera o envio (score >= 3 e forte)", evaluatePassword("Zx9!vQ#4pLm").strong && !evaluatePassword("Senha@1234").strong);

section("9. E-mail mascarado");
check("normal", maskEmail("zebarbeiro@gmail.com") === "z******o@gmail.com", maskEmail("zebarbeiro@gmail.com"));
check("local de 3 letras", maskEmail("abc@x.com") === "a*c@x.com", maskEmail("abc@x.com"));
check("local de 2 letras", maskEmail("ab@x.com") === "a*@x.com", maskEmail("ab@x.com"));
check("local de 1 letra", maskEmail("a@x.com") === "a*@x.com", maskEmail("a@x.com"));
check("não esconde o domínio", maskEmail("maria.silva@barbearia.com.br").endsWith("@barbearia.com.br"));
check("texto sem @ volta igual", maskEmail("abc") === "abc");

console.log(`\n${pass} casos conferidos, ${failures.length} falha(s).`);
failures.forEach((f) => console.log("  - " + f));
process.exit(failures.length ? 1 : 0);
