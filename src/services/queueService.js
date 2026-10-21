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
  setDoc,
  getDoc,
  increment,
  deleteField,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";
import { randomHex } from "./checkinLink";

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
export async function addService(userId, name, duration, price, materials = []) {
  const { services } = getCollections(userId);
  await addDoc(services, {
    name,
    duration: parseInt(duration),
    price: parseFloat(price) || 0,
    materials: materials || [],
  });
}

// Remover serviço
export async function removeService(userId, id) {
  await deleteDoc(doc(db, "users", userId, "services", id));
}

// Listener de serviços
export function listenServices(userId, callback, onError) {
  if (!userId) return () => { };
  const { services } = getCollections(userId);
  // Remove orderBy to avoid index issues on new accounts/collections
  const q = query(services);

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });

    // Client-side sort
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    callback(list);
  }, (error) => {
    console.error("Error fetching services:", error);
    // If callback expects a second argument or if we want to handle it, we could.
    // For now, logging is crucial for debugging the "new account" issue.
    if (onError) onError(error);
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
// checkinToken: token do link de auto-checkin (clientes). As regras do Firestore
// exigem que ele bata com o link vigente do barbeiro; o barbeiro logado não precisa.
//
// A entrada na fila e a chave secreta do cliente (client_keys, que vai no link dele e protege o
// pagamento por Pix) são gravadas no MESMO lote: as regras só aceitam a chave junto com a entrada.
// `serviceId` precisa ser o ID do serviço cadastrado: no check-in, as regras conferem nome, preço
// e duração com o cadastro do barbeiro.
export async function addClient(userId, clientData, checkinToken) {
  const { queue } = getCollections(userId);
  const joinedAt = Date.now();
  const order = await getNextOrder(userId);

  const docRef = doc(queue); // ID gerado aqui, para a chave do cliente poder usar o mesmo ID
  const clientKey = randomHex(16);

  const batch = writeBatch(db);
  batch.set(docRef, {
    ...(checkinToken ? { checkinToken } : {}),
    name: clientData.name,
    phone: clientData.phone,
    ...(clientData.serviceId ? { serviceId: clientData.serviceId } : {}),
    serviceName: clientData.serviceName,
    serviceDuration: parseInt(clientData.serviceDuration),
    servicePrice: parseFloat(clientData.servicePrice) || 0,
    notes: clientData.notes || "",
    photoUrl: clientData.photoUrl || "",
    materials: clientData.materials || [], // Snapshot materials for inventory deduction
    joinedAt,
    order,
    status: "waiting",
  });
  batch.set(doc(db, "users", userId, "client_keys", docRef.id), { key: clientKey, createdAt: joinedAt });
  await batch.commit();

  // A fila é pública para leitura: não deixar o token gravado no documento
  if (checkinToken) {
    try {
      await updateDoc(docRef, { checkinToken: deleteField() });
    } catch (err) {
      console.error("Erro ao limpar token do check-in:", err);
    }
  }

  // Sync profile name immediately (Name Sync Fix). Só no painel: o cliente do check-in não tem
  // permissão no CRM (a coleção clients é só do dono) e a tentativa sempre falhava.
  if (clientData.phone && !checkinToken) {
    updateClientProfile(userId, clientData.phone, {
      name: clientData.name,
      // We don't update stats here, just identification
    });
  }

  return { id: docRef.id, key: clientKey };
}

// Chave secreta do cliente (para o link de acompanhamento). Entradas antigas, criadas por
// agendamento ou antes do Pix existir, ganham a chave na hora em que o barbeiro gera o link.
export async function ensureClientKey(userId, clientId) {
  const ref = doc(db, "users", userId, "client_keys", clientId);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().key) return snap.data().key;
  const key = randomHex(16);
  await setDoc(ref, { key, createdAt: Date.now() });
  return key;
}

