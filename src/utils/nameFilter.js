// Filtro de nomes ofensivos para o cadastro de clientes na fila.
// Basta editar as listas abaixo para ampliar o bloqueio.

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 40;

// Palavras longas/inequívocas: bloqueadas mesmo dentro de outra palavra
// ou separadas por símbolos/espaços (ex.: "p.o.r.r.a", "m3rd4").
const BLOCKED_SUBSTRINGS = [
  "caralho", "porra", "buceta", "bucetinha", "xoxota", "xereca",
  "merda", "bosta", "foder", "fodase", "fodasse", "fodida", "fodido",
  "punheta", "punheteiro", "arrombado", "arrombada", "babaca", "otario",
  "otaria", "vagabundo", "vagabunda", "cuzao", "safado", "safada",
  "piranha", "prostituta", "cacete", "desgraca", "desgracado", "retardado",
  "idiota", "imbecil", "estupido", "nazista", "estupro", "estuprador",
  "fuck", "shit", "bitch", "asshole", "pussy", "bastard", "cunt", "nigger",
  "whore", "slut","porno","gay","preto","macaco","safadinho","safadinha",
  "obeso","gordo","racista","putao","cafetao","comando","vermelho","tropa","pirocudo",
  "pirocao","pirocona","piroquinha","piroquinhao","piroquinhaa","piroquinhaaa","piroquinhaaaa",
  "pika","pikasso","longa","pirocasso","despiracado"
];

// Termos curtos/ambíguos: só bloqueados quando são uma palavra inteira,
// para não barrar nomes reais como "Paulo", "Cássio" ou "Rolando".
const BLOCKED_WORDS = [
  "puta", "puto", "putinha", "putaria", "cu", "pau", "rola", "pica", "piroca",
  "viado", "viadinho", "bicha", "fdp", "pqp", "vsf", "tnc", "tomanocu",
  "cuzinho", "corno", "nojento", "nojenta", "dick", "cock",
  "fdm", "krl", "crl", "pnc", "xota", "boceta","vtmnc","vsfd","fds","tcp","cv"
];

const LEET_MAP = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const normalizeToken = (token) => {
  const noLeet = token.replace(/[0-9@$!]/g, (c) => LEET_MAP[c] || c);
  // colapsa letras repetidas: "puuuuta" -> "puta", "caralhooo" -> "caralho"
  return noLeet.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
};

// "Texto livre" -> palavras normalizadas + versão colada (sem separadores)
const normalizeName = (name) => {
  const base = stripAccents(name.toLowerCase());
  const words = base
    .split(/[\s._\-*,;:|/\\]+/)
    .map(normalizeToken)
    .filter(Boolean);
  return { words, joined: words.join("") };
};

// Aplica o mesmo colapso de repetição nas listas, para comparar de igual para igual
const collapse = (w) => w.replace(/(.)\1+/g, "$1");
const SUBSTRINGS = BLOCKED_SUBSTRINGS.map(collapse);
const WORDS = new Set(BLOCKED_WORDS.map(collapse));

export function containsOffensiveWord(name) {
  const { words, joined } = normalizeName(name);
  if (words.some((w) => WORDS.has(w))) return true;
  // "p u t a" / "f d p" digitados com espaços viram letras soltas: confere colado
  if (WORDS.has(joined)) return true;
  return SUBSTRINGS.some((bad) => joined.includes(bad));
}

// Normaliza espaços para salvar: trim + espaços múltiplos viram um só
export const cleanName = (name) => name.trim().replace(/\s+/g, " ");

export function validateClientName(rawName) {
  const name = cleanName(rawName || "");

  if (name.length < NAME_MIN_LENGTH) {
    return { valid: false, message: "Digite seu nome (mínimo 2 letras)." };
  }
  if (name.length > NAME_MAX_LENGTH) {
    return { valid: false, message: `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.` };
  }
  if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(name)) {
    return { valid: false, message: "Use apenas letras no nome (sem números ou símbolos)." };
  }
  if (containsOffensiveWord(name)) {
    return { valid: false, message: "Esse nome não é permitido. Use seu nome verdadeiro." };
  }
  return { valid: true, message: "" };
}
