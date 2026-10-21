import { applyActionCode } from "firebase/auth";
import { auth } from "../firebase";

// Links de e-mail do Firebase que não são de redefinição de senha (hoje: a confirmação de e-mail do cadastro).
// A URL de ação do console vale para TODOS os e-mails do projeto, então o app precisa tratar cada tipo de link.
//
// Os erros saem com `kind` ("expired" | "invalid" | "disabled" | "network") e uma mensagem pronta para a tela.

const MSG_INVALID_LINK = "Este link é inválido ou já foi usado. Se você já confirmou o seu e-mail, é só entrar.";

const fail = (kind, message) => Object.assign(new Error(message), { kind });

// Confirma o e-mail da conta (consome o link: ele só funciona uma vez)
export async function confirmEmailVerification(code) {
  if (!code) throw fail("invalid", MSG_INVALID_LINK);
  try {
    await applyActionCode(auth, code);
  } catch (error) {
    switch (error?.code) {
      case "auth/expired-action-code":
        throw fail("expired", "Este link expirou. Se você já confirmou o seu e-mail, é só entrar.");
      case "auth/invalid-action-code":
        throw fail("invalid", MSG_INVALID_LINK);
      case "auth/user-disabled":
        throw fail("disabled", "Esta conta está desativada. Fale com o suporte.");
      case "auth/network-request-failed":
        throw fail("network", "Sem internet. Confira sua conexão e tente de novo.");
      default:
        console.error("Erro ao confirmar o e-mail:", error);
        throw fail("invalid", MSG_INVALID_LINK);
    }
  }
}