// Link de acompanhamento do cliente; `key` libera o pagamento por Pix na tela dele
export const buildClientLink = (barberId, clientId, key) =>
  `${window.location.origin}?client=${clientId}&barber=${barberId}${key ? `&k=${key}` : ""}`;

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
//   options.payment      pagamento Pix do cliente ({ id, status, receivedAmount }), se houver
//   options.creditDelta  variação do crédito do cliente: negativo = crédito descontado,
//                        positivo = sobra de um Pix pago a mais
export async function completeFirst(userId, queueList, paymentMethod = 'money', options = {}) {
  if (queueList.length === 0) return;

  const first = queueList[0];
  const now = Date.now();
  const { payment = null, creditDelta = 0 } = options;

  // 1. Atendimento + pagamento Pix + crédito no mesmo lote: grava tudo ou nada
  const batch = writeBatch(db);
  const queueUpdate = { status: "done", completedAt: now, paymentMethod };
  if (payment?.status === "confirmed") {
    queueUpdate.prepaidAmount = payment.receivedAmount || 0;
    queueUpdate.paymentId = payment.id;
  }
  if (creditDelta < 0) queueUpdate.creditUsed = -creditDelta;
  if (creditDelta > 0) queueUpdate.creditAdded = creditDelta;
  batch.update(doc(db, "users", userId, "queue", first.id), queueUpdate);

  if (payment) {
    // Pix conferido vira "usado"; comprovante que ficou sem conferir é descartado
    batch.update(doc(db, "users", userId, "payments", payment.id), {
      status: payment.status === "confirmed" ? "used" : "dismissed",
      resolvedAt: now,
      updatedAt: now,
    });
    batch.delete(doc(db, "users", userId, "payment_receipts", payment.id)); // dado de terceiros: não guardar depois de usado
  }
  if (creditDelta !== 0 && first.phone) {
    batch.set(
      doc(db, "users", userId, "clients", sanitizePhone(first.phone)),
      { phone: first.phone, creditBalance: increment(creditDelta), updatedAt: now },
      { merge: true }
    );
  }
  await batch.commit();

  // 1.5 Deduct Materials from Inventory
  if (first.materials && Array.isArray(first.materials) && first.materials.length > 0) {
    for (const mat of first.materials) {
      if (mat.productId && mat.quantity > 0) {
        const productRef = doc(db, "users", userId, "products", mat.productId);
        // Use atomic increment to subtract stock
        await updateDoc(productRef, {
          quantity: increment(-mat.quantity),
          updatedAt: Date.now()
        }).catch(err => console.error(`Error deducting stock for ${mat.name}:`, err));
      }
    }
  }

  // 2. Update Client Profile (CRM)
  if (first.phone) {
    const updates = {
      name: first.name,
      lastVisit: now,
      lastService: first.serviceName,
      totalVisits: increment(1)
    };

    await updateClientProfile(userId, first.phone, updates);

    // 3. Save Style Photo to Gallery (if exists)
    if (first.photoUrl) {
      const photoData = {
        url: first.photoUrl,
        serviceName: first.serviceName || "Atendimento",
        date: now
      };
      // Fire and forget photo save to avoid blocking completion
      addClientPhoto(userId, first.phone, photoData).catch(err => console.error("Error saving styling photo:", err));
    }
  }
} // Close completeFirst properly

// 📇 CRM & PERFIL DO CLIENTE

// Helper to sanitize phone
const sanitizePhone = (phone) => phone.replace(/\D/g, "");

// Atualizar/Criar Perfil do Cliente (Persistente)
export async function updateClientProfile(userId, phone, rawData) {
  if (!userId || !phone) return;
  // Campos undefined fazem o Firestore recusar a gravação: ficam de fora
  const data = Object.fromEntries(Object.entries(rawData || {}).filter(([, value]) => value !== undefined));
  try {
    const cleanPhone = sanitizePhone(phone);
    const clientRef = doc(db, "users", userId, "clients", cleanPhone);

    // STRATEGY: Try atomic update first (Best for existing docs)
    try {
      await updateDoc(clientRef, {
        ...data,
        phone,
        updatedAt: Date.now()
      });
    } catch (error) {
      if (error.code === 'not-found') {
        // Fallback: Document doesn't exist, create it.
        // We need to convert any dot-notation keys back to nested objects for creation
        const createData = {};
        Object.keys(data).forEach(key => {
          if (key.includes('.')) {
            const [parent, child] = key.split('.');
            if (!createData[parent]) createData[parent] = {};
            createData[parent][child] = data[key];
          } else {
            createData[key] = data[key];
          }
        });

        // increment() funciona em setDoc de um documento novo (parte de zero); totalVisits/totalSpent só
        // entram se o chamador enviou: antes iam como undefined e o perfil nunca era criado.
        await setDoc(clientRef, {
          phone,
          ...createData,
          updatedAt: Date.now()
        });
      } else {
        throw error;
      }
    }

  } catch (e) {
    console.error("Error updating client profile", e);
  }
}

