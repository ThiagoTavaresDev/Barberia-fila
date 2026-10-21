// Pix: validação de chaves e geração do código "Pix Copia e Cola" (BR Code / EMV) com CRC16.
// Tudo roda no navegador: a chave, o valor e o nome nunca são enviados a terceiros.
//
// Formato: Manual de Padrões para Iniciação do Pix (Banco Central). O valor do código é
// sempre o preço do serviço escolhido pelo cliente; nada aqui tem valor fixo.
import { phoneDigits, validatePhoneBR } from "./phone.js";

export const PIX_KEY_TYPES = [
  { id: "cpf", label: "CPF" },
  { id: "cnpj", label: "CNPJ" },
  { id: "phone", label: "Celular" },
  { id: "email", label: "E-mail" },
  { id: "random", label: "Aleatória" },
];

export const PIX_NAME_MAX = 25;
export const PIX_CITY_MAX = 15;

// ---------------------------------------------------------------- chaves

export function isValidCpf(input) {
  const d = String(input || "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export const normalizeCnpj = (input) => String(input || "").toUpperCase().replace(/[.\-/\s]/g, "");

// Aceita o CNPJ numérico e o alfanumérico (a partir de 2026): valor de cada caractere = código ASCII - 48
export function isValidCnpj(input) {
  const s = normalizeCnpj(input);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(s) || /^(.)\1{13}$/.test(s)) return false;
  const digit = (base, weights) => {
    const sum = [...base].reduce((acc, c, i) => acc + (c.charCodeAt(0) - 48) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digit(s.slice(0, 12), CNPJ_WEIGHTS_1);
  const d2 = digit(s.slice(0, 12) + d1, CNPJ_WEIGHTS_2);
  return d1 === Number(s[12]) && d2 === Number(s[13]);
}

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Valida e normaliza a chave digitada. `key` volta no formato que vai dentro do código Pix.
export function normalizePixKey(type, raw) {
  const text = String(raw || "").trim();
  if (!text) return { valid: false, key: "", message: "Informe a chave Pix." };

  switch (type) {
    case "cpf": {
      const digits = text.replace(/\D/g, "");
      return isValidCpf(digits)
        ? { valid: true, key: digits, message: "" }
        : { valid: false, key: "", message: "CPF inválido. Confira os 11 números." };
    }
    case "cnpj": {
      const cnpj = normalizeCnpj(text);
      return isValidCnpj(cnpj)
        ? { valid: true, key: cnpj, message: "" }
        : { valid: false, key: "", message: "CNPJ inválido. Confira os 14 caracteres." };
    }
    case "phone": {
      const check = validatePhoneBR(text);
      return check.valid
        ? { valid: true, key: `+55${phoneDigits(text)}`, message: "" }
        : { valid: false, key: "", message: "Celular inválido. Digite o DDD e os 9 dígitos, ex.: (11) 99999-9999." };
    }
    case "email": {
      const email = text.toLowerCase();
      return EMAIL_RE.test(email) && email.length <= 77
        ? { valid: true, key: email, message: "" }
        : { valid: false, key: "", message: "E-mail inválido. Confira se digitou igual ao cadastrado no banco." };
    }
    case "random": {
      const uuid = text.toLowerCase();
      return UUID_RE.test(uuid)
        ? { valid: true, key: uuid, message: "" }
        : { valid: false, key: "", message: "Chave aleatória inválida. Copie o código inteiro do app do banco (ex.: 123e4567-e12b-12d1-a456-426655440000)." };
    }
    default:
      return { valid: false, key: "", message: "Escolha o tipo da chave." };
  }
}

// Adivinha o tipo só quando não há ambiguidade (e-mail e chave aleatória). CPF, CNPJ e celular
// se confundem pelos dígitos, então o barbeiro escolhe.
export function guessPixKeyType(raw) {
  const text = String(raw || "").trim();
  if (text.includes("@")) return "email";
  if (UUID_RE.test(text.toLowerCase())) return "random";
  return null;
}

// ---------------------------------------------------------------- texto do código

const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Nome/cidade do código: só A-Z, 0-9 e espaço, em maiúsculas, no limite do padrão
export function sanitizePixText(text, max, fallback = "") {
  const clean = stripAccents(String(text || ""))
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return clean || fallback;
}

export const sanitizePixName = (name) => sanitizePixText(name, PIX_NAME_MAX, "RECEBEDOR");
export const sanitizePixCity = (city) => sanitizePixText(city, PIX_CITY_MAX, "BRASIL");

// Identificador da cobrança (até 25 letras/números). "***" = sem identificador.
export function pixTxid(clientId) {
  const id = String(clientId || "").replace(/[^A-Za-z0-9]/g, "");
  return id ? `BF${id}`.slice(0, 25) : "***";
}

// ---------------------------------------------------------------- BR Code

// CRC16-CCITT (poli 0x1021, inicial 0xFFFF) sobre todo o texto, incluindo "6304"
export function crc16(text) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const field = (id, value) => `${id}${String(value.length).padStart(2, "0")}${value}`;

// Valor com 2 casas e ponto decimal ("40.00"). Retorna "" quando não há valor a cobrar.
export function formatPixAmount(amount) {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

// Monta o "Pix Copia e Cola".
//   key         chave já normalizada (normalizePixKey)
//   amount      valor em reais (sem valor = o cliente digita no banco)
//   txid        identificador da cobrança
//   description mensagem curta ao recebedor (entra só se couber)
//   initiation  "11" (QR reutilizável) ou null para omitir o campo
export function buildPixPayload({ key, name, city, amount, txid = "***", description = "", initiation = "11" }) {
  // O campo 26 aceita no máximo 99 caracteres: 18 do GUI + 4 do cabeçalho da chave + até 77 da chave
  if (!key || key.length > 77) throw new Error("Chave Pix inválida para gerar o código.");
  let account = field("00", "br.gov.bcb.pix") + field("01", key);
  const message = sanitizePixText(description, 25);
  if (message && account.length + 4 + message.length <= 99) account += field("02", message);

  const value = formatPixAmount(amount);
  const safeTxid = /^[A-Za-z0-9]{1,25}$/.test(txid) ? txid : "***";

  const body =
    field("00", "01") +
    (initiation ? field("01", initiation) : "") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (value ? field("54", value) : "") +
    field("58", "BR") +
    field("59", sanitizePixName(name)) +
    field("60", sanitizePixCity(city)) +
    field("62", field("05", safeTxid)) +
    "6304";

  return body + crc16(body);
}

// Config salva pelo barbeiro (public/pix) pronta para uso?
export const isPixReady = (config) =>
  !!(config && config.enabled === true && config.key && config.receiverName && config.city);

// ---------------------------------------------------------------- dinheiro

export function formatBRL(value) {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Converte o que o barbeiro digita ("40", "40,5", "R$ 1.234,50") em número; NaN se inválido
export function parseMoneyInput(text) {
  const s = String(text ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!s) return NaN;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
