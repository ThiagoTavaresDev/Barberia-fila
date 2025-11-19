// Calcular tempo de espera
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

// Gerar mensagem WhatsApp
export const generateWhatsAppMessage = (client, position, link) => {
  return `Olá ${client.name}! Você foi adicionado à fila da barbearia. Sua posição: ${position}º. Acesse o link para acompanhar em tempo real: ${link}`;
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
