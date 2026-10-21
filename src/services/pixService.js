import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { ensureClientKey } from "./queueService";

// Pix adiantado. O valor cobrado é sempre o preço do serviço da entrada na fila: nenhum valor
// é gravado pelo cliente (o "recebido" é digitado pelo barbeiro depois de conferir o banco).
//
//   users/{uid}/public/pix                    configuração (leitura pública)
//   users/{uid}/payments/{clientId}_{chave}   pagamento; o ID carrega a chave secreta do cliente
//   users/{uid}/payment_receipts/{mesmo ID}   imagem do comprovante (só o dono lê)
//
// Estados: receipt_sent -> confirmed | rejected ; rejected -> receipt_sent ;
//          confirmed -> used | refunded | credit ; dismissed (descartado sem conferir)

export const DEFAULT_PIX_POLICY =
  "Se não puder vir, avise a barbearia: o valor pode ser devolvido ou ficar de crédito para o próximo atendimento.";

export const PAYMENT_ACTIVE_STATUSES = ["receipt_sent", "confirmed", "rejected"];

const configRef = (userId) => doc(db, "users", userId, "public", "pix");
const paymentRef = (userId, paymentId) => doc(db, "users", userId, "payments", paymentId);
const receiptRef = (userId, paymentId) => doc(db, "users", userId, "payment_receipts", paymentId);

export const paymentIdFor = (clientId, key) => `${clientId}_${key}`;

// ------------------------------------------------------------ configuração

export async function getPixConfig(userId) {
  const snap = await getDoc(configRef(userId));
  return snap.exists() ? snap.data() : null;
}

export function listenPixConfig(userId, onData, onError) {
  return onSnapshot(configRef(userId), (snap) => onData(snap.exists() ? snap.data() : null), onError);
}

// Grava o documento inteiro (sem merge): as regras conferem campos, tipos e tamanhos
export async function savePixConfig(userId, config) {
  await setDoc(configRef(userId), {
    enabled: !!config.enabled,
    keyType: config.keyType,
    key: config.key,
    receiverName: config.receiverName,
    city: config.city,
    whatsapp: config.whatsapp || "",
    policyText: config.policyText || "",
    updatedAt: Date.now(),
  });
}

// ------------------------------------------------------------ cliente

// O cliente acompanha o próprio pagamento (precisa do ID completo, que contém a chave dele)
export function listenPayment(userId, paymentId, onData, onError) {
  return onSnapshot(
    paymentRef(userId, paymentId),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

// Envia o comprovante (1ª vez) ou um comprovante novo depois de recusado; pagamento e imagem no mesmo lote
export async function submitReceipt(userId, clientId, key, image, { resend = false } = {}) {
  const paymentId = paymentIdFor(clientId, key);
  const now = Date.now();
  const batch = writeBatch(db);

  if (resend) {
    batch.update(paymentRef(userId, paymentId), { status: "receipt_sent", receiptSentAt: now, updatedAt: now });
    batch.update(receiptRef(userId, paymentId), { image, createdAt: now });
  } else {
    batch.set(paymentRef(userId, paymentId), {
      clientId, status: "receipt_sent", source: "client", createdAt: now, receiptSentAt: now, updatedAt: now,
    });
    batch.set(receiptRef(userId, paymentId), { image, createdAt: now });
  }
  await batch.commit();
}

// ------------------------------------------------------------ barbeiro

// Todos os pagamentos ativos (a conferir, confirmados, recusados)
export function listenPayments(userId, onData, onError) {
  const q = query(collection(db, "users", userId, "payments"), where("status", "in", PAYMENT_ACTIVE_STATUSES));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

export async function getReceipt(userId, paymentId) {
  const snap = await getDoc(receiptRef(userId, paymentId));
  return snap.exists() ? snap.data().image : null;
}

export async function confirmPayment(userId, payment, receivedAmount) {
  const now = Date.now();
  await updateDoc(paymentRef(userId, payment.id), {
    status: "confirmed", receivedAmount, confirmedAt: now, updatedAt: now,
  });
}

export async function rejectPayment(userId, payment) {
  await updateDoc(paymentRef(userId, payment.id), { status: "rejected", updatedAt: Date.now() });
}

// Cliente pagou mas não mandou comprovante: o barbeiro registra o Pix recebido
export async function markPixReceived(userId, clientId, receivedAmount) {
  const key = await ensureClientKey(userId, clientId);
  const paymentId = paymentIdFor(clientId, key);
  const now = Date.now();
  await setDoc(paymentRef(userId, paymentId), {
    clientId, status: "confirmed", source: "manual", receivedAmount, createdAt: now, confirmedAt: now, updatedAt: now,
  });
  return paymentId;
}

export async function deleteReceipt(userId, paymentId) {
  await deleteDoc(receiptRef(userId, paymentId));
}
