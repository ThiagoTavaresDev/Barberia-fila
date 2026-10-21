// Teste de integração do Pix: roda o código REAL dos serviços (queueService + pixService)
// contra as regras REAIS do Firestore, no emulador. Cobre check-in, comprovante, conferência,
// finalizar, cancelar (devolvido/crédito), desfazer e os erros de permissão.
//
//   npx firebase-tools emulators:exec --only firestore --project demo-barber \
//     "node scripts/test-pix-flow.mjs"
//
// Os serviços são empacotados com esbuild trocando só o arquivo de conexão (src/firebase.js)
// por um que usa o Firestore do teste; o resto do código é o mesmo do app.
import { build } from "esbuild";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

const root = fileURLToPath(new URL("..", import.meta.url));
// O pacote gerado fica dentro de node_modules (ignorado pelo git) para enxergar o mesmo "firebase" do teste
const outDir = join(root, "node_modules", ".cache", "pix-flow");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "services.mjs");

await build({
  stdin: {
    contents: `
      export * from "./src/services/queueService.js";
      export * from "./src/services/pixService.js";
      export { __setDb } from "firebase-stub";`,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external", // firebase e demais pacotes ficam de fora: mesma instância do teste
  outfile: outFile,
  logLevel: "error",
  plugins: [{
    name: "firebase-stub",
    setup(b) {
      b.onResolve({ filter: /^firebase-stub$/ }, () => ({ path: "firebase-stub", namespace: "stub" }));
      b.onResolve({ filter: /^(\.\.?\/)+firebase$/ }, () => ({ path: "firebase-stub", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "export let db = null; export const auth = {}; export const __setDb = (x) => { db = x; };",
        loader: "js",
      }));
    },
  }],
});

globalThis.window = { location: { origin: "https://app.test" } };
const svc = await import(pathToFileURL(outFile).href);

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const testEnv = await initializeTestEnvironment({
  projectId: "demo-barber",
  firestore: { rules: readFileSync(join(root, "firestore.rules"), "utf8"), host, port: Number(port) },
});

const A = "barberA";
const TOKEN = "abc123.0123456789abcdef0123456789abcdef";
const now = Date.now();
const PHONE = "(11) 98877-6655";
const PHONE_DOC = "11988776655";
const JPEG = "data:image/jpeg;base64," + "A".repeat(2000);

// quem executa cada chamada: anônimo (cliente) ou dono (barbeiro)
const as = {
  client: () => svc.__setDb(testEnv.unauthenticatedContext().firestore()),
  owner: () => svc.__setDb(testEnv.authenticatedContext(A).firestore()),
};
// withSecurityRulesDisabled descarta o retorno do callback: guardamos o resultado numa variável
const admin = async (fn) => {
  let result;
  await testEnv.withSecurityRulesDisabled(async (ctx) => { result = await fn(ctx.firestore()); });
  return result;
};
const read = (...path) => admin(async (db) => { const s = await getDoc(doc(db, ...path)); return s.exists() ? s.data() : null; });

let pass = 0;
const failures = [];
const check = (name, actual, expected) => {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) pass++; else failures.push(`${name}: esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  console.log(`  ${same ? "✓" : "✗"} ${name}${same ? "" : `  -> ${JSON.stringify(actual)}`}`);
};
const checkTrue = (name, cond) => check(name, !!cond, true);
const denies = async (name, fn) => {
  try { await assertFails(fn()); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { failures.push(`${name} (deveria ser negado): ${String(e.message).split("\n")[0]}`); console.log(`  ✗ ${name}  <- DEVERIA SER NEGADO`); }
};
// erro de validação do próprio app (não vem do Firestore) com a mensagem esperada
const throwsMsg = async (name, fn, text) => {
  try { await fn(); failures.push(`${name} (deveria lançar erro)`); console.log(`  ✗ ${name}  <- DEVERIA LANÇAR ERRO`); }
  catch (e) {
    const okMsg = String(e.message).includes(text);
    if (okMsg) pass++; else failures.push(`${name}: mensagem inesperada: ${e.message}`);
    console.log(`  ${okMsg ? "✓" : "✗"} ${name}`);
  }
};
const works = async (name, fn) => {
  try { const r = await assertSucceeds(fn()); pass++; console.log(`  ✓ ${name}`); return r; }
  catch (e) { failures.push(`${name} (deveria passar): ${String(e.message).split("\n")[0]}`); console.log(`  ✗ ${name}  <- DEVERIA PASSAR`); return undefined; }
};
const section = (t) => console.log(`\n${t}`);

async function seed() {
  await testEnv.clearFirestore();
  await admin(async (db) => {
    await setDoc(doc(db, "users", A), { shopName: "Barbearia A", checkinLink: { token: TOKEN, linkId: "abc123", createdAt: now, validityHours: 8, expiresAt: now + 3600000 } });
    await setDoc(doc(db, "users", A, "services", "svc1"), { name: "Corte Navalhado", duration: 30, price: 40 });
    await setDoc(doc(db, "users", A, "services", "svc2"), { name: "Barba", duration: 20, price: 25.5 });
  });
}

const svc1 = { serviceId: "svc1", serviceName: "Corte Navalhado", serviceDuration: 30, servicePrice: 40 };
const svc2 = { serviceId: "svc2", serviceName: "Barba", serviceDuration: 20, servicePrice: 25.5 };
const person = (name, over = {}) => ({ name, phone: PHONE, ...svc1, ...over });

// Entra pelo check-in (cliente anônimo com o token do link) e devolve { id, key }
async function checkin(name, over = {}) { as.client(); return svc.addClient(A, person(name, over), TOKEN); }
const queueDoc = (id) => read("users", A, "queue", id);
const payDoc = (id, key) => read("users", A, "payments", `${id}_${key}`);
const receiptDoc = (id, key) => read("users", A, "payment_receipts", `${id}_${key}`);
const credit = async () => (await read("users", A, "clients", PHONE_DOC))?.creditBalance ?? 0;
const queueEntry = async (id) => ({ id, ...(await queueDoc(id)) });
const activePayment = async (id, key) => ({ id: `${id}_${key}`, ...(await payDoc(id, key)) });

// ============================================================
section("1. Entrada na fila (check-in e painel)");
await seed();
const c1 = await works("check-in do cliente cria a entrada", () => checkin("Carlos"));
const q1 = await queueDoc(c1.id);
check("entrada tem serviceId e preço do serviço", [q1.serviceId, q1.servicePrice, q1.status], ["svc1", 40, "waiting"]);
checkTrue("token do check-in não fica na fila pública", !("checkinToken" in q1));
check("chave secreta criada junto (32 hex)", /^[0-9a-f]{32}$/.test((await read("users", A, "client_keys", c1.id)).key), true);
check("addClient devolve a mesma chave que ficou salva", c1.key, (await read("users", A, "client_keys", c1.id)).key);
await denies("check-in com preço adulterado é negado", async () => { as.client(); return svc.addClient(A, person("Esperto", { servicePrice: 1 }), TOKEN); });
await denies("check-in sem serviceId é negado", async () => { as.client(); return svc.addClient(A, person("Antigo", { serviceId: undefined }), TOKEN); });
await denies("check-in com token errado é negado", async () => { as.client(); return svc.addClient(A, person("Intruso"), "abc123.errado"); });
await works("barbeiro adiciona cliente (com materiais)", async () => { as.owner(); return svc.addClient(A, person("Joao", { materials: [{ productId: "p1", quantity: 1 }] })); });
// addClient grava o perfil sem esperar (fire-and-forget): aguarda um pouco antes de conferir
let crm = null;
for (let i = 0; i < 20 && !crm?.name; i++) { await new Promise((r) => setTimeout(r, 100)); crm = await read("users", A, "clients", PHONE_DOC); }
check("perfil do cliente (CRM) é criado ao adicionar pelo painel", crm?.name, "Joao");

// ============================================================
section("2. Config do Pix");
as.owner();
await works("barbeiro salva a config", () => svc.savePixConfig(A, { enabled: true, keyType: "random", key: "123e4567-e12b-12d1-a456-426655440000", receiverName: "BARBEARIA DO ZE", city: "SAO PAULO", whatsapp: "5511988776655", policyText: "Aviso" }));
as.client();
const cfg = await works("cliente lê a config (pública)", () => svc.getPixConfig(A));
check("config lida", [cfg?.enabled, cfg?.key, cfg?.receiverName], [true, "123e4567-e12b-12d1-a456-426655440000", "BARBEARIA DO ZE"]);
await denies("cliente não grava a config", async () => { as.client(); return svc.savePixConfig(A, { enabled: true, keyType: "random", key: "123e4567-e12b-12d1-a456-426655440000", receiverName: "X", city: "Y" }); });
await denies("config inválida é negada pelas regras (nome longo)", async () => { as.owner(); return svc.savePixConfig(A, { enabled: true, keyType: "cpf", key: "52998224725", receiverName: "x".repeat(40), city: "Y" }); });

// ============================================================
section("3. Cliente paga e envia o comprovante");
await seed();
const k = await checkin("Carlos");
await works("cliente envia o comprovante", async () => { as.client(); return svc.submitReceipt(A, k.id, k.key, JPEG); });
const p1 = await payDoc(k.id, k.key);
check("pagamento nasce 'receipt_sent', origem client, sem valor", [p1.status, p1.source, p1.receivedAmount], ["receipt_sent", "client", undefined]);
checkTrue("comprovante guardado", (await receiptDoc(k.id, k.key)).image === JPEG);
await denies("2º envio enquanto em análise é negado", async () => { as.client(); return svc.submitReceipt(A, k.id, k.key, JPEG); });
await denies("envio com a chave errada é negado", async () => { as.client(); return svc.submitReceipt(A, k.id, "f".repeat(32), JPEG); });
await denies("cliente não confirma o próprio pagamento", async () => { as.client(); return svc.confirmPayment(A, { id: `${k.id}_${k.key}` }, 40); });
await denies("cliente não lê o comprovante", async () => { as.client(); return svc.getReceipt(A, `${k.id}_${k.key}`); });
as.client();
const seen = await new Promise((resolve) => { const off = svc.listenPayment(A, `${k.id}_${k.key}`, (p) => { off(); resolve(p); }, () => resolve("erro")); });
check("cliente acompanha o próprio pagamento em tempo real", seen?.status, "receipt_sent");
as.owner();
const list = await new Promise((resolve) => { const off = svc.listenPayments(A, (l) => { off(); resolve(l); }, () => resolve("erro")); });
check("barbeiro lista os pagamentos ativos", list.map((p) => [p.clientId, p.status]), [[k.id, "receipt_sent"]]);
check("barbeiro abre o comprovante", await svc.getReceipt(A, `${k.id}_${k.key}`), JPEG);

// ============================================================
section("4. Recusar e reenviar");
as.owner();
await svc.rejectPayment(A, { id: `${k.id}_${k.key}` });
check("recusado", (await payDoc(k.id, k.key)).status, "rejected");
await works("cliente reenvia um comprovante novo", async () => { as.client(); await new Promise((r) => setTimeout(r, 5)); return svc.submitReceipt(A, k.id, k.key, JPEG + "B", { resend: true }); });
check("volta a 'receipt_sent' com a imagem nova", [(await payDoc(k.id, k.key)).status, (await receiptDoc(k.id, k.key)).image === JPEG + "B"], ["receipt_sent", true]);

// ============================================================
section("5. Confirmar, finalizar e desfazer");
as.owner();
await svc.confirmPayment(A, { id: `${k.id}_${k.key}` }, 40);
check("confirmado com o valor recebido", [(await payDoc(k.id, k.key)).status, (await payDoc(k.id, k.key)).receivedAmount], ["confirmed", 40]);
const entry = await queueEntry(k.id);
const confirmed = await activePayment(k.id, k.key);
await works("finaliza com Pix (lote: fila + pagamento + comprovante)", async () => { as.owner(); return svc.completeFirst(A, [entry], "pix", { payment: confirmed, creditDelta: 0 }); });
const done = await queueDoc(k.id);
check("fila: concluído, Pix, valor adiantado e ID do pagamento", [done.status, done.paymentMethod, done.prepaidAmount, done.paymentId], ["done", "pix", 40, `${k.id}_${k.key}`]);
check("pagamento virou 'used'", (await payDoc(k.id, k.key)).status, "used");
check("comprovante apagado depois de usado", await receiptDoc(k.id, k.key), null);
const profile = await read("users", A, "clients", PHONE_DOC);
check("perfil do cliente (CRM) é criado ao finalizar", [profile?.totalVisits, profile?.name, profile?.lastService], [1, "Carlos", "Corte Navalhado"]);
await works("desfazer conclusão", async () => { as.owner(); return svc.undoComplete(A, k.id); });
const undone = await queueDoc(k.id);
check("volta para a fila sem os campos do Pix", [undone.status, undone.prepaidAmount, undone.paymentId, undone.completedAt], ["waiting", undefined, undefined, null]);
check("pagamento volta a 'confirmed'", (await payDoc(k.id, k.key)).status, "confirmed");

// ============================================================
section("6. Pagou e não veio: devolvido");
await seed();
const r = await checkin("Rita");
as.client(); await svc.submitReceipt(A, r.id, r.key, JPEG);
as.owner(); await svc.confirmPayment(A, { id: `${r.id}_${r.key}` }, 40);
await throwsMsg("cancelar sem escolher o destino do valor é recusado", async () => { as.owner(); return svc.cancelClient(A, r.id, { payment: await activePayment(r.id, r.key), outcome: undefined, amount: 40, phone: PHONE }); }, "Escolha o que fazer");
check("nada mudou depois da recusa", (await queueDoc(r.id)).status, "waiting");
await works("cancela como devolvido", async () => { as.owner(); return svc.cancelClient(A, r.id, { payment: await activePayment(r.id, r.key), outcome: "refunded", amount: 40, phone: PHONE }); });
const rq = await queueDoc(r.id);
check("fila: cancelado, resolução e valor", [rq.status, rq.paymentResolution, rq.prepaidAmount], ["cancelled", "refunded", 40]);
check("pagamento 'refunded'", (await payDoc(r.id, r.key)).status, "refunded");
check("comprovante apagado", await receiptDoc(r.id, r.key), null);
check("devolvido não gera crédito", await credit(), 0);
as.client();
const afterRefund = await new Promise((resolve) => { const off = svc.listenPayment(A, `${r.id}_${r.key}`, (p) => { off(); resolve(p); }, () => resolve("erro")); });
check("cliente vê 'refunded' e o valor (tela 'Seu Pix foi devolvido')", [afterRefund?.status, afterRefund?.receivedAmount], ["refunded", 40]);

// ============================================================
section("7. Pagou e não veio: crédito, e uso do crédito");
await seed();
const t = await checkin("Tiago");
as.client(); await svc.submitReceipt(A, t.id, t.key, JPEG);
as.owner(); await svc.confirmPayment(A, { id: `${t.id}_${t.key}` }, 40);
await throwsMsg("crédito sem telefone é recusado", async () => { as.owner(); return svc.cancelClient(A, t.id, { payment: await activePayment(t.id, t.key), outcome: "credit", amount: 40, phone: "" }); }, "Cliente sem telefone");
await works("cancela e guarda como crédito", async () => { as.owner(); return svc.cancelClient(A, t.id, { payment: await activePayment(t.id, t.key), outcome: "credit", amount: 40, phone: PHONE }); });
check("pagamento 'credit' e saldo do cliente", [(await payDoc(t.id, t.key)).status, await credit()], ["credit", 40]);
as.owner();
check("getClientCredit lê o saldo", await svc.getClientCredit(A, PHONE), 40);
const t2 = await checkin("Tiago de novo", svc2);
const t2e = await queueEntry(t2.id);
await works("próximo atendimento (R$ 25,50) usa o crédito (R$ 40)", async () => { as.owner(); return svc.completeFirst(A, [t2e], "money", { payment: null, creditDelta: -25.5 }); });
const t2d = await queueDoc(t2.id);
check("fila: crédito usado registrado", [t2d.status, t2d.creditUsed], ["done", 25.5]);
check("saldo restante = R$ 14,50", Math.round((await credit()) * 100) / 100, 14.5);
await works("desfazer devolve o crédito ao saldo", async () => { as.owner(); return svc.undoComplete(A, t2.id); });
check("saldo volta a R$ 40", Math.round((await credit()) * 100) / 100, 40);

// ============================================================
section("8. Pagou a mais: a sobra vira crédito");
await seed();
const m = await checkin("Marta", svc2); // serviço de R$ 25,50
as.client(); await svc.submitReceipt(A, m.id, m.key, JPEG);
as.owner(); await svc.confirmPayment(A, { id: `${m.id}_${m.key}` }, 30);
const me = await queueEntry(m.id);
await works("finaliza: pagou 30 de 25,50, sobra 4,50 como crédito", async () => { as.owner(); return svc.completeFirst(A, [me], "pix", { payment: await activePayment(m.id, m.key), creditDelta: 4.5 }); });
check("fila: valor adiantado e crédito gerado", [(await queueDoc(m.id)).prepaidAmount, (await queueDoc(m.id)).creditAdded], [30, 4.5]);
check("saldo = R$ 4,50", Math.round((await credit()) * 100) / 100, 4.5);
await works("desfazer remove a sobra do saldo", async () => { as.owner(); return svc.undoComplete(A, m.id); });
check("saldo volta a 0", Math.round((await credit()) * 100) / 100, 0);

// ============================================================
section("9. Comprovante sem conferir e Pix manual");
await seed();
const u = await checkin("Ursula");
as.client(); await svc.submitReceipt(A, u.id, u.key, JPEG);
await works("cancela sem conferir: comprovante descartado", async () => { as.owner(); return svc.cancelClient(A, u.id, { payment: await activePayment(u.id, u.key), outcome: null, amount: 0, phone: PHONE }); });
check("pagamento 'dismissed', sem resolução na fila", [(await payDoc(u.id, u.key)).status, (await queueDoc(u.id)).paymentResolution], ["dismissed", undefined]);
check("comprovante apagado", await receiptDoc(u.id, u.key), null);

const v = await checkin("Vera");
as.owner();
const manualId = await works("barbeiro registra Pix recebido sem comprovante", () => svc.markPixReceived(A, v.id, 40));
check("ID do pagamento manual usa a chave do cliente", manualId, `${v.id}_${v.key}`);
check("pagamento manual confirmado", [(await payDoc(v.id, v.key)).status, (await payDoc(v.id, v.key)).source, (await payDoc(v.id, v.key)).receivedAmount], ["confirmed", "manual", 40]);
as.client();
const manualSeen = await new Promise((resolve) => { const off = svc.listenPayment(A, `${v.id}_${v.key}`, (p) => { off(); resolve(p); }, () => resolve("erro")); });
check("o cliente vê 'confirmed' mesmo sem ter enviado comprovante", manualSeen?.status, "confirmed");

// entrada antiga (sem chave): o barbeiro gera a chave na hora de enviar o link
await admin((db) => setDoc(doc(db, "users", A, "queue", "legacy1"), { name: "Antigo", phone: PHONE, serviceName: "Corte", serviceDuration: 30, servicePrice: 40, joinedAt: now, order: 99, status: "waiting", materials: [] }));
as.owner();
const lk = await works("ensureClientKey cria a chave de uma entrada antiga", () => svc.ensureClientKey(A, "legacy1"));
check("chave criada e repetível", [/^[0-9a-f]{32}$/.test(lk), await svc.ensureClientKey(A, "legacy1")], [true, lk]);
check("link do cliente carrega a chave", svc.buildClientLink(A, "legacy1", lk), `https://app.test?client=legacy1&barber=${A}&k=${lk}`);

// ============================================================
section("10. Nota do cliente (única edição pública na fila)");
await seed();
const n = await checkin("Nina");
as.owner(); await svc.completeFirst(A, [await queueEntry(n.id)], "money");
await works("cliente avalia o atendimento", async () => { as.client(); return svc.submitRating(A, n.id, 5); });
check("nota gravada", (await queueDoc(n.id)).rating, 5);
await denies("segunda avaliação é negada", async () => { as.client(); return svc.submitRating(A, n.id, 1); });

console.log(`\n${pass} verificações, ${failures.length} falha(s).`);
if (failures.length) failures.forEach((f) => console.log("  - " + f));
await testEnv.cleanup();
process.exit(failures.length ? 1 : 0);