// Obter perfil do cliente
export async function getClientProfile(userId, phone) {
  if (!userId || !phone) return null;
  try {
    const cleanPhone = sanitizePhone(phone);
    const clientRef = doc(db, "users", userId, "clients", cleanPhone);
    const docSnap = await getDoc(clientRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting client profile", error);
    return null;
  }
}

// Crédito do cliente (Pix adiantado de um atendimento cancelado), guardado no perfil dele
export async function getClientCredit(userId, phone) {
  const profile = await getClientProfile(userId, phone);
  const credit = Math.round((Number(profile?.creditBalance) || 0) * 100) / 100;
  return credit > 0 ? credit : 0;
}

// Obter clientes inativos (para recuperação)
export async function getInactiveClients(userId, days = 20) {
  if (!userId) return [];

  // 1. Pegar todos os clientes da collection 'clients'
  // Se a collection estiver vazia, tentamos popular com dados recentes da fila (self-healing)
  const clientsRef = collection(db, "users", userId, "clients");
  const q = query(clientsRef, orderBy("lastVisit", "asc"));
  const snapshot = await getDocs(q);

  const now = Date.now();
  const cutoffTime = now - (days * 24 * 60 * 60 * 1000);

  const inactiveList = [];

  if (!snapshot.empty) {
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.lastVisit && data.lastVisit < cutoffTime) {
        const daysSince = Math.floor((now - data.lastVisit) / (1000 * 60 * 60 * 24));
        inactiveList.push({ ...data, daysSince, id: doc.id });
      }
    });
  }

  // Fallback/Self-healing: Se não achou ninguém ou collection vazia, 
  // varrer histórico recente e popular/checar
  // (Isso garante que funcione com dados legados sem script de migração manual)
  if (snapshot.empty) {
    const queueRef = collection(db, "users", userId, "queue");
    const qHist = query(queueRef, where("status", "==", "done"), limit(50));
    const snapHist = await getDocs(qHist);

    const tempMap = new Map();
    snapHist.forEach(d => {
      const data = d.data();
      if (data.phone) {
        const visit = data.completedAt || data.joinedAt;
        if (!tempMap.has(data.phone) || visit > tempMap.get(data.phone).lastVisit) {
          tempMap.set(data.phone, { name: data.name, phone: data.phone, lastVisit: visit });
        }
      }
    });

    // Processar map
    for (const [phone, val] of tempMap.entries()) {
      // Salvar no perfil para o futuro
      await updateClientProfile(userId, phone, {
        name: val.name,
        lastVisit: val.lastVisit,
        totalVisits: increment(1) // Estimativa inicial
      });

      if (val.lastVisit < cutoffTime) {
        const daysSince = Math.floor((now - val.lastVisit) / (1000 * 60 * 60 * 24));
        inactiveList.push({ ...val, daysSince, id: phone });
      }
    }
  }

  return inactiveList.sort((a, b) => b.daysSince - a.daysSince);
}

// Listener para todos os clientes (Tempo Real)
export function listenClients(userId, callback) {
  if (!userId) return () => { };
  const clientsRef = collection(db, "users", userId, "clients");
  const q = query(clientsRef, orderBy("lastVisit", "desc"), limit(50));

  return onSnapshot(q, (snapshot) => {
    const clients = [];
    snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));
    callback(clients);
  });
}

// Obter todos os clientes (com paginação simples/limite)
export async function getAllClients(userId, limitCount = 50) {
  if (!userId) return [];

  // 1. Tentar buscar da coleção de clientes
  const clientsRef = collection(db, "users", userId, "clients");
  const q = query(clientsRef, orderBy("lastVisit", "desc"), limit(limitCount));
  const snapshot = await getDocs(q);

  let clients = [];
  snapshot.forEach(doc => {
    clients.push({ id: doc.id, ...doc.data() });
  });

  // Fallback/Self-healing (igual ao getInactive) se a lista estiver vazia
  if (clients.length === 0) {
    const queueRef = collection(db, "users", userId, "queue");
    // Pegar histórico geral para identificar clientes únicos
    // Pegar histórico geral para identificar clientes únicos
    // Nota: orderBy 'completedAt' requer índice composto com 'status'. 
    // Se der erro de índice, simplificamos para apenas 'done' e ordenamos em memória.
    // Vamos usar safe query sem orderBy complexo para garantir
    const qSafe = query(queueRef, where("status", "==", "done"), limit(100));
    const snapHist = await getDocs(qSafe);

    const tempMap = new Map();
    snapHist.forEach(d => {
      const data = d.data();
      if (data.phone) {
        const visit = data.completedAt || data.joinedAt;
        if (!tempMap.has(data.phone) || visit > tempMap.get(data.phone).lastVisit) {
          tempMap.set(data.phone, { name: data.name, phone: data.phone, lastVisit: visit, totalVisits: 1 });
        }
      }
    });
    clients = Array.from(tempMap.values());
    clients.sort((a, b) => b.lastVisit - a.lastVisit);
  }

  return clients;
}


