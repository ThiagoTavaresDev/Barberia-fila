// Testa o firestore.rules no emulador do Firestore. Não toca no projeto real.
//
//   npx firebase-tools emulators:exec --only firestore --project demo-barber \
//     "node scripts/test-firestore-rules.mjs"
//
// O emulador precisa de Java 21+. Sai com código 1 se algum caso falhar.
//
// Cada caso roda sobre dados recriados do zero (nada vaza de um teste para o outro) e os
// casos "negado" são variações de UM atributo de um caso "permitido" do mesmo grupo, para
// garantir que a negação vem da regra que queremos testar e não de outro motivo.
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";

const [envHost, envPort] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const testEnv = await initializeTestEnvironment({
  projectId: "demo-barber",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: envHost, port: Number(envPort) },
});

const A = "barberA";
const B = "barberB";
const TOKEN = "abc123.0123456789abcdef0123456789abcdef";
const KEY = "0123456789abcdef0123456789abcdef"; // chave secreta (32 hex) de qWait
const PAY = `qWait_${KEY}`; // ID do pagamento de qWait
const now = Date.now();
const jpeg = (n) => "data:image/jpeg;base64," + "A".repeat(n);

// ---------- dados ----------
// chaves com valor undefined são omitidas (o SDK rejeita gravar undefined; aqui queremos "campo ausente")
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const entry = (over = {}) => clean({
  checkinToken: TOKEN, name: "Carlos", phone: "(11) 98877-6655", serviceId: "svc1",
  serviceName: "Corte Navalhado", serviceDuration: 30, servicePrice: 40, notes: "", photoUrl: "",
  materials: [], joinedAt: now, order: 5, status: "waiting", ...over,
});
const waiting = (over = {}) => {
  const { checkinToken, serviceId, ...rest } = entry({ order: 1, name: "Joao", ...over });
  return rest;
};
const payDoc = (over = {}) => clean({
  clientId: "qWait", status: "receipt_sent", source: "client", createdAt: now, receiptSentAt: now, updatedAt: now, ...over,
});
const receiptDoc = (over = {}) => clean({ image: jpeg(700000), createdAt: now, ...over });
const pixDoc = (over = {}) => clean({
  enabled: true, keyType: "random", key: "123e4567-e12b-12d1-a456-426655440000", receiverName: "BARBEARIA DO ZE",
  city: "SAO PAULO", whatsapp: "5511988776655", policyText: "Se não puder vir, avise a barbearia.", updatedAt: now, ...over,
});

// ---------- contextos ----------
const anon = () => testEnv.unauthenticatedContext().firestore();
const owner = () => testEnv.authenticatedContext(A).firestore();
const other = () => testEnv.authenticatedContext(B).firestore();

