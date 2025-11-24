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
  where,
} from "firebase/firestore";

import { db } from "../firebase";

const queueCollection = collection(db, "queue");
const servicesCollection = collection(db, "services");
const appointmentsCollection = collection(db, "appointments");

// 🛠️ GERENCIAMENTO DE SERVIÇOS

// Adicionar serviço
export async function addService(name, duration, price) {
  await addDoc(servicesCollection, {
    name,
    duration: parseInt(duration),
    price: parseFloat(price) || 0,
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
    servicePrice: parseFloat(clientData.servicePrice) || 0,
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
    completedAt: Date.now(),
  });
}

// Atualizar dados do cliente
export async function updateClient(clientId, data) {
  await updateDoc(doc(db, "queue", clientId), data);
}

// Desfazer conclusão (voltar para fila)
export async function undoComplete(clientId) {
  await updateDoc(doc(db, "queue", clientId), {
    status: "waiting",
    completedAt: null,
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

// Obter histórico do dia
export async function getDailyHistory() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTimestamp = startOfDay.getTime();

  // Pegar todos os atendimentos finalizados
  // (Para produção, ideal seria usar query composta com data, mas requer índice)
  const q = query(queueCollection, where("status", "==", "done"));
  const snapshot = await getDocs(q);

  const history = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Filtrar apenas os de hoje
    const completedAt = data.completedAt || data.joinedAt;
    if (completedAt >= startTimestamp) {
      history.push({ id: doc.id, ...data });
    }
  });

  // Ordenar do mais recente para o mais antigo
  history.sort((a, b) => (b.completedAt || b.joinedAt) - (a.completedAt || a.joinedAt));

  return history;
}

// Salvar avaliação do cliente
export async function submitRating(clientId, rating) {
  await updateDoc(doc(db, "queue", clientId), {
    rating: parseInt(rating),
    ratedAt: Date.now(),
  });
}

// 📅 GERENCIAMENTO DE AGENDAMENTOS

// Adicionar agendamento
export async function addAppointment(appointmentData) {
  const docRef = await addDoc(appointmentsCollection, {
    name: appointmentData.name,
    phone: appointmentData.phone || "",
    scheduledDate: appointmentData.scheduledDate, // timestamp
    scheduledTime: appointmentData.scheduledTime, // "14:30"
    serviceName: appointmentData.serviceName || "",
    serviceDuration: parseInt(appointmentData.serviceDuration) || 0,
    servicePrice: parseFloat(appointmentData.servicePrice) || 0,
    status: "scheduled",
    createdAt: Date.now(),
  });

  return { id: docRef.id };
}

// Listener de agendamentos
export function listenAppointments(callback) {
  const q = query(
    appointmentsCollection,
    where("status", "==", "scheduled"),
    orderBy("scheduledDate", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    callback(list);
  });
}

// Mover agendamento para fila ativa
export async function moveAppointmentToQueue(appointment) {
  // Adicionar à fila
  const order = await getNextOrder();
  const docRef = await addDoc(queueCollection, {
    name: appointment.name,
    phone: appointment.phone,
    serviceName: appointment.serviceName || "A definir",
    serviceDuration: appointment.serviceDuration || 30,
    servicePrice: appointment.servicePrice || 0,
    joinedAt: Date.now(),
    order,
    status: "waiting",
    source: "appointment",
    appointmentId: appointment.id,
  });

  // Atualizar status do agendamento
  await updateDoc(doc(db, "appointments", appointment.id), {
    status: "moved_to_queue",
    movedAt: Date.now(),
  });

  return { id: docRef.id };
}

// Cancelar agendamento
export async function cancelAppointment(appointmentId) {
  await updateDoc(doc(db, "appointments", appointmentId), {
    status: "cancelled",
    cancelledAt: Date.now(),
  });
}

// Cancelar cliente da fila
export async function cancelClient(clientId) {
  await updateDoc(doc(db, "queue", clientId), {
    status: "cancelled",
    cancelledAt: Date.now(),
  });
}

// Obter histórico completo (incluindo cancelados)
export async function getFullHistory() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTimestamp = startOfDay.getTime();

  const history = [];

  try {
    // Pegar clientes finalizados
    const doneQuery = query(
      queueCollection,
      where("status", "==", "done")
    );
    const doneSnapshot = await getDocs(doneQuery);

    doneSnapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.completedAt || data.joinedAt;
      if (timestamp >= startTimestamp) {
        history.push({ id: doc.id, ...data, type: "queue" });
      }
    });
  } catch (error) {
    console.error("Error fetching done clients:", error);
  }

  try {
    // Pegar clientes cancelados
    const cancelledQuery = query(
      queueCollection,
      where("status", "==", "cancelled")
    );
    const cancelledSnapshot = await getDocs(cancelledQuery);

    cancelledSnapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.cancelledAt || data.joinedAt;
      if (timestamp >= startTimestamp) {
        history.push({ id: doc.id, ...data, type: "queue" });
      }
    });
  } catch (error) {
    console.error("Error fetching cancelled clients:", error);
  }

  try {
    // Pegar agendamentos cancelados
    const appointmentsQuery = query(
      appointmentsCollection,
      where("status", "==", "cancelled")
    );
    const appointmentsSnapshot = await getDocs(appointmentsQuery);

    appointmentsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.cancelledAt && data.cancelledAt >= startTimestamp) {
        history.push({ id: doc.id, ...data, type: "appointment" });
      }
    });
  } catch (error) {
    console.error("Error fetching cancelled appointments:", error);
  }

  // Ordenar do mais recente para o mais antigo
  history.sort((a, b) => {
    const timeA = a.completedAt || a.cancelledAt || a.joinedAt;
    const timeB = b.completedAt || b.cancelledAt || b.joinedAt;
    return timeB - timeA;
  });

  return history;
}
