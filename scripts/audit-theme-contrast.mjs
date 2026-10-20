// Audita o contraste dos pares texto/fundo realmente usados no app, para cada preset de cor.
//
//   node --no-warnings scripts/audit-theme-contrast.mjs
//
// Sai com código 1 se algum par ficar abaixo do mínimo. Rode de novo ao criar/editar presets
// em src/utils/themes.js.
import { THEME_PRESETS, buildPalette } from "../src/utils/themes.js";

const rgb = (v) => v.split(" ").map(Number);
const lum = ([r, g, b]) => {
  const c = [r, g, b].map((x) => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const mix = (top, bottom, alpha) => top.map((v, i) => Math.round(v * alpha + bottom[i] * (1 - alpha)));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// cores estáticas do Tailwind (não mudam por tema) que carregam texto branco
const STATIC_BUTTONS = {
  "green-600 (override)": "#15803d",
  "green-700 (override)": "#166534",
  "red-600": "#dc2626",
  "blue-600": "#2563eb",
  "purple-600": "#9333ea",
  "pink-600": "#db2777",
};

let failures = 0;
const AA = 4.5;
const LARGE = 3;

for (const preset of THEME_PRESETS) {
  const { vars } = buildPalette(preset);
  const v = (name) => rgb(vars[name]);
  const gray = (n) => v(`--gray-${n}`);
  const acc = (n) => v(`--accent-${n}`);
  const fg = v("--fg");
  const onAccent = v("--on-accent");
  const on500 = v("--on-accent-500");

  const checks = [];
  const add = (label, a, b, min = AA) => checks.push({ label, value: ratio(a, b), min });

  for (const bg of [800, 700, 900]) {
    add(`texto padrão / gray-${bg}`, fg, gray(bg));
    add(`gray-300 / gray-${bg}`, gray(300), gray(bg));
    add(`gray-400 / gray-${bg}`, gray(400), gray(bg));
  }
  const ink = v("--ink");
  for (const bg of [800, 700]) {
    add(`tinta (títulos/rótulos) / gray-${bg}`, ink, gray(bg), 7);
    add(`tinta 70% (secundário) / gray-${bg}`, mix(ink, gray(bg), 0.7), gray(bg));
  }
  add("gray-500 / gray-800", gray(500), gray(800));
  add("gray-500 / gray-700", gray(500), gray(700));

  add("destaque-500 (texto) / gray-800", acc(500), gray(800));
  add("destaque-400 (texto) / gray-800", acc(400), gray(800));
  add("destaque-500 / gray-700 (ícone)", acc(500), gray(700), LARGE);
  const tint10 = mix(acc(500), gray(800), 0.1);
  add("destaque-500 / fundo destaque 10%", acc(500), tint10);
  add("texto padrão / fundo destaque 10%", fg, tint10);
  add("destaque-200 / fundo destaque 10%", acc(200), tint10);
  add("destaque-500 / fundo destaque-600 20% (ícone)", acc(500), mix(acc(600), gray(800), 0.2), LARGE);

  add("texto botão / destaque-600", onAccent, acc(600));
  add("texto botão / destaque-700 (hover)", onAccent, acc(700));
  add("texto etiqueta / destaque-500", on500, acc(500));

  const banner = mix(acc(900), gray(900), 0.4);
  add("faixa de aviso: destaque-200 / destaque-900 40%", acc(200), banner);

  for (const [name, color] of Object.entries(STATIC_BUTTONS)) add(`branco / ${name}`, [255, 255, 255], hex(color));

  const bad = checks.filter((c) => c.value < c.min);
  failures += bad.length;
  console.log(`\n${preset.name} (${preset.id}) — ${bad.length === 0 ? "OK" : bad.length + " falha(s)"}`);
  bad.forEach((c) => console.log(`  ✗ ${c.label}: ${c.value.toFixed(2)} (mín. ${c.min})`));
}

console.log(failures === 0 ? "\nTodos os pares passam." : `\n${failures} par(es) abaixo do mínimo.`);
process.exit(failures === 0 ? 0 : 1);
