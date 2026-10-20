// Presets de cores do site.
//
// O Tailwind está configurado (tailwind.config.js) para ler as escalas `gray` e `amber`
// de variáveis CSS (--gray-*, --accent-*). Cada preset abaixo é convertido em um conjunto
// dessas variáveis por buildPalette() e aplicado no <html> por applyTheme(), então os
// componentes continuam usando as mesmas classes (bg-gray-800, text-amber-500, ...).
//
//   mode     "light" | "dark"  → define a direção da escala de cinzas
//   hue/sat  matiz (0-360) e saturação (0-100) do cinza (tom das superfícies e textos)
//   accent   cor principal (botões, destaques, ícones) = tom 500 da escala
//   onAccent "light" | "dark" | undefined → força a cor do texto sobre botões (padrão: automático por contraste)

export const DEFAULT_THEME_ID = "claro-neutro";

export const THEME_PRESETS = [
  { id: "claro-neutro", name: "Claro Neutro", mode: "light", hue: 220, sat: 14, accent: "#475569" },
  { id: "claro-azul", name: "Claro Azul", mode: "light", hue: 215, sat: 20, accent: "#2563eb" },
  { id: "claro-verde", name: "Claro Verde", mode: "light", hue: 150, sat: 12, accent: "#15803d" },
  { id: "claro-vermelho", name: "Claro Vermelho", mode: "light", hue: 0, sat: 8, accent: "#dc2626" },
  { id: "preto-branco", name: "Preto & Branco", mode: "dark", hue: 0, sat: 0, accent: "#e4e4e7" },
  { id: "preto-vermelho", name: "Preto & Vermelho", mode: "dark", hue: 0, sat: 4, accent: "#dc2626" },
  { id: "preto-amarelo", name: "Preto & Amarelo", mode: "dark", hue: 45, sat: 5, accent: "#eab308" },
  { id: "preto-verde", name: "Preto & Verde", mode: "dark", hue: 150, sat: 5, accent: "#22c55e" },
  { id: "grafite-azul", name: "Grafite & Azul", mode: "dark", hue: 220, sat: 22, accent: "#3b82f6" },
  { id: "vinho-dourado", name: "Vinho & Dourado", mode: "dark", hue: 340, sat: 22, accent: "#d4a24c" },
  { id: "ambar-classico", name: "Âmbar Clássico", mode: "dark", hue: 217, sat: 28, accent: "#f59e0b" },
];

export const getThemePreset = (id) =>
  THEME_PRESETS.find((p) => p.id === id) || THEME_PRESETS.find((p) => p.id === DEFAULT_THEME_ID);