// Atualizar dados do cliente na fila
export async function updateClient(userId, clientId, data) {
  await updateDoc(doc(db, "users", userId, "queue", clientId), data);
}

// Desfazer conclusão (devolve o Pix a "confirmado" e desfaz o crédito usado/gerado)
export async function undoComplete(userId, clientId) {
  const queueRef = doc(db, "users", userId, "queue", clientId);
  const snap = await getDoc(queueRef);
  const data = snap.exists() ? snap.data() : {};
  const now = Date.now();

  const batch = writeBatch(db);
  batch.update(queueRef, {
    status: "waiting",
    completedAt: null,
    prepaidAmount: deleteField(),
    paymentId: deleteField(),
    creditUsed: deleteField(),
    creditAdded: deleteField(),
  });

  if (data.paymentId) {
    batch.update(doc(db, "users", userId, "payments", data.paymentId), {
      status: "confirmed",
      resolvedAt: deleteField(),
      updatedAt: now,
    });
  }

  const creditRevert = (Number(data.creditUsed) || 0) - (Number(data.creditAdded) || 0);
  if (creditRevert !== 0 && data.phone) {
    batch.set(
      doc(db, "users", userId, "clients", sanitizePhone(data.phone)),
      { phone: data.phone, creditBalance: increment(creditRevert), updatedAt: now },
      { merge: true }
    );
  }
  await batch.commit();
}

