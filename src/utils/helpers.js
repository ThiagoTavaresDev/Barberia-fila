// Calcular tempo de espera (baseado em quando entrou)
export const getWaitingTime = (joinedAt) => {
  const now = new Date();
  const joined = new Date(joinedAt);
  const diffMs = now - joined;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) {
    return `${diffMins} min`;
  }
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}min`;
};

// Encontrar posição do cliente na fila
export const getClientPosition = (queue, clientId) => {
  return queue.findIndex((client) => client.id === clientId) + 1;
};

// Gerar mensagem WhatsApp (Boas vindas)
export const generateWhatsAppMessage = (client, position, link) => {
  return `Olá ${client.name}! Você foi adicionado à fila da barbearia. Sua posição: ${position}º. Acesse o link para acompanhar em tempo real: ${link}`;
};

// Gerar mensagem de Status (Reenvio inteligente)
export const generateStatusMessage = (client, position, link) => {
  const hour = new Date().getHours();
  let greeting = "Bom dia";

  if (hour >= 12 && hour < 18) {
    greeting = "Boa tarde";
  } else if (hour >= 18) {
    greeting = "Boa noite";
  }

  return `Olá ${client.name}, ${greeting}! Sua posição atual na fila é: ${position}º. Acompanhe: ${link}`;
};

// Gerar link do WhatsApp Web
export function generateWhatsAppLink(phone, message) {
  // remover tudo que não é número
  let clean = phone.replace(/\D/g, "");

  // se não começar com 55, adiciona
  if (!clean.startsWith("55")) {
    clean = "55" + clean;
  }

  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

// Formatar minutos para hora/min
export const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

// Calcular tempo estimado de espera para um cliente específico
export const calculateEstimatedWait = (queue, clientIndex) => {
  if (clientIndex <= 0) return 0;

  // Soma a duração de todos os clientes ANTES do atual
  // Se não tiver duration, assume 30 min (fallback)
  let totalMinutes = 0;
  for (let i = 0; i < clientIndex; i++) {
    totalMinutes += (queue[i].serviceDuration || 30);
  }

  return totalMinutes;
};

// Solicitar permissão de notificação
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;

  if (Notification.permission === "granted") return true;

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

// Enviar notificação
export const sendNotification = (title, body) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico" // ou outro ícone
    });
  }
};