// Recria o banco (com as regras desligadas) no estado desejado
async function seed({ expired = false, payment = null } = {}) {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", A), {
      shopName: "Barbearia A",
      checkinLink: { token: TOKEN, linkId: "abc123", createdAt: now, validityHours: 1, expiresAt: expired ? now - 1000 : now + 3600000 },
    });
    await setDoc(doc(db, "users", B), { shopName: "Barbearia B" });
    await setDoc(doc(db, "users", A, "services", "svc1"), { name: "Corte Navalhado", duration: 30, price: 40 });
    await setDoc(doc(db, "users", A, "services", "svc2"), { name: "Barba", duration: 20, price: 25.5 });
    await setDoc(doc(db, "users", A, "services", "svcOld"), { name: "Legado", duration: "15", price: "30" });
    await setDoc(doc(db, "users", A, "queue", "qWait"), waiting());
    await setDoc(doc(db, "users", A, "queue", "qDone"), waiting({ status: "done", completedAt: now }));
    await setDoc(doc(db, "users", A, "queue", "qRated"), waiting({ status: "done", rating: 5, ratedAt: now }));
    await setDoc(doc(db, "users", A, "queue", "qLegacy"), waiting({ name: "Antigo", order: 2 })); // na fila, sem chave
    await setDoc(doc(db, "users", A, "queue", "barber_status_config"), { status: "available", updatedAt: now });
    await setDoc(doc(db, "users", A, "client_keys", "qWait"), { key: KEY, createdAt: now });
    await setDoc(doc(db, "users", A, "client_keys", "qDone"), { key: KEY, createdAt: now });
    await setDoc(doc(db, "users", A, "public", "checkin"), { linkId: "abc123", expiresAt: now + 3600000, shopName: "Barbearia A" });
    await setDoc(doc(db, "users", A, "clients", "11988776655"), { phone: "(11) 98877-6655", name: "Joao" });
    await setDoc(doc(db, "users", A, "products", "p1"), { name: "Pomada", quantity: 5 });
    await setDoc(doc(db, "users", A, "appointments", "ap1"), { name: "Maria" });
    if (payment) {
      await setDoc(doc(db, "users", A, "payments", PAY), payDoc({ status: payment }));
      await setDoc(doc(db, "users", A, "payment_receipts", PAY), receiptDoc());
    }
  });
}

// ---------- execução ----------
let pass = 0;
const failures = [];
let setup = () => seed();
const use = (fn) => { setup = fn; };
const must = (p) => assertSucceeds(p); // passo de preparo dentro de um caso: se falhar, o caso falha

const ok = async (name, fn) => {
  await setup();
  try { await assertSucceeds(fn()); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { failures.push(`${name} (deveria passar): ${String(e.message).split("\n")[0].slice(0, 160)}`); console.log(`  ✗ ${name}  <- DEVERIA PASSAR`); }
};
const denied = async (name, fn) => {
  await setup();
  try { await assertFails(fn()); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { failures.push(`${name} (deveria ser negado): ${String(e.message).split("\n")[0].slice(0, 160)}`); console.log(`  ✗ ${name}  <- DEVERIA SER NEGADO`); }
};
const section = (title, fn = () => seed()) => { console.log(`\n${title}`); use(fn); };

// operações reutilizadas
let idCounter = 0;
const checkin = (db, over = {}, keyDoc = { key: "fedcba9876543210fedcba9876543210", createdAt: now }) => {
  const id = `novo${++idCounter}`;
  const b = writeBatch(db);
  b.set(doc(db, "users", A, "queue", id), entry(over));
  if (keyDoc) b.set(doc(db, "users", A, "client_keys", id), keyDoc);
  return b.commit();
};
const sendReceipt = (db, { id = PAY, pay = payDoc(), receipt = receiptDoc() } = {}) => {
  const b = writeBatch(db);
  b.set(doc(db, "users", A, "payments", id), pay);
  b.set(doc(db, "users", A, "payment_receipts", id), receipt);
  return b.commit();
};
const resend = (db, payOver = {}, receipt = receiptDoc({ createdAt: now + 1 })) => {
  const b = writeBatch(db);
  b.update(doc(db, "users", A, "payments", PAY), { status: "receipt_sent", receiptSentAt: now + 1, updatedAt: now + 1, ...payOver });
  if (receipt) b.update(doc(db, "users", A, "payment_receipts", PAY), receipt);
  return b.commit();
};

// ============================================================
section("1. Regras legadas da raiz e documento do barbeiro");
await denied("raiz: ler /queue", () => getDoc(doc(anon(), "queue", "x")));
await denied("raiz: gravar em /queue", () => setDoc(doc(anon(), "queue", "x"), { a: 1 }));
await denied("raiz: gravar em /services", () => setDoc(doc(anon(), "services", "x"), { a: 1 }));
await denied("raiz: apagar em /appointments", () => deleteDoc(doc(anon(), "appointments", "x")));
await denied("público não lê o doc do barbeiro (tem o token secreto)", () => getDoc(doc(anon(), "users", A)));
await ok("dono lê o próprio doc", () => getDoc(doc(owner(), "users", A)));
await denied("outro barbeiro não lê o doc", () => getDoc(doc(other(), "users", A)));

section("2. Check-in: entrada na fila + chave secreta (mesmo lote)");
await ok("BASE: entrada válida (fila + chave)", () => checkin(anon()));
await ok("serviço com preço decimal (Barba R$ 25,50)", () => checkin(anon(), { serviceId: "svc2", serviceName: "Barba", serviceDuration: 20, servicePrice: 25.5 }));
await ok("serviço antigo com preço/duração em texto continua entrando", () => checkin(anon(), { serviceId: "svcOld", serviceName: "Legado", serviceDuration: 15, servicePrice: 30 }));
await denied("token errado", () => checkin(anon(), { checkinToken: "abc123.errado" }));
await denied("sem token", () => checkin(anon(), { checkinToken: undefined }));
await denied("preço adulterado (R$ 1 em vez de R$ 40)", () => checkin(anon(), { servicePrice: 1 }));
await denied("preço adulterado em serviço decimal", () => checkin(anon(), { serviceId: "svc2", serviceName: "Barba", serviceDuration: 20, servicePrice: 25 }));
await denied("duração adulterada", () => checkin(anon(), { serviceDuration: 1 }));
await denied("nome do serviço diferente do cadastro", () => checkin(anon(), { serviceName: "Corte de graça" }));
await denied("serviceId inexistente", () => checkin(anon(), { serviceId: "naoexiste" }));
await denied("sem serviceId (app antigo)", () => checkin(anon(), { serviceId: undefined }));
await denied("campo extra na entrada", () => checkin(anon(), { isAdmin: true }));
await denied("materials preenchido (mexeria no estoque)", () => checkin(anon(), { materials: [{ productId: "p1", quantity: 999 }] }));
await denied("photoUrl preenchido", () => checkin(anon(), { photoUrl: "data:image/jpeg;base64,AAAA" }));
await denied("notes preenchido", () => checkin(anon(), { notes: "oi" }));
await denied("status diferente de waiting", () => checkin(anon(), { status: "done" }));
await denied("nome com mais de 40 caracteres", () => checkin(anon(), { name: "x".repeat(41) }));
await denied("order inválido (0)", () => checkin(anon(), { order: 0 }));
await denied("order que não é inteiro", () => checkin(anon(), { order: 1.5 }));
await denied("telefone com mais de 20 caracteres", () => checkin(anon(), { phone: "1".repeat(21) }));
await denied("chave com formato inválido", () => checkin(anon(), {}, { key: "curta", createdAt: now }));
await denied("chave em maiúsculas (fora de [0-9a-f])", () => checkin(anon(), {}, { key: "FEDCBA9876543210FEDCBA9876543210", createdAt: now }));
await denied("chave com campo extra", () => checkin(anon(), {}, { key: KEY, createdAt: now, extra: 1 }));
await ok("entrada sem chave no lote é aceita (só não poderá pagar pelo app)", () => checkin(anon(), {}, null));
use(() => seed({ expired: true }));
await denied("link expirado", () => checkin(anon()));
use(() => seed());
await ok("dono cria entrada com qualquer campo (materials, foto, notas)", () => setDoc(doc(owner(), "users", A, "queue", "ownerAdded"), waiting({ materials: [{ productId: "p1", quantity: 1 }], photoUrl: "x", notes: "n", source: "manual" })));
await ok("dono cria entrada + chave no mesmo lote (adicionar cliente no painel)", () => {
  const db = owner(); const b = writeBatch(db);
  b.set(doc(db, "users", A, "queue", "ownerBatch"), waiting({ materials: [{ productId: "p1", quantity: 1 }] }));
  b.set(doc(db, "users", A, "client_keys", "ownerBatch"), { key: KEY, createdAt: now });
  return b.commit();
});
await denied("outro barbeiro não cria entrada na fila alheia", () => setDoc(doc(other(), "users", A, "queue", "x"), waiting()));

section("3. client_keys (chave secreta)");
await denied("chave sozinha para entrada que já existe (sequestro)", () => setDoc(doc(anon(), "users", A, "client_keys", "qLegacy"), { key: KEY, createdAt: now }));
await denied("chave sozinha para entrada que não existe", () => setDoc(doc(anon(), "users", A, "client_keys", "fantasma"), { key: KEY, createdAt: now }));
await denied("público não lê client_keys", () => getDoc(doc(anon(), "users", A, "client_keys", "qWait")));
await denied("público não lista client_keys", () => getDocs(collection(anon(), "users", A, "client_keys")));
await denied("outro barbeiro não lê client_keys", () => getDoc(doc(other(), "users", A, "client_keys", "qWait")));
await denied("público não altera a chave", () => updateDoc(doc(anon(), "users", A, "client_keys", "qWait"), { key: "fedcba9876543210fedcba9876543210" }));
await denied("público não apaga a chave", () => deleteDoc(doc(anon(), "users", A, "client_keys", "qWait")));
await ok("dono lê a chave", () => getDoc(doc(owner(), "users", A, "client_keys", "qWait")));
await ok("dono cria chave para entrada antiga (reenvio de link)", () => setDoc(doc(owner(), "users", A, "client_keys", "qLegacy"), { key: KEY, createdAt: now }));

section("4. Fila: edição pública restrita");
await ok("fila legível por todos (lista)", () => getDocs(collection(anon(), "users", A, "queue")));
await ok("documento da pausa do barbeiro legível", () => getDoc(doc(anon(), "users", A, "queue", "barber_status_config")));
await ok("BASE: nota 5 em atendimento concluído sem nota", () => updateDoc(doc(anon(), "users", A, "queue", "qDone"), { rating: 5, ratedAt: now }));
await denied("segunda nota na mesma entrada", () => updateDoc(doc(anon(), "users", A, "queue", "qRated"), { rating: 1, ratedAt: now }));
await denied("nota 9", () => updateDoc(doc(anon(), "users", A, "queue", "qDone"), { rating: 9, ratedAt: now }));
await denied("nota 0", () => updateDoc(doc(anon(), "users", A, "queue", "qDone"), { rating: 0, ratedAt: now }));
await denied("nota decimal", () => updateDoc(doc(anon(), "users", A, "queue", "qDone"), { rating: 4.5, ratedAt: now }));
await denied("nota junto com mudança de preço", () => updateDoc(doc(anon(), "users", A, "queue", "qDone"), { rating: 5, ratedAt: now, servicePrice: 0 }));
await denied("mudar preço de outra pessoa", () => updateDoc(doc(anon(), "users", A, "queue", "qWait"), { servicePrice: 0 }));
await denied("mudar status de outra pessoa", () => updateDoc(doc(anon(), "users", A, "queue", "qWait"), { status: "done" }));
await denied("mudar nome/telefone", () => updateDoc(doc(anon(), "users", A, "queue", "qWait"), { name: "Fulano", phone: "0" }));
await denied("colocar o barbeiro em pausa (doc de status)", () => updateDoc(doc(anon(), "users", A, "queue", "barber_status_config"), { status: "on_break" }));
await denied("apagar entrada da fila", () => deleteDoc(doc(anon(), "users", A, "queue", "qWait")));
await denied("outro barbeiro não edita a fila", () => updateDoc(doc(other(), "users", A, "queue", "qWait"), { status: "done" }));
await ok("dono edita e apaga entradas", async () => { await updateDoc(doc(owner(), "users", A, "queue", "qWait"), { status: "done" }); await deleteDoc(doc(owner(), "users", A, "queue", "qDone")); });
await ok("dono grava o status de pausa", () => setDoc(doc(owner(), "users", A, "queue", "barber_status_config"), { status: "on_break" }, { merge: true }));
await ok("limpeza do token logo após entrar", async () => {
  const db = anon(); const id = `novo${++idCounter}`; const b = writeBatch(db);
  b.set(doc(db, "users", A, "queue", id), entry());
  b.set(doc(db, "users", A, "client_keys", id), { key: KEY, createdAt: now });
  await must(b.commit());
  await updateDoc(doc(db, "users", A, "queue", id), { checkinToken: deleteField() });
});
await denied("recolocar um token numa entrada", async () => {
  const db = anon(); const id = `novo${++idCounter}`; const b = writeBatch(db);
  b.set(doc(db, "users", A, "queue", id), entry());
  b.set(doc(db, "users", A, "client_keys", id), { key: KEY, createdAt: now });
  await must(b.commit());
  await updateDoc(doc(db, "users", A, "queue", id), { checkinToken: "outro" });
});

section("5. Pagamentos por Pix: envio do 1º comprovante");
await ok("BASE: cliente envia o 1º comprovante (pagamento + imagem no lote)", () => sendReceipt(anon()));
await ok("qualquer pessoa com o ID (chave) envia, logada ou não", () => sendReceipt(other()));
await denied("chave errada no ID do pagamento", () => sendReceipt(anon(), { id: "qWait_ffffffffffffffffffffffffffffffff" }));
await denied("entrada antiga, sem chave cadastrada", () => sendReceipt(anon(), { id: "qLegacy_" + KEY, pay: payDoc({ clientId: "qLegacy" }) }));
await denied("cliente que já foi atendido (fora da fila)", () => sendReceipt(anon(), { id: "qDone_" + KEY, pay: payDoc({ clientId: "qDone" }) }));
await denied("clientId do documento diferente do ID", () => sendReceipt(anon(), { pay: payDoc({ clientId: "qLegacy" }) }));
await denied("status já confirmado", () => sendReceipt(anon(), { pay: payDoc({ status: "confirmed" }) }));
await denied("campo de valor enviado pelo cliente", () => sendReceipt(anon(), { pay: payDoc({ receivedAmount: 40 }) }));
await denied("campo expectedAmount enviado pelo cliente", () => sendReceipt(anon(), { pay: payDoc({ expectedAmount: 1 }) }));
await denied("source diferente de client", () => sendReceipt(anon(), { pay: payDoc({ source: "manual" }) }));
await denied("datas que não são números", () => sendReceipt(anon(), { pay: payDoc({ receiptSentAt: "hoje" }) }));
await denied("pagamento sem comprovante no lote", () => setDoc(doc(anon(), "users", A, "payments", PAY), payDoc()));
await denied("comprovante sem pagamento no lote", () => setDoc(doc(anon(), "users", A, "payment_receipts", PAY), receiptDoc()));
await ok("comprovante no limite de tamanho", () => sendReceipt(anon(), { receipt: receiptDoc({ image: jpeg(749000) }) }));
await denied("imagem grande demais", () => sendReceipt(anon(), { receipt: receiptDoc({ image: jpeg(760000) }) }));
await denied("imagem que não é JPEG (PNG)", () => sendReceipt(anon(), { receipt: receiptDoc({ image: "data:image/png;base64,AAAA" }) }));
await denied("imagem que é HTML", () => sendReceipt(anon(), { receipt: receiptDoc({ image: "data:text/html;base64,PHNjcmlwdD4=" }) }));
await denied("comprovante com campo extra", () => sendReceipt(anon(), { receipt: receiptDoc({ extra: 1 }) }));
await denied("comprovante sem imagem", () => sendReceipt(anon(), { receipt: { createdAt: now } }));

section("5b. Pagamentos por Pix: depois de enviado", () => seed({ payment: "receipt_sent" }));
await denied("2º envio com o pagamento ainda em análise", () => sendReceipt(anon()));
await ok("cliente lê o próprio pagamento pelo ID", () => getDoc(doc(anon(), "users", A, "payments", PAY)));
await denied("público não lista os pagamentos", () => getDocs(collection(anon(), "users", A, "payments")));
await denied("outro barbeiro não lista os pagamentos", () => getDocs(collection(other(), "users", A, "payments")));
await denied("cliente não confirma o próprio pagamento", () => updateDoc(doc(anon(), "users", A, "payments", PAY), { status: "confirmed" }));
await denied("cliente não apaga o pagamento", () => deleteDoc(doc(anon(), "users", A, "payments", PAY)));
await denied("público não lê o comprovante", () => getDoc(doc(anon(), "users", A, "payment_receipts", PAY)));
await denied("público não apaga o comprovante", () => deleteDoc(doc(anon(), "users", A, "payment_receipts", PAY)));
await denied("outro barbeiro não lê o comprovante", () => getDoc(doc(other(), "users", A, "payment_receipts", PAY)));
await ok("dono lista os pagamentos", () => getDocs(collection(owner(), "users", A, "payments")));
await ok("dono lê o comprovante", () => getDoc(doc(owner(), "users", A, "payment_receipts", PAY)));
await ok("dono confirma o pagamento (com valor recebido)", () => updateDoc(doc(owner(), "users", A, "payments", PAY), { status: "confirmed", receivedAmount: 40, confirmedAt: now }));
await ok("dono marca como recusado", () => updateDoc(doc(owner(), "users", A, "payments", PAY), { status: "rejected" }));
await ok("dono apaga o comprovante e o pagamento", async () => { await deleteDoc(doc(owner(), "users", A, "payment_receipts", PAY)); await deleteDoc(doc(owner(), "users", A, "payments", PAY)); });
await ok("dono finaliza em lote (fila + pagamento + comprovante + crédito)", () => {
  const db = owner(); const b = writeBatch(db);
  b.update(doc(db, "users", A, "queue", "qWait"), { status: "done", completedAt: now, paymentMethod: "pix", prepaidAmount: 40 });
  b.update(doc(db, "users", A, "payments", PAY), { status: "used" });
  b.delete(doc(db, "users", A, "payment_receipts", PAY));
  b.set(doc(db, "users", A, "clients", "11988776655"), { creditBalance: increment(-10), updatedAt: now }, { merge: true });
  return b.commit();
});
await ok("dono registra pagamento manual (sem comprovante)", () => setDoc(doc(owner(), "users", A, "payments", "qLegacy_manual"), { clientId: "qLegacy", status: "confirmed", source: "manual", receivedAmount: 40, createdAt: now, updatedAt: now }));

section("6. Reenvio depois de recusado", () => seed({ payment: "rejected" }));
await ok("BASE: reenvio de novo comprovante após 'rejected'", () => resend(anon()));
await denied("reenvio mudando outro campo (valor)", () => resend(anon(), { receivedAmount: 40 }));
await denied("reenvio sem trocar o comprovante", () => resend(anon(), {}, null));
await denied("reenvio com o mesmo comprovante (createdAt igual)", () => resend(anon(), {}, receiptDoc({ createdAt: now })));
await denied("reenvio com imagem inválida", () => resend(anon(), {}, receiptDoc({ image: "data:text/html;base64,AAAA", createdAt: now + 1 })));
await denied("reenvio com status que não é receipt_sent", () => resend(anon(), { status: "confirmed" }));
await denied("trocar só a imagem sem reabrir o pagamento", () => updateDoc(doc(anon(), "users", A, "payment_receipts", PAY), receiptDoc({ createdAt: now + 1 })));
await denied("reenvio quando o cliente já saiu da fila", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), "users", A, "queue", "qWait"), { status: "cancelled" }); });
  await resend(anon());
});
use(() => seed({ payment: "receipt_sent" }));
await denied("reenvio enquanto está em análise", () => resend(anon()));
use(() => seed({ payment: "confirmed" }));
await denied("reenvio depois de confirmado", () => resend(anon()));