// Listener em tempo real da fila
export function listenQueue(userId, callback) {
  if (!userId) return () => { };

  const { queue } = getCollections(userId);
  // Remove orderBy from query to avoid index issues/permission quirks on public access
  const q = query(queue);

  return onSnapshot(q, (snapshot) => {
    const list = [];

    snapshot.forEach((docItem) => {
      const data = docItem.data();
      if (data.status === "waiting") {
        list.push({ id: docItem.id, ...data });
      }
    });

    // Client-side sort by order, then joinedAt
    list.sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });

    callback(list);
  }, (error) => {
    console.error("Error listening to queue:", error);
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
// Adicionar agendamento (com suporte a recorrência)
export async function addAppointment(userId, appointmentData) {
  const { appointments } = getCollections(userId);
  const recurrenceCount = appointmentData.recurrenceCount || 1;
  const ids = [];

  // Data base do agendamento
  const [year, month, day] = new Date(appointmentData.scheduledDate).toISOString().split('T')[0].split('-');
  const baseDate = new Date(year, month - 1, day); // Mês 0-indexado

  for (let i = 0; i < recurrenceCount; i++) {
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + (i * 7)); // Adiciona 7 dias a cada iteração

    const docRef = await addDoc(appointments, {
      name: appointmentData.name,
      phone: appointmentData.phone || "",
      scheduledDate: nextDate.getTime(),
      scheduledTime: appointmentData.scheduledTime,
      serviceName: appointmentData.serviceName || "",
      serviceDuration: parseInt(appointmentData.serviceDuration) || 0,
      servicePrice: parseFloat(appointmentData.servicePrice) || 0,
      status: "scheduled",
      createdAt: Date.now(),
      recurrenceGroup: i > 0 ? true : false // Marcador interno opcional
    });
    ids.push(docRef.id);
  }

  return { id: ids[0] };
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
    materials: appointment.materials || [], // Pass through materials if they exist
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

// Cancelar cliente da fila.
// Se ele já tinha Pix, o barbeiro decide o destino do valor (nada some sem decisão registrada):
//   resolution = { payment, outcome: "refunded" | "credit", amount, phone }
// Um comprovante ainda não conferido é só descartado ("dismissed").
export async function cancelClient(userId, clientId, resolution = null) {
  const now = Date.now();
  const batch = writeBatch(db);
  const queueUpdate = { status: "cancelled", cancelledAt: now };

  if (resolution?.payment) {
    const { payment, outcome, amount, phone } = resolution;
    const paymentRef = doc(db, "users", userId, "payments", payment.id);

    if (payment.status === "confirmed") {
      if (outcome !== "refunded" && outcome !== "credit") throw new Error("Escolha o que fazer com o valor pago.");
      if (outcome === "credit" && !phone) throw new Error("Cliente sem telefone: não dá para guardar crédito.");
      queueUpdate.paymentResolution = outcome;
      queueUpdate.prepaidAmount = amount;
      batch.update(paymentRef, { status: outcome, resolvedAt: now, updatedAt: now });
      if (outcome === "credit") {
        batch.set(
          doc(db, "users", userId, "clients", sanitizePhone(phone)),
          { phone, creditBalance: increment(amount), updatedAt: now },
          { merge: true }
        );
      }
    } else {
      batch.update(paymentRef, { status: "dismissed", resolvedAt: now, updatedAt: now });
    }
    batch.delete(doc(db, "users", userId, "payment_receipts", payment.id));
  }

  batch.update(doc(db, "users", userId, "queue", clientId), queueUpdate);
  await batch.commit();
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

// 💸 DESPESAS
export async function addExpense(userId, expense) {
  if (!userId) return;
  const expensesRef = collection(db, "users", userId, "expenses");
  await addDoc(expensesRef, {
    ...expense,
    createdAt: Date.now(),
  });
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

    // Fetch Expenses (Current Month)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const expensesRef = collection(db, "users", userId, "expenses");
    const expensesQuery = query(expensesRef, where("createdAt", ">=", startOfMonth));
    const expensesSnapshot = await getDocs(expensesQuery);

    let totalExpenses = 0;
    const expensesBreakdown = {};
    expensesSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = parseFloat(data.amount || 0);
      totalExpenses += amount;

      const cat = data.category || 'general';
      if (!expensesBreakdown[cat]) expensesBreakdown[cat] = 0;
      expensesBreakdown[cat] += amount;
    });

    // 1. Initial Setup
    const stats = {
      today: { revenue: 0, clients: 0 },
      week: { revenue: 0, clients: 0 },
      month: { revenue: 0, clients: 0, expenses: totalExpenses },
      lastMonth: { revenue: 0, clients: 0 }, // For comparison
      loyalty: { new: 0, recurring: 0 }, // For loyalty analysis
      services: {},
      dailyRevenue: {},

      paymentMethods: {},
      revenueByPaymentMethod: { pix: 0, money: 0, card: 0 },
      revenueWeekDays: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      expensesByCategory: expensesBreakdown,
      revenueByLoyalty: { new: 0, recurring: 0 },
      heatmap: {} // { 0: { 8: 0...}, ... }
    };

    // Initialize Heatmap 7 days x Hours 8-22
    for (let d = 0; d < 7; d++) {
      stats.heatmap[d] = {};
      for (let h = 8; h <= 22; h++) stats.heatmap[d][h] = 0;
    }

    // Dates for formatting
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR');
      stats.dailyRevenue[dateStr] = 0;
    }

    // 2. Client History Map to determine New vs Recurring
    const clientHistory = new Map();

    // We need to iterate chronologically to determine "New" status correctly
    const allDocs = [];
    snapshot.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));
    allDocs.sort((a, b) => (a.completedAt || a.joinedAt) - (b.completedAt || b.joinedAt));

    allDocs.forEach((data) => {
      const completedAt = data.completedAt || data.joinedAt;
      const price = parseFloat(data.servicePrice) || 0;
      const serviceName = data.serviceName || "Outros";
      const phone = data.phone;

      // Determine if client is new or recurring at the time of this service
      let isRecurring = false;
      if (phone) {
        if (clientHistory.has(phone)) {
          isRecurring = true;
        } else {
          clientHistory.set(phone, completedAt);
        }
      }

      // Heatmap Logic (All Time - or at least last 90 days efficiently)
      // Note: We use the same 'completedAt' timestamp
      const date = new Date(completedAt);
      const day = date.getDay(); // 0-6
      const hour = date.getHours();
      if (hour >= 8 && hour <= 22) { // Focus on business hours
        stats.heatmap[day][hour] = (stats.heatmap[day][hour] || 0) + 1;
      }

      // --- Current Month Analysis (Last 30 Days) ---
      if (completedAt >= thirtyDaysAgo.getTime()) {
        stats.month.revenue += price;
        stats.month.clients += 1;

        // Loyalty Logic (Only for current month)
        if (isRecurring) {
          stats.loyalty.recurring += 1;
        } else {
          stats.loyalty.new += 1;
        }

        // Services
        if (!stats.services[serviceName]) {
          stats.services[serviceName] = { count: 0, revenue: 0 };
        }
        stats.services[serviceName].count += 1;
        stats.services[serviceName].revenue += price;

        // Payment Methods (Month)
        const method = data.paymentMethod || 'money';
        if (!stats.paymentMethods[method]) stats.paymentMethods[method] = 0;
        stats.paymentMethods[method] += 1;

        // Revenue by Payment Method (Month)
        if (stats.revenueByPaymentMethod[method] !== undefined) {
          stats.revenueByPaymentMethod[method] += price;
        }

        // Revenue by Week Day (Month)
        const d = new Date(completedAt).getDay();
        if (stats.revenueWeekDays[d] !== undefined) {
          stats.revenueWeekDays[d] += price;
        }

        // Revenue by Loyalty
        if (isRecurring) {
          stats.revenueByLoyalty.recurring += price;
        } else {
          stats.revenueByLoyalty.new += price;
        }

        // Week Analysis
        if (completedAt >= startOfWeek.getTime()) {
          stats.week.revenue += price;
          stats.week.clients += 1;
          const dateStr = new Date(completedAt).toLocaleDateString('pt-BR');
          if (stats.dailyRevenue[dateStr] !== undefined) {
            stats.dailyRevenue[dateStr] += price;
          }
        }

        // Today Analysis
        if (completedAt >= startOfDay.getTime()) {
          stats.today.revenue += price;
          stats.today.clients += 1;
        }
      }
      // --- Previous Month Analysis (30-60 Days Ago) ---
      else if (completedAt >= (thirtyDaysAgo.getTime() - (30 * 24 * 60 * 60 * 1000))) {
        stats.lastMonth.revenue += price;
        stats.lastMonth.clients += 1;
      }
    });

    return stats;
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return null;
  }
}

