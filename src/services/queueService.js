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

// Helper para obter referências de coleção baseadas no userId
const getCollections = (userId) => {
  if (!userId) throw new Error("UserId is required for database operations");
  return {
    queue: collection(db, "users", userId, "queue"),
    services: collection(db, "users", userId, "services"),
    appointments: collection(db, "users", userId, "appointments")
  };
};

// 🛠️ GERENCIAMENTO DE SERVIÇOS

// Adicionar serviço
export async function addService(userId, name, duration, price) {
  const { services } = getCollections(userId);
  await addDoc(services, {
    name,
    duration: parseInt(duration),
    price: parseFloat(price) || 0,
  });
}

// Remover serviço
export async function removeService(userId, id) {
  await deleteDoc(doc(db, "users", userId, "services", id));
}

// Listener de serviços
export function listenServices(userId, callback) {
  if (!userId) return () => { };
  const { services } = getCollections(userId);
  const q = query(services, orderBy("name"));

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
async function getNextOrder(userId) {
  const { queue } = getCollections(userId);
  const q = query(queue, orderBy("order", "desc"), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return 1;
  return (snapshot.docs[0].data().order || 0) + 1;
}

// Adicionar cliente
export async function addClient(userId, clientData) {
  const { queue } = getCollections(userId);
  const joinedAt = Date.now();
  const order = await getNextOrder(userId);

  const docRef = await addDoc(queue, {
    name: clientData.name,
    phone: clientData.phone,
    serviceName: clientData.serviceName,
    serviceDuration: parseInt(clientData.serviceDuration),
    servicePrice: parseFloat(clientData.servicePrice) || 0,
    notes: clientData.notes || "",
    photoUrl: clientData.photoUrl || "",
    joinedAt,
    order,
    status: "waiting",
  });

  return { id: docRef.id };
}

// Remover cliente
export async function removeClient(userId, id) {
  await deleteDoc(doc(db, "users", userId, "queue", id));
}

// Mover cliente na fila (trocar ordem)
export async function moveClient(userId, client, direction, queueList) {
  const currentIndex = queueList.findIndex((c) => c.id === client.id);
  if (currentIndex === -1) return;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  // Verificar limites
  if (targetIndex < 0 || targetIndex >= queueList.length) return;

  const targetClient = queueList[targetIndex];

  // Trocar os valores de 'order'
  let clientOrder = client.order || 0;
  let targetOrder = targetClient.order || 0;

  if (clientOrder === targetOrder) {
    clientOrder = currentIndex + 1;
    targetOrder = targetIndex + 1;
  }

  await updateDoc(doc(db, "users", userId, "queue", client.id), { order: targetOrder });
  await updateDoc(doc(db, "users", userId, "queue", targetClient.id), { order: clientOrder });
}

// Finalizar atendimento
export async function completeFirst(userId, queueList) {
  if (queueList.length === 0) return;

  const first = queueList[0];

  await updateDoc(doc(db, "users", userId, "queue", first.id), {
    status: "done",
    completedAt: Date.now(),
  });
}

// Atualizar dados do cliente
export async function updateClient(userId, clientId, data) {
  await updateDoc(doc(db, "users", userId, "queue", clientId), data);
}

// Desfazer conclusão
export async function undoComplete(userId, clientId) {
  await updateDoc(doc(db, "users", userId, "queue", clientId), {
    status: "waiting",
    completedAt: null,
  });
}

// Listener em tempo real da fila
export function listenQueue(userId, callback) {
  if (!userId) return () => { };

  const { queue } = getCollections(userId);
  // Ordenar por 'order' e depois por 'joinedAt' como fallback
  const q = query(queue, orderBy("order", "asc"));

  return onSnapshot(q, (snapshot) => {
    const list = [];

    snapshot.forEach((docItem) => {
      const data = docItem.data();
      if (data.status === "waiting") {
        list.push({ id: docItem.id, ...data });
      }
    });

    // Fallback de ordenação
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
export async function getDailyHistory(userId) {
  if (!userId) return [];

  const { queue } = getCollections(userId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTimestamp = startOfDay.getTime();

  const q = query(queue, where("status", "==", "done"));
  const snapshot = await getDocs(q);

  const history = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    const completedAt = data.completedAt || data.joinedAt;
    if (completedAt >= startTimestamp) {
      history.push({ id: doc.id, ...data });
    }
  });

  history.sort((a, b) => (b.completedAt || b.joinedAt) - (a.completedAt || a.joinedAt));

  return history;
}

// Salvar avaliação
export async function submitRating(userId, clientId, rating) {
  await updateDoc(doc(db, "users", userId, "queue", clientId), {
    rating: parseInt(rating),
    ratedAt: Date.now(),
  });
}

// 📅 GERENCIAMENTO DE AGENDAMENTOS

// Adicionar agendamento
export async function addAppointment(userId, appointmentData) {
  const { appointments } = getCollections(userId);
  const docRef = await addDoc(appointments, {
    name: appointmentData.name,
    phone: appointmentData.phone || "",
    scheduledDate: appointmentData.scheduledDate,
    scheduledTime: appointmentData.scheduledTime,
    serviceName: appointmentData.serviceName || "",
    serviceDuration: parseInt(appointmentData.serviceDuration) || 0,
    servicePrice: parseFloat(appointmentData.servicePrice) || 0,
    status: "scheduled",
    createdAt: Date.now(),
  });

  return { id: docRef.id };
}

// Listener de agendamentos
export function listenAppointments(userId, callback) {
  if (!userId) return () => { };

  const { appointments } = getCollections(userId);
  const q = query(
    appointments,
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
export async function moveAppointmentToQueue(userId, appointment) {
  const { queue } = getCollections(userId);

  const order = await getNextOrder(userId);
  const docRef = await addDoc(queue, {
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
  await updateDoc(doc(db, "users", userId, "appointments", appointment.id), {
    status: "moved_to_queue",
    movedAt: Date.now(),
  });

  return { id: docRef.id };
}

// Cancelar agendamento
export async function cancelAppointment(userId, appointmentId) {
  await updateDoc(doc(db, "users", userId, "appointments", appointmentId), {
    status: "cancelled",
    cancelledAt: Date.now(),
  });
}

// Cancelar cliente da fila
export async function cancelClient(userId, clientId) {
  await updateDoc(doc(db, "users", userId, "queue", clientId), {
    status: "cancelled",
    cancelledAt: Date.now(),
  });
}

// Obter histórico completo
export async function getFullHistory(userId) {
  if (!userId) return [];
  const { queue, appointments } = getCollections(userId);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTimestamp = startOfDay.getTime();

  const history = [];

  try {
    const doneQuery = query(queue, where("status", "==", "done"));
    const doneSnapshot = await getDocs(doneQuery);
    doneSnapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.completedAt || data.joinedAt;
      if (timestamp >= startTimestamp) {
        history.push({ id: doc.id, ...data, type: "queue" });
      }
    });

    const cancelledQuery = query(queue, where("status", "==", "cancelled"));
    const cancelledSnapshot = await getDocs(cancelledQuery);
    cancelledSnapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.cancelledAt || data.joinedAt;
      if (timestamp >= startTimestamp) {
        history.push({ id: doc.id, ...data, type: "queue" });
      }
    });

    const appsQuery = query(appointments, where("status", "==", "cancelled"));
    const appsSnapshot = await getDocs(appsQuery);
    appsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.cancelledAt && data.cancelledAt >= startTimestamp) {
        history.push({ id: doc.id, ...data, type: "appointment" });
      }
    });

  } catch (error) {
    console.error("Error fetching history:", error);
  }

  history.sort((a, b) => {
    const timeA = a.completedAt || a.cancelledAt || a.joinedAt;
    const timeB = b.completedAt || b.cancelledAt || b.joinedAt;
    return timeB - timeA;
  });

  return history;
}

// 📊 ESTATÍSTICAS DO DASHBOARD
export async function getDashboardStats(userId) {
  if (!userId) return null;
  const { queue } = getCollections(userId);

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  startOfWeek.setHours(0, 0, 0, 0);

  try {
    const q = query(queue, where("status", "==", "done"));
    const snapshot = await getDocs(q);

    const stats = {
      today: { revenue: 0, clients: 0 },
      week: { revenue: 0, clients: 0 },
      month: { revenue: 0, clients: 0 },
      services: {},
      dailyRevenue: {},
    };

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR');
      stats.dailyRevenue[dateStr] = 0;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      const completedAt = data.completedAt || data.joinedAt;
      const price = parseFloat(data.servicePrice) || 0;
      const serviceName = data.serviceName || "Outros";

      if (completedAt < thirtyDaysAgo.getTime()) return;

      stats.month.revenue += price;
      stats.month.clients += 1;

      if (completedAt >= startOfWeek.getTime()) {
        stats.week.revenue += price;
        stats.week.clients += 1;
        const dateStr = new Date(completedAt).toLocaleDateString('pt-BR');
        if (stats.dailyRevenue[dateStr] !== undefined) {
          stats.dailyRevenue[dateStr] += price;
        }
      }

      if (completedAt >= startOfDay.getTime()) {
        stats.today.revenue += price;
        stats.today.clients += 1;
      }

      if (!stats.services[serviceName]) {
        stats.services[serviceName] = { count: 0, revenue: 0 };
      }
      stats.services[serviceName].count += 1;
      stats.services[serviceName].revenue += price;
    });

    return stats;
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return null;
  }
}
