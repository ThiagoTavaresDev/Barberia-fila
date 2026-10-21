import {
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, getIsolatedAuth } from "../firebase";

// Redefinição de senha no padrão de mercado:
//   1. o usuário informa o e-mail e recebe um link (válido por 1 hora, uso único)
//   2. o link abre a tela de nova senha (digitada duas vezes, senha forte, diferente da atual)
//
// Os erros saem com `kind` ("email" | "rate" | "network" | "expired" | "invalid" | "weak" | "disabled" | "other")
// e uma mensagem pronta para mostrar na tela.

const MSG_NETWORK = "Sem internet. Confira sua conexão e tente de novo.";
const MSG_RATE = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
const MSG_INVALID_LINK = "Este link é inválido ou já foi usado. Peça um novo link para redefinir a senha.";

const fail = (kind, message) => Object.assign(new Error(message), { kind });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email) => EMAIL_PATTERN.test(String(email || '').trim());

function mapCodeError(error) {
  switch (error?.code) {
    case "auth/expired-action-code":
      return fail("expired", "Este link expirou. Peça um novo link para redefinir a senha.");
    case "auth/invalid-action-code":
      return fail("invalid", MSG_INVALID_LINK);
    case "auth/user-disabled":
      return fail("disabled", "Esta conta está desativada. Fale com o suporte.");
    case "auth/network-request-failed":
      return fail("network", MSG_NETWORK);
    default:
      console.error("Erro no link de redefinição de senha:", error);
      return fail("invalid", MSG_INVALID_LINK);
  }
}

// Envia o e-mail com o link. Nunca revela se o e-mail tem conta: e-mail desconhecido volta como sucesso.
export async function requestPasswordReset(email) {
  const clean = String(email || "").trim();
  // Confere o formato aqui também: não depende de o servidor recusar e-mail malformado
  if (!isValidEmail(clean)) throw fail("email", "Digite um e-mail válido.");
  const send = (settings) => sendPasswordResetEmail(auth, clean, settings);

  try {
    try {
      // Depois da troca o Firebase oferece "continuar": leva de volta ao login deste site
      await send({ url: `${window.location.origin}/login` });
    } catch (error) {
      // O domínio do site ainda não está em "Domínios autorizados" do Firebase: envia sem o endereço de retorno
      if (["auth/unauthorized-continue-uri", "auth/invalid-continue-uri", "auth/missing-continue-uri"].includes(error?.code)) {
        await send();
      } else {
        throw error;
      }
    }
  } catch (error) {
    switch (error?.code) {
      case "auth/user-not-found":
        return;
      case "auth/invalid-email":
        throw fail("email", "Digite um e-mail válido.");
      case "auth/too-many-requests":
        throw fail("rate", MSG_RATE);
      case "auth/network-request-failed":
        throw fail("network", MSG_NETWORK);
      default:
        console.error("Erro ao enviar o e-mail de redefinição:", error);
        throw fail("other", "Não foi possível enviar o e-mail agora. Tente de novo em instantes.");
    }
  }
}

// Confere o link recebido por e-mail e devolve o e-mail da conta
export async function verifyResetCode(code) {
  if (!code) throw fail("invalid", MSG_INVALID_LINK);
  try {
    return await verifyPasswordResetCode(auth, code);
  } catch (error) {
    throw mapCodeError(error);
  }
}

// A senha nova é igual à atual? O Firebase não revela senhas, então tentamos entrar com ela num auth
// separado (sem mexer no login do app): se entrar, é a mesma. Só é chamado com o link do e-mail em mãos.
export async function isCurrentPassword(email, candidate) {
  const isolated = getIsolatedAuth();
  try {
    await signInWithEmailAndPassword(isolated, email, candidate);
    await signOut(isolated).catch(() => { });
    return true;
  } catch (error) {
    switch (error?.code) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
      case "auth/user-not-found":
        return false;
      case "auth/too-many-requests":
        throw fail("rate", MSG_RATE);
      case "auth/network-request-failed":
        throw fail("network", MSG_NETWORK);
      case "auth/user-disabled":
        throw fail("disabled", "Esta conta está desativada. Fale com o suporte.");
      default:
        console.error("Erro ao conferir a senha atual:", error);
        throw fail("other", "Não foi possível conferir a senha agora. Tente de novo.");
    }
  }
}

// Grava a senha nova (consome o link: ele só funciona uma vez)
export async function completePasswordReset(code, newPassword) {
  try {
    await confirmPasswordReset(auth, code, newPassword);
  } catch (error) {
    if (error?.code === "auth/weak-password" || error?.code === "auth/password-does-not-meet-requirements") {
      throw fail("weak", "A senha não atende às regras de segurança. Escolha uma senha mais forte.");
    }
    throw mapCodeError(error);
  }
}
