// Telefone celular brasileiro (WhatsApp): máscara de digitação e validação.
// O barbeiro chama o cliente pelo WhatsApp, então só aceitamos celular completo: DDD + 9 + 8 dígitos.

const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

// Só os dígitos, sem o +55 caso o cliente cole o número com código do país
export function phoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  return digits.slice(0, 11);
}

// (11) 99999-9999, aplicado enquanto digita
export function formatPhoneBR(value) {
  const d = phoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Sequências óbvias de número inventado: 999999999, 912345678, 987654321...
const isFakeSubscriber = (subscriber) => {
  if (/^(\d)\1+$/.test(subscriber)) return true;
  const ascending = "0123456789012345";
  const descending = "9876543210987654";
  const tail = subscriber.slice(1); // ignora o 9 inicial
  return ascending.includes(tail) || descending.includes(tail);
};

export function validatePhoneBR(value) {
  const d = phoneDigits(value);
  if (d.length === 0) return { valid: false, message: "Informe seu número de WhatsApp." };
  if (d.length < 11) {
    return { valid: false, message: "Número incompleto. Digite o DDD e os 9 dígitos, ex.: (11) 99999-9999." };
  }
  if (!VALID_DDDS.has(Number(d.slice(0, 2)))) {
    return { valid: false, message: "DDD inválido. Confira os dois primeiros números." };
  }
  if (d[2] !== "9") {
    return { valid: false, message: "O celular precisa começar com 9 depois do DDD." };
  }
  if (isFakeSubscriber(d.slice(2))) {
    return { valid: false, message: "Esse número parece inválido. Digite o seu WhatsApp verdadeiro." };
  }
  return { valid: true, message: "" };
}
