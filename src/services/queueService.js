import {
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
  } from "firebase/firestore";
  
  import { db } from "../firebase";
  
  const queueCollection = collection(db, "queue");
  
  // Adicionar cliente
  export async function addClient(clientData) {
    const joinedAt = Date.now();
  
    const docRef = await addDoc(queueCollection, {
      ...clientData,
      joinedAt,
      status: "waiting",
    });
  
    return { id: docRef.id };
  }
  
  // Remover cliente
  export async function removeClient(id) {
    await deleteDoc(doc(db, "queue", id));
  }
  
  // Finalizar atendimento (marcar o 1º da fila como done)
  export async function completeFirst(queue) {
    if (queue.length === 0) return;
  
    const first = queue[0];
  
    await updateDoc(doc(db, "queue", first.id), {
      status: "done",
    });
  }
  
  // Listener em tempo real
  export function listenQueue(callback) {
    const q = query(queueCollection, orderBy("joinedAt"));
  
    return onSnapshot(q, (snapshot) => {
      const list = [];
  
      snapshot.forEach((docItem) => {
        const data = docItem.data();
        if (data.status === "waiting") {
          list.push({ id: docItem.id, ...data });
        }
      });
  
      callback(list);
    });
  }
  