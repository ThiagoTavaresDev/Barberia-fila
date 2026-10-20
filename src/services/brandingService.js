import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// Identidade visual pública da barbearia (tema, logo, nome, instagram).
// Fica em users/{id}/public/branding: legível por qualquer cliente que abra o
// link de fila/check-in, mas só o dono escreve (ver firestore.rules).

const brandingRef = (userId) => doc(db, "users", userId, "public", "branding");

const cacheKey = (userId) => `branding:${userId}`;

export function readCachedBranding(userId) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheBranding(userId, data) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(data));
  } catch {
    // storage cheio ou bloqueado: o cache é só para evitar o "flash" do tema padrão
  }
}

export async function getBranding(userId) {
  const snap = await getDoc(brandingRef(userId));
  const data = snap.exists() ? snap.data() : {};
  cacheBranding(userId, data);
  return data;
}

export function listenBranding(userId, onData, onError) {
  return onSnapshot(
    brandingRef(userId),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      cacheBranding(userId, data);
      onData(data);
    },
    onError
  );
}

export async function saveBranding(userId, partial) {
  await setDoc(brandingRef(userId), { ...partial, updatedAt: Date.now() }, { merge: true });
}