section("7. Configuração do Pix (public/pix)");
await ok("BASE: dono grava config válida", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc()));
await ok("público lê a config", async () => { await must(setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc())); await getDoc(doc(anon(), "users", A, "public", "pix")); });
await ok("dono atualiza com merge", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ city: "RECIFE" }), { merge: true }));
await ok("dono desativa o Pix sem chave", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ enabled: false, key: "", receiverName: "", city: "" })));
await denied("ativar sem chave", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ key: "" })));
await denied("ativar sem nome", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ receiverName: "" })));
await denied("ativar sem cidade", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ city: "" })));
await denied("enabled que não é booleano", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ enabled: "sim" })));
await denied("tipo de chave desconhecido", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ keyType: "boleto" })));
await denied("chave com mais de 77 caracteres", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ key: "x".repeat(78) })));
await denied("nome com mais de 25 caracteres", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ receiverName: "x".repeat(26) })));
await denied("cidade com mais de 15 caracteres", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ city: "x".repeat(16) })));
await denied("aviso com mais de 300 caracteres", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ policyText: "x".repeat(301) })));
await denied("campo extra na config", () => setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc({ extra: "x" })));
await denied("público não grava a config", () => setDoc(doc(anon(), "users", A, "public", "pix"), pixDoc()));
await denied("outro barbeiro não grava a config", () => setDoc(doc(other(), "users", A, "public", "pix"), pixDoc()));
await ok("dono segue gravando os outros docs públicos (branding)", () => setDoc(doc(owner(), "users", A, "public", "branding"), { themeId: "claro-neutro" }, { merge: true }));
await denied("público não grava docs públicos", () => setDoc(doc(anon(), "users", A, "public", "branding"), { themeId: "x" }));
await ok("público lê o doc público do check-in", () => getDoc(doc(anon(), "users", A, "public", "checkin")));
await ok("dono apaga a config", async () => { await must(setDoc(doc(owner(), "users", A, "public", "pix"), pixDoc())); await deleteDoc(doc(owner(), "users", A, "public", "pix")); });
await denied("público não apaga a config", async () => { await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "users", A, "public", "pix"), pixDoc()); }); await deleteDoc(doc(anon(), "users", A, "public", "pix")); });