// ---- conversões de cor ----

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function hslToRgb(h, s, l) {
  const sat = clamp(s, 0, 100) / 100;
  const lig = clamp(l, 0, 100) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function hexToHsl(hex) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

const luminance = ([r, g, b]) => {
  const c = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

const contrast = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const toVar = ([r, g, b]) => `${r} ${g} ${b}`;
const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

// ---- escalas ----

// Luminosidade (%) base de cada tom da escala de cinzas. No modo claro a escala é invertida:
// 800 vira o "cartão" branco, 900/950 o fundo da página e 50-500 os textos (escuros, com o
// matiz do destaque do preset, para o texto também carregar a cor do tema).
// Os tons de texto (500 e acima/abaixo) são ajustados em buildPalette para garantir contraste.
const GRAY_LIGHTNESS = {
  dark: { 950: 6, 900: 10, 800: 15, 700: 23, 600: 30, 500: 45, 400: 64, 300: 82, 200: 90, 100: 95, 50: 98 },
  light: { 950: 98, 900: 96, 800: 100, 700: 93, 600: 86, 500: 42, 400: 34, 300: 26, 200: 18, 100: 12, 50: 7 },
};

const MIN_CONTRAST = 4.5; // WCAG AA para texto normal
const WHITE = [255, 255, 255];

// Anda de `start` em passos de `step` (em pontos de luminosidade) até `ok(L)` ser verdadeiro;
// se não chegar lá antes de `limit`, devolve o limite.
function searchLightness(start, step, limit, ok) {
  let lightness = start;
  for (let i = 0; i < 100; i++) {
    if (ok(lightness)) return lightness;
    const next = lightness + step;
    if ((step > 0 && next > limit) || (step < 0 && next < limit)) return limit;
    lightness = next;
  }
  return lightness;
}

const mix = (top, bottom, alpha) => top.map((v, i) => Math.round(v * alpha + bottom[i] * (1 - alpha)));

export function buildPalette(preset) {
  const vars = {};
  const dark = preset.mode === "dark";
  const grayRgb = (lig) => hslToRgb(preset.hue, preset.sat, clamp(lig, 2, 99));
  const accentHsl = hexToHsl(preset.accent);
  // Nos temas claros, os textos usam um tom escuro do matiz do destaque (ex.: azul-marinho no Claro Azul)
  const textSat = clamp(accentHsl.s * 0.6, 8, 40);
  const textRgb = (lig) => hslToRgb(accentHsl.h, textSat, clamp(lig, 2, 99));
  const textOnDark = hslToRgb(preset.hue, Math.min(preset.sat, 30), 8); // texto escuro sobre destaques claros

  // ---- cinzas: tons de texto com contraste mínimo sobre os campos (gray-700) ----
  const gl = { ...GRAY_LIGHTNESS[preset.mode] };
  const field = grayRgb(gl[700]);
  if (dark) {
    gl[500] = searchLightness(gl[500], 1, 75, (L) => contrast(grayRgb(L), field) >= MIN_CONTRAST);
    gl[400] = Math.max(gl[400], gl[500] + 9);
    gl[300] = Math.max(gl[300], gl[400] + 10);
    gl[200] = Math.min(96, Math.max(gl[200], gl[300] + 5));
    gl[100] = Math.min(98, Math.max(gl[100], gl[200] + 3));
    gl[50] = 99;
  } else {
    gl[500] = searchLightness(gl[500], -1, 25, (L) => contrast(textRgb(L), field) >= MIN_CONTRAST);
    gl[400] = Math.min(gl[400], gl[500] - 6);
    gl[300] = Math.min(gl[300], gl[400] - 8);
    gl[200] = Math.min(gl[200], gl[300] - 8);
    gl[100] = Math.min(gl[100], gl[200] - 5);
    gl[50] = Math.min(gl[50], gl[100] - 4);
  }
  Object.entries(gl).forEach(([step, lig]) => {
    const isText = !dark && Number(step) <= 500;
    vars[`--gray-${step}`] = toVar(isText ? textRgb(lig) : grayRgb(lig));
  });
  const card = grayRgb(gl[800]);
  const page = grayRgb(gl[900]);

  // ---- destaque ----
  const { h, s, l: baseL } = accentHsl;
  const accent = (lig) => hslToRgb(h, s, clamp(lig, 3, 97));

  // 500 = cor do destaque usada como texto/ícone sobre o cartão (e fundo de etiquetas pequenas)
  // (também sobre o próprio tom a 10% de opacidade, usado em ícones/etiquetas translúcidas)
  const readable = (L) =>
    contrast(accent(L), card) >= MIN_CONTRAST && contrast(accent(L), mix(accent(L), card, 0.1)) >= MIN_CONTRAST;
  const L500 = dark ? searchLightness(baseL, 1, 82, readable) : searchLightness(baseL, -1, 20, readable);

  // Texto sobre botões (600/700/800): branco ou escuro, o que exigir menos mudança no tom
  const startL = L500 - (dark ? 7 : 6);
  const whiteL = searchLightness(startL, -1, 18, (L) => contrast(WHITE, accent(L)) >= MIN_CONTRAST);
  const darkL = searchLightness(startL, 1, 90, (L) => contrast(textOnDark, accent(L)) >= MIN_CONTRAST);
  const whiteOk = contrast(WHITE, accent(whiteL)) >= MIN_CONTRAST;
  const darkOk = contrast(textOnDark, accent(darkL)) >= MIN_CONTRAST;
  let whiteButton;
  if (preset.onAccent === "light") whiteButton = true;
  else if (preset.onAccent === "dark") whiteButton = false;
  else if (whiteOk && darkOk) whiteButton = startL - whiteL <= darkL - startL + 6;
  else whiteButton = whiteOk || !darkOk;

  const L600 = whiteButton ? whiteL : darkL;
  let L700;
  if (whiteButton) L700 = L600 - 7;
  else L700 = contrast(textOnDark, accent(L600 - 3)) >= MIN_CONTRAST ? L600 - 3 : L600;
  const onButton = whiteButton ? WHITE : textOnDark;

  // Texto sobre fundos `bg-amber-500` (etiquetas, abas ativas): o que contrasta mais com o 500
  const on500 = contrast(WHITE, accent(L500)) >= contrast(textOnDark, accent(L500)) ? WHITE : textOnDark;

  const accentL = dark
    ? {
        400: Math.min(L500 + 8, 88), 500: L500, 600: L600, 700: L700, 800: L700 - 7,
        900: Math.max(L600 - 30, 10), 950: 6,
      }
    : {
        400: L500 - 4, 500: L500, 600: L600, 700: L700, 800: 88, 900: 94, 950: 97,
      };

  // Texto das faixas de aviso (`bg-amber-900/40 text-amber-200`): contraste sobre o fundo mesclado
  const bannerBg = mix(accent(accentL[900]), page, 0.4);
  if (dark) {
    accentL[200] = searchLightness(82, 1, 97, (L) => contrast(accent(L), bannerBg) >= MIN_CONTRAST);
    accentL[100] = Math.min(98, accentL[200] + 8);
    accentL[300] = Math.min(accentL[200] - 10, 72);
    accentL[50] = 97;
  } else {
    accentL[200] = searchLightness(22, -1, 4, (L) => contrast(accent(L), bannerBg) >= MIN_CONTRAST);
    accentL[100] = Math.max(accentL[200] - 8, 4);
    accentL[300] = accentL[200] + 8;
    accentL[50] = 6;
  }

  Object.entries(accentL).forEach(([step, lig]) => {
    vars[`--accent-${step}`] = toVar(accent(lig));
  });

  // "Tinta" do tema: cor forte para títulos e rótulos dentro de modais/cartões. É um tom bem escuro
  // (temas claros) ou bem claro (temas escuros) do destaque, com contraste mínimo de 11:1 sobre o cartão e os campos.
  const inkSat = s < 10 ? s : clamp(Math.max(s, 28), 0, 75);
  const ink = (lig) => hslToRgb(h, inkSat, lig);
  const field700 = grayRgb(gl[700]);
  const inkL = dark
    ? searchLightness(82, 1, 98, (L) => contrast(ink(L), field700) >= 11 && contrast(ink(L), card) >= 11)
    : searchLightness(22, -1, 4, (L) => contrast(ink(L), field700) >= 11 && contrast(ink(L), card) >= 11);
  vars["--ink"] = toVar(ink(inkL));

  // Texto padrão (o que antes era `text-white`) e texto sobre fundos de destaque
  vars["--fg"] = dark ? toVar(WHITE) : toVar(textRgb(7));
  vars["--fg-base"] = vars["--fg"];
  vars["--on-accent"] = toVar(onButton);
  vars["--on-accent-500"] = toVar(on500);

  return {
    vars,
    themeColor: toHex(page),
    accentHex: toHex(accent(L500)),
    accentHexDark: toHex(accent(L700)),
  };
}

// ---- aplicação no documento ----

export function applyTheme(presetOrId) {
  const preset = typeof presetOrId === "string" || !presetOrId ? getThemePreset(presetOrId) : presetOrId;
  const { vars, themeColor, accentHex } = buildPalette(preset);
  const root = document.documentElement;

  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
  root.dataset.mode = preset.mode;
  root.dataset.theme = preset.id;
  root.style.colorScheme = preset.mode;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", themeColor);

  faviconAccent = accentHex;
  refreshFavicon();
}

// Cores de destaque do tema atual (ex.: confete). Cai no âmbar se algo falhar.
export function getAccentColors(presetId) {
  const { accentHex, accentHexDark } = buildPalette(getThemePreset(presetId));
  return [accentHex, accentHexDark, "#ffffff"];
}

// ---- favicon / ícone do site ----

const SCISSORS_PATH =
  "M256 320L216.5 359.5C203.9 354.6 190.3 352 176 352C114.1 352 64 402.1 64 464C64 525.9 114.1 576 176 576C237.9 576 288 525.9 288 464C288 449.7 285.3 436.1 280.5 423.5L563.2 140.8C570.3 133.7 570.3 122.3 563.2 115.2C534.9 86.9 489.1 86.9 460.8 115.2L320 256L280.5 216.5C285.4 203.9 288 190.3 288 176C288 114.1 237.9 64 176 64C114.1 64 64 114.1 64 176C64 237.9 114.1 288 176 288C190.3 288 203.9 285.3 216.5 280.5L256 320zM353.9 417.9L460.8 524.8C489.1 553.1 534.9 553.1 563.2 524.8C570.3 517.7 570.3 506.3 563.2 499.2L417.9 353.9L353.9 417.9zM128 176C128 149.5 149.5 128 176 128C202.5 128 224 149.5 224 176C224 202.5 202.5 224 176 224C149.5 224 128 202.5 128 176zM176 416C202.5 416 224 437.5 224 464C224 490.5 202.5 512 176 512C149.5 512 128 490.5 128 464C128 437.5 149.5 416 176 416z";

// Tesoura padrão (public/tesoura.svg) na cor de destaque do tema atual
const scissorsIcon = (color) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="${color}"><path d="${SCISSORS_PATH}"/></svg>`
  )}`;

function setLink(rel, href, type) {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  if (type) link.type = type;
  else link.removeAttribute("type");
  link.href = href;
}

// Estado do ícone: depende da logo (se houver) e da cor do tema, que mudam em momentos diferentes
let faviconLogo = "";
let faviconAccent = "#f59e0b";

function refreshFavicon() {
  if (faviconLogo) {
    setLink("icon", faviconLogo);
    setLink("apple-touch-icon", faviconLogo);
  } else {
    setLink("icon", scissorsIcon(faviconAccent), "image/svg+xml");
    const apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (apple) apple.href = "/logo192.png";
  }
}

// Troca o ícone da aba pela logo do barbeiro (ou volta à tesoura na cor do tema)
export function applyFavicon(logoUrl) {
  faviconLogo = logoUrl || "";
  refreshFavicon();
}
