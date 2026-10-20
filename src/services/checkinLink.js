import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

export const DEFAULT_VALIDITY_HOURS = 8;
export const MIN_VALIDITY_HOURS = 1;
export const MAX_VALIDITY_HOURS = 72;
export const WARNING_MINUTES = 30;

const randomHex = (bytes) => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const clampValidityHours = (hours) => {
  const n = Math.round(Number(hours));
  if (!Number.isFinite(n)) return DEFAULT_VALIDITY_HOURS;
  return Math.min(MAX_VALIDITY_HOURS, Math.max(MIN_VALIDITY_HOURS, n));
};

// Gera um novo link (invalidando o anterior). O token completo (linkId.segredo)
// fica só no doc privado do barbeiro; o doc público guarda apenas o linkId e a
// expiração para o cliente poder mostrar "link expirado" sem ver o segredo.
export async function generateCheckinLink(userId, hours, shopName = "") {
  const validityHours = clampValidityHours(hours);
  const createdAt = Date.now();
  const linkId = randomHex(6);
  const link = {
    token: `${linkId}.${randomHex(16)}`,
    linkId,
    createdAt,
    expiresAt: createdAt + validityHours * 60 * 60 * 1000,
    validityHours,
  };

  const batch = writeBatch(db);
  batch.update(doc(db, "users", userId), { checkinLink: link });
  batch.set(doc(db, "users", userId, "public", "checkin"), {
    linkId,
    expiresAt: link.expiresAt,
    shopName: shopName || "",
  });
  await batch.commit();

  return link;
}

export const buildCheckinUrl = (userId, token) =>
  `${window.location.origin}/checkin?barber=${userId}&t=${encodeURIComponent(token)}`;

export async function getPublicLinkInfo(barberId) {
  const snap = await getDoc(doc(db, "users", barberId, "public", "checkin"));
  return snap.exists() ? snap.data() : null;
}

export const isLinkValid = (info, token) => {
  if (!info || !token) return false;
  return token.split(".")[0] === info.linkId && Date.now() < info.expiresAt;
};

// Formata milissegundos restantes como "2h 15min" / "12 min"
export const formatTimeLeft = (ms) => {
  const totalMin = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
};