// 📦 GERENCIAMENTO DE ESTOQUE (INVENTORY)

// Listener de Produtos
export function listenProducts(userId, callback) {
  if (!userId) return () => { };
  const productsRef = collection(db, "users", userId, "products");
  const q = query(productsRef, orderBy("name")); // Sort by name

  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(products);
  }, (error) => {
    console.error("Error listening to products:", error);
    callback([]);
  });
}

// Adicionar produto
export async function addProduct(userId, productData) {
  const productsRef = collection(db, "users", userId, "products");
  await addDoc(productsRef, {
    ...productData,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

// Atualizar produto (ex: dar baixa no estoque)
export async function updateProduct(userId, productId, updates) {
  const productRef = doc(db, "users", userId, "products", productId);
  await updateDoc(productRef, {
    ...updates,
    updatedAt: Date.now()
  });
}

// Remover produto
export async function removeProduct(userId, productId) {
  const productRef = doc(db, "users", userId, "products", productId);
  await deleteDoc(productRef);
}

// 📸 GALERIA DE ESTILO (STYLE GALLERY)

// Adicionar foto à galeria do cliente
export async function addClientPhoto(userId, clientPhone, photoData) {
  if (!userId || !clientPhone) return;
  // Sanitizar telefone para usar como ID de documento/coleção se necessário
  // mas aqui estamos usando subcoleção dentro de um "cliente fictício" ou query?
  // O sistema atual usa 'phone' como chave principal para perfis em getClientProfile via query.
  // Vamos usar uma coleção 'client_photos' raiz ou dentro do documento do user?
  // Melhor: users/{userId}/client_photos/{photoId} com campo 'clientPhone' para query.
  // Isso evita ter que achar o doc do cliente se ele não existir fisicamente como doc (apenas no array de clients ou historico).

  const photosRef = collection(db, "users", userId, "client_photos");
  await addDoc(photosRef, {
    clientPhone,
    ...photoData,
    createdAt: Date.now()
  });
}

// Obter fotos do cliente
export async function getClientPhotos(userId, clientPhone) {
  if (!userId || !clientPhone) return [];
  const photosRef = collection(db, "users", userId, "client_photos");
  const q = query(photosRef, where("clientPhone", "==", clientPhone), orderBy("createdAt", "desc"));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Deletar foto
export async function deleteClientPhoto(userId, photoId) {
  const photoRef = doc(db, "users", userId, "client_photos", photoId);
  await deleteDoc(photoRef);
}
