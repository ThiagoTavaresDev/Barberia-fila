import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  limit,
} from "firebase/firestore";

import { db } from "../firebase";

const queueCollection = collection(db, "queue");
const servicesCollection = collection(db, "services");

// 🛠️ GERENCIAMENTO DE SERVIÇOS

// Adicionar serviço
export async function addService(name, duration) {
  await addDoc(servicesCollection, {
    name,
    duration: parseInt(duration),
  });
}

// Remover serviço
export async function removeService(id) {
  await deleteDoc(doc(db, "services", id));
}

// Listener de serviços
export function listenServices(callback) {
  const q = query(servicesCollection, orderBy("name"));

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    callback(list);
  });
}

// 👥 GERENCIAMENTO DE FILA

// Obter a próxima ordem disponível
async function getNextOrder() {
  const q = query(queueCollection, orderBy("order", "desc"), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return 1;
  return (snapshot.docs[0].data().order || 0) + 1;
}

// Adicionar cliente
export async function addClient(clientData) {
  const joinedAt = Date.now();
  const order = await getNextOrder();

  const docRef = await addDoc(queueCollection, {
    name: clientData.name,
    phone: clientData.phone,
    serviceName: clientData.serviceName,
    serviceDuration: parseInt(clientData.serviceDuration),
    joinedAt,
    order,
    status: "waiting",
  });

  return { id: docRef.id };
}

// Remover cliente
export async function removeClient(id) {
  await deleteDoc(doc(db, "queue", id));
}

// Mover cliente na fila (trocar ordem)
export async function moveClient(client, direction, queue) {
  const currentIndex = queue.findIndex((c) => c.id === client.id);
  if (currentIndex === -1) return;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  // Verificar limites
  if (targetIndex < 0 || targetIndex >= queue.length) return;

  const targetClient = queue[targetIndex];

  // Trocar os valores de 'order'
  // Se por acaso eles tiverem a mesma ordem (legado), ajusta.
  let clientOrder = client.order || 0;
  let targetOrder = targetClient.order || 0;

  if (clientOrder === targetOrder) {
    clientOrder = currentIndex + 1;
    targetOrder = targetIndex + 1;
  }

  await updateDoc(doc(db, "queue", client.id), { order: targetOrder });
  await updateDoc(doc(db, "queue", targetClient.id), { order: clientOrder });
}

// Finalizar atendimento (marcar o 1º da fila como done)
export async function completeFirst(queue) {
  if (queue.length === 0) return;

  const first = queue[0];

  await updateDoc(doc(db, "queue", first.id), {
    status: "done",
  });
}

// Listener em tempo real da fila
export function listenQueue(callback) {
  // Ordenar por 'order' e depois por 'joinedAt' como fallback
  const q = query(queueCollection, orderBy("order", "asc"));

  return onSnapshot(q, (snapshot) => {
    const list = [];

    snapshot.forEach((docItem) => {
      const data = docItem.data();
      if (data.status === "waiting") {
        list.push({ id: docItem.id, ...data });
      }
    });

    // Fallback de ordenação no cliente se 'order' for null em registros antigos
    list.sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.joinedAt - b.joinedAt;
    });

    callback(list);
  });
}