section("8. Demais coleções do barbeiro");
await ok("serviços: leitura pública", () => getDocs(collection(anon(), "users", A, "services")));
await denied("serviços: público não grava", () => setDoc(doc(anon(), "users", A, "services", "x"), { name: "x", price: 1, duration: 1 }));
await ok("serviços: dono grava", () => setDoc(doc(owner(), "users", A, "services", "x"), { name: "x", price: 1, duration: 1 }));
for (const col of ["clients", "products", "appointments", "expenses", "client_photos"]) {
  await denied(`${col}: público não lê`, () => getDocs(collection(anon(), "users", A, col)));
  await denied(`${col}: outro barbeiro não lê`, () => getDocs(collection(other(), "users", A, col)));
  await denied(`${col}: público não grava`, () => setDoc(doc(anon(), "users", A, col, "x"), { a: 1 }));
  await ok(`${col}: dono lê e grava`, async () => { await setDoc(doc(owner(), "users", A, col, "x"), { a: 1 }); await getDocs(collection(owner(), "users", A, col)); });
}
await denied("coleção desconhecida: nem o dono (o padrão é negar)", () => setDoc(doc(owner(), "users", A, "qualquercoisa", "x"), { a: 1 }));

// ============================================================
console.log(`\n${pass} casos conferidos, ${failures.length} falha(s).`);
if (failures.length) failures.forEach((f) => console.log("  - " + f));
await testEnv.cleanup();
process.exit(failures.length ? 1 : 0);
