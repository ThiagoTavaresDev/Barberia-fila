// Regras de senha forte (usadas na redefinição de senha).
//
// Obrigatórias (aparecem como lista marcada na tela): 8+ caracteres, maiúscula, minúscula, número e símbolo.
// Qualidade (só aparecem quando a senha cai nelas): palavra comum (inclusive com troca de letras por
// números, como "P@ssw0rd"), o e-mail dentro da senha, o mesmo caractere 3 vezes seguidas e sequências
// óbvias (1234, abcd, qwer). A senha só é aceita quando passa em tudo.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Se a senha CONTÉM uma destas palavras (já sem acento e com letras trocadas por números desfeitas), é fraca
const WEAK_ROOTS = [
  "senha", "password", "passwd", "qwert", "asdfg", "zxcvb", "admin", "barbearia", "barbeiro", "barber",
  "brasil", "letmein", "welcome", "iloveyou", "abcdef", "teste", "mudar", "segredo", "bemvindo",
];

// Se a senha É exatamente uma destas palavras (somando só números e símbolos), é fraca
const WEAK_WORDS = new Set([
  "amor", "deus", "jesus", "gato", "gatinho", "cachorro", "flamengo", "corinthians", "palmeiras", "vasco",
  "gremio", "santos", "futebol", "dragon", "monkey", "master", "shadow", "sunshine", "princess", "football",
  "baseball", "superman", "batman", "mustang", "trustno", "secret", "michael", "jessica", "charlie", "freedom",
  "whatever", "computer", "internet", "samsung", "iphone", "google", "facebook", "whatsapp", "instagram",
  "login", "user", "usuario", "senhas", "fila",
]);

const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i" };

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Letras da senha em duas leituras, para pegar "Flamengo#10" e também "P@ssw0rd!":
//   simples:  só as letras, sem acento, números e símbolos descartados  -> "flamengo"
//   trocada:  números/símbolos comuns viram a letra parecida (0=o, 4=a, @=a...) -> "password"
function letterCores(password) {
  const lower = stripAccents(password.toLowerCase());
  return [
    lower.replace(/[^a-z]/g, ""),
    [...lower].map((c) => LEET[c] || c).join("").replace(/[^a-z]/g, ""),
  ];
}

// Sequência crescente/decrescente de 4+ letras ou números seguidos (1234, 9876, abcd, dcba)
function hasSequence(password, minRun = 4) {
  const s = stripAccents(password.toLowerCase());
  let run = 1;
  let direction = 0;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1];
    const b = s[i];
    const sameClass = (/[0-9]/.test(a) && /[0-9]/.test(b)) || (/[a-z]/.test(a) && /[a-z]/.test(b));
    const diff = b.charCodeAt(0) - a.charCodeAt(0);
    if (sameClass && (diff === 1 || diff === -1)) {
      run = direction === diff ? run + 1 : 2;
      direction = diff;
      if (run >= minRun) return true;
    } else {
      run = 1;
      direction = 0;
    }
  }
  return false;
}

// Trechos de 4+ teclas vizinhas (qwer, asdf, zxcv), na ordem ou ao contrário
function hasKeyboardRun(password, minRun = 4) {
  const s = stripAccents(password.toLowerCase()).replace(/[^a-z0-9]/g, "");
  return KEYBOARD_ROWS.some((row) =>
    [row, [...row].reverse().join("")].some((r) => {
      for (let i = 0; i + minRun <= r.length; i++) if (s.includes(r.slice(i, i + minRun))) return true;
      return false;
    })
  );
}

// Avalia a senha. `email` serve para barrar o e-mail (ou a parte antes do @) dentro da senha.
export function evaluatePassword(password, { email = "" } = {}) {
  const pw = String(password ?? "");

  const checks = [
    { id: "length", label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, ok: pw.length >= PASSWORD_MIN_LENGTH },
    { id: "upper", label: "Uma letra maiúscula (A-Z)", ok: /\p{Lu}/u.test(pw) },
    { id: "lower", label: "Uma letra minúscula (a-z)", ok: /\p{Ll}/u.test(pw) },
    { id: "number", label: "Um número (0-9)", ok: /[0-9]/.test(pw) },
    { id: "symbol", label: "Um símbolo (ex.: ! @ # $ %)", ok: /[^\p{L}\p{N}\s]/u.test(pw) },
  ];

  const problems = [];
  if (pw.length > 0) {
    if (pw.length > PASSWORD_MAX_LENGTH) problems.push(`A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
    if (pw !== pw.trim()) problems.push("A senha não pode começar nem terminar com espaço.");

    if (letterCores(pw).some((core) => core && (WEAK_WORDS.has(core) || WEAK_ROOTS.some((root) => core.includes(root))))) {
      problems.push('Evite palavras muito comuns, como "senha", "admin" ou "barbearia".');
    }

    const localPart = stripAccents(String(email).toLowerCase().split("@")[0]).replace(/[^a-z0-9]/g, "");
    const flat = stripAccents(pw.toLowerCase()).replace(/[^a-z0-9]/g, "");
    if (localPart.length >= 3 && flat.includes(localPart)) problems.push("Não use seu e-mail (ou parte dele) na senha.");

    if (/(.)\1\1/u.test(pw)) problems.push("Evite repetir o mesmo caractere 3 vezes seguidas (ex.: aaa ou 111).");
    if (hasSequence(pw) || hasKeyboardRun(pw)) problems.push("Evite sequências óbvias, como 1234, abcd ou qwer.");
  }

  const strong = pw.length > 0 && checks.every((c) => c.ok) && problems.length === 0;
  const passed = checks.filter((c) => c.ok).length;

  let score = 0;
  if (pw.length === 0) score = 0;
  else if (strong) score = pw.length >= 12 ? 4 : 3;
  else score = passed >= 4 ? 2 : 1;

  return { checks, problems, strong, score, label: ["", "Fraca", "Razoável", "Forte", "Muito forte"][score] };
}

// "zebarbeiro@gmail.com" -> "z******o@gmail.com" (mostra qual conta está sendo redefinida sem expor tudo)
export function maskEmail(email) {
  const [local = "", domain = ""] = String(email).split("@");
  if (!domain) return String(email);
  const masked = local.length <= 2
    ? `${local.slice(0, 1)}*`
    : `${local[0]}${"*".repeat(Math.min(local.length - 2, 6))}${local.slice(-1)}`;
  return `${masked}@${domain}`;
}
