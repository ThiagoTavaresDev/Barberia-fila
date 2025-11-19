const STORAGE_KEY = "barbershopQueue";

// Salvar fila no localStorage
export const saveQueue = (queue) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    return true;
  } catch (error) {
    console.error("Erro ao salvar fila:", error);
    return false;
  }
};

// Carregar fila do localStorage
export const loadQueue = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Erro ao carregar fila:", error);
    return [];
  }
};

// Adicionar cliente à fila
export const addClientToQueue = (queue, client) => {
  const newClient = {
    id: Date.now(),
    name: client.name.trim(),
    phone: client.phone.trim(),
    joinedAt: new Date().toISOString(),
  };

  const newQueue = [...queue, newClient];
  saveQueue(newQueue);
  return { queue: newQueue, client: newClient };
};

// Remover cliente da fila
export const removeClientFromQueue = (queue, clientId) => {
  const newQueue = queue.filter((client) => client.id !== clientId);
  saveQueue(newQueue);
  return newQueue;
};

// Finalizar atendimento (remove primeiro da fila)
export const completeService = (queue) => {
  if (queue.length === 0) return queue;
  const newQueue = queue.slice(1);
  saveQueue(newQueue);
  return newQueue;
};
