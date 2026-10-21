// Teste de integração da redefinição de senha: roda o código REAL de src/services/passwordReset.js
// (e de src/services/emailActions.js) contra o emulador do Firebase Authentication (nunca toca no projeto real).
//
//   npx firebase-tools emulators:exec --only auth --project demo-barber \
//     "node scripts/test-password-reset.mjs"
//
// Confere: pedido do link (e-mail inválido, e-mail sem conta, e-mail real), conferência do link,
// "a senha nova é igual à atual?", troca da senha, link de uso único e login com a senha nova;
// e o link de confirmação de e-mail do cadastro (que passa pela mesma URL de ação do console).
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "node_modules", ".cache", "password-reset");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "service.mjs");

const AUTH = (process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099");
const PROJECT = "demo-barber";

// O serviço importa "../firebase" (projeto real); aqui entra um equivalente apontado para o emulador
const firebaseStub = `
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, initializeAuth, inMemoryPersistence } from "firebase/auth";
const app = initializeApp({ apiKey: "fake-api-key", projectId: "${PROJECT}", authDomain: "${PROJECT}.firebaseapp.com" });
export const auth = getAuth(app);
connectAuthEmulator(auth, "http://${AUTH}", { disableWarnings: true });
export function getIsolatedAuth() {
  const iso = initializeApp({ apiKey: "fake-api-key", projectId: "${PROJECT}" }, "isolated-auth-" + Math.random());
  const isoAuth = initializeAuth(iso, { persistence: inMemoryPersistence });
  connectAuthEmulator(isoAuth, "http://${AUTH}", { disableWarnings: true });
  return isoAuth;
}`;

await build({
  stdin: {
    contents: `export * from "./src/services/passwordReset.js"; export * from "./src/services/emailActions.js";`,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: outFile,
  logLevel: "error",
  plugins: [{
    name: "firebase-stub",
    setup(b) {
      b.onResolve({ filter: /^(\.\.?\/)+firebase$/ }, () => ({ path: "firebase-stub", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: firebaseStub, loader: "js", resolveDir: root }));
    },
  }],
});

globalThis.window = { location: { origin: "https://app.test" } };
const svc = await import(pathToFileURL(outFile).href);

// ---------- utilitários ----------
const api = (path, init) => fetch(`http://${AUTH}${path}`, init).then((r) => r.json());
const signUp = (email, password) => api("/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
const signIn = (email, password) => api("/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
const oobCodesOf = async (requestType, email) => (await api(`/emulator/v1/projects/${PROJECT}/oobCodes`)).oobCodes.filter((c) => c.requestType === requestType && c.email === email);
const resetCodes = (email) => oobCodesOf("PASSWORD_RESET", email);
const sendVerification = (idToken) => api("/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=fake-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken }) });
const lookup = (idToken) => api("/identitytoolkit.googleapis.com/v1/accounts:lookup?key=fake-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });

let pass = 0;
const failures = [];
const check = (name, actual, expected) => {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) pass++; else failures.push(`${name}: esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  console.log(`  ${same ? "✓" : "✗"} ${name}${same ? "" : `  -> ${JSON.stringify(actual)}`}`);
};
// roda a função e devolve { ok, kind, message } (sem estourar)
const outcome = async (fn) => {
  try { return { ok: true, value: await fn() }; }
  catch (e) { return { ok: false, kind: e.kind, message: e.message }; }
};

const EMAIL = "ze@barbearia.test";
const OLD = "SenhaAtual#2026x";
const NEW = "Tz9!kQp#4mLw";
await signUp(EMAIL, OLD);

console.log("\n1. Pedido do link");
check("e-mail inválido: erro 'email' com mensagem clara", await outcome(() => svc.requestPasswordReset("isto-nao-e-email")).then((r) => [r.ok, r.kind, r.message]), [false, "email", "Digite um e-mail válido."]);
check("e-mail sem conta: resolve normalmente (não revela quem tem conta)", (await outcome(() => svc.requestPasswordReset("ninguem@barbearia.test"))).ok, true);
check("e-mail sem conta: nenhum link é criado", (await resetCodes("ninguem@barbearia.test")).length, 0);
check("e-mail real: resolve", (await outcome(() => svc.requestPasswordReset(`  ${EMAIL.toUpperCase()}  `))).ok, true);
const codes = await resetCodes(EMAIL);
check("e-mail real (com espaços e maiúsculas): o link é criado", codes.length, 1);
const code = codes[0]?.oobCode;

console.log("\n2. Conferência do link");
check("link válido devolve o e-mail da conta", (await outcome(() => svc.verifyResetCode(code))).value, EMAIL);
check("link inventado: 'invalid' com mensagem clara", await outcome(() => svc.verifyResetCode("codigo-inventado")).then((r) => [r.ok, r.kind, r.message]), [false, "invalid", "Este link é inválido ou já foi usado. Peça um novo link para redefinir a senha."]);
check("sem link: 'invalid'", await outcome(() => svc.verifyResetCode("")).then((r) => [r.ok, r.kind]), [false, "invalid"]);

console.log("\n3. A senha nova é igual à atual?");
check("a senha ATUAL é reconhecida", (await outcome(() => svc.isCurrentPassword(EMAIL, OLD))).value, true);
check("outra senha não é a atual", (await outcome(() => svc.isCurrentPassword(EMAIL, NEW))).value, false);
check("senha parecida (maiúscula/minúscula diferente) não é a atual", (await outcome(() => svc.isCurrentPassword(EMAIL, OLD.toLowerCase()))).value, false);
check("a conferência não derruba nem troca a senha", (await signIn(EMAIL, OLD)).idToken ? "entrou" : "não entrou", "entrou");

console.log("\n4. Troca da senha");
check("grava a senha nova", (await outcome(() => svc.completePasswordReset(code, NEW))).ok, true);
check("login com a senha NOVA funciona", (await signIn(EMAIL, NEW)).idToken ? "entrou" : "não entrou", "entrou");
check("login com a senha ANTIGA não funciona mais", (await signIn(EMAIL, OLD)).idToken ? "entrou" : "não entrou", "não entrou");
check("agora a senha nova passa a ser a 'atual'", (await outcome(() => svc.isCurrentPassword(EMAIL, NEW))).value, true);

console.log("\n5. Link de uso único");
check("o mesmo link não verifica mais", await outcome(() => svc.verifyResetCode(code)).then((r) => [r.ok, r.kind]), [false, "invalid"]);
check("o mesmo link não troca a senha de novo", await outcome(() => svc.completePasswordReset(code, "Outra#Senha77x")).then((r) => [r.ok, r.kind]), [false, "invalid"]);
check("a senha continua sendo a nova", (await signIn(EMAIL, NEW)).idToken ? "entrou" : "não entrou", "entrou");

console.log("\n6. Confirmação de e-mail (link enviado no cadastro)");
const NEW_EMAIL = "novo@barbearia.test";
const registered = await signUp(NEW_EMAIL, "Qualquer#Senha1");
await sendVerification(registered.idToken);
const verifyCode = (await oobCodesOf("VERIFY_EMAIL", NEW_EMAIL))[0]?.oobCode;
check("o cadastro gera o link de confirmação", !!verifyCode, true);
check("antes do link, o e-mail não está confirmado", (await lookup(registered.idToken)).users?.[0]?.emailVerified, false);
check("link inventado: 'invalid' com mensagem clara", await outcome(() => svc.confirmEmailVerification("codigo-inventado")).then((r) => [r.ok, r.kind, r.message]), [false, "invalid", "Este link é inválido ou já foi usado. Se você já confirmou o seu e-mail, é só entrar."]);
check("sem link: 'invalid'", await outcome(() => svc.confirmEmailVerification("")).then((r) => [r.ok, r.kind]), [false, "invalid"]);
check("confirma o e-mail", (await outcome(() => svc.confirmEmailVerification(verifyCode))).ok, true);
check("depois do link, o e-mail está confirmado", (await lookup(registered.idToken)).users?.[0]?.emailVerified, true);
check("o mesmo link não vale duas vezes", await outcome(() => svc.confirmEmailVerification(verifyCode)).then((r) => [r.ok, r.kind]), [false, "invalid"]);
check("confirmar o e-mail não mexeu na senha", (await signIn(NEW_EMAIL, "Qualquer#Senha1")).idToken ? "entrou" : "não entrou", "entrou");

console.log(`\n${pass} verificações, ${failures.length} falha(s).`);
failures.forEach((f) => console.log("  - " + f));
process.exit(failures.length ? 1 : 0);
