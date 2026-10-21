import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import BarberView from "./components/BarberView";
import ClientView from "./components/ClientView";
import CheckInView from "./components/CheckInView";
import LoginView from "./components/LoginView";
import RegisterView from "./components/RegisterView";
import ForgotPasswordView from "./components/ForgotPasswordView";
import ResetPasswordView from "./components/ResetPasswordView";
import EmailActionView from "./components/EmailActionView";
import { listenQueue } from "./services/queueService";

// A chave do cliente vem no link (?k=); guardamos no aparelho para sobreviver a um link aberto sem ela
const CLIENT_KEY_PATTERN = /^[0-9a-f]{32}$/;
function resolveClientKey(clientId, fromUrl) {
  const storageKey = `clientKey:${clientId}`;
  try {
    if (fromUrl && CLIENT_KEY_PATTERN.test(fromUrl)) {
      localStorage.setItem(storageKey, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(storageKey);
    return saved && CLIENT_KEY_PATTERN.test(saved) ? saved : null;
  } catch {
    return fromUrl && CLIENT_KEY_PATTERN.test(fromUrl) ? fromUrl : null;
  }
}

function AppContent() {
  const { user, isAuthenticated } = useAuth();
  const [queue, setQueue] = useState([]);

  // State for routing logic
  const [route, setRoute] = useState({
    isBarber: false,
    isCheckIn: false,
    isClient: false,
    isRegister: false, // New route
    isForgotPassword: false, // "Esqueci minha senha" (pede o e-mail)
    isResetPassword: false, // tela aberta pelo link do e-mail (nova senha)
    resetCode: null, // código do link de redefinição (?oobCode=)
    isEmailAction: false, // outros links de e-mail do Firebase (confirmação de e-mail)
    actionMode: null, // tipo do link (?mode=)
    actionCode: null, // código do link (?oobCode=)
    paramId: null, // clientId or just placeholder
    barberId: null, // barberId from URL
    clientKey: null, // chave secreta do cliente no link (?k=): libera o pagamento por Pix
    checkinToken: null // token do link de check-in (?t=)
  });

  // Detect URL parameters and path
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientParam = params.get("client");
    const barberParam = params.get("barber");
    const path = window.location.pathname;

    if (path === "/checkin") {
      setRoute({ isCheckIn: true, barberId: barberParam, checkinToken: params.get("t") });
    } else if (path === "/register") {
      setRoute({ isRegister: true });
    } else if (path === "/forgot-password") {
      setRoute({ isForgotPassword: true });
    } else if (path === "/auth/action" || path === "/reset-password" || (params.get("mode") && params.get("oobCode"))) {
      // Os links de e-mail do Firebase chegam com ?mode=resetPassword|verifyEmail&oobCode=... (a URL de ação
      // configurada no console vale para todos os e-mails do projeto). Sem "mode", abre a redefinição de senha.
      const mode = params.get("mode");
      const code = params.get("oobCode");
      if (!mode || mode === "resetPassword") {
        setRoute({ isResetPassword: true, resetCode: code });
      } else {
        setRoute({ isEmailAction: true, actionMode: mode, actionCode: code });
      }
    } else if (path === "/login") {
      // Explicit login route
      setRoute({ isBarber: true });
    } else if (clientParam) {
      setRoute({ isClient: true, paramId: clientParam, barberId: barberParam, clientKey: resolveClientKey(clientParam, params.get("k")) });
    } else {
      // Default to barber view (will require login)
      setRoute({ isBarber: true });
    }
  }, []);

  // Listen to queue ONLY if we have a target barber (logged in user OR url param)
  useEffect(() => {
    // If user is logged in, use their ID.
    // If not, but we have a barberId from the Route (scanned QR / Link), use that.
    const targetId = user?.uid || user?.id || route.barberId;

    if (targetId) {
      console.log("Listening to queue for:", targetId);
      const unsubscribe = listenQueue(targetId, (newQueue) => {
        console.log("Queue updated, count:", newQueue.length);
        setQueue(newQueue);
      });
      return () => unsubscribe();
    }
  }, [user, route.barberId]);

  if (route.isRegister) {
    if (isAuthenticated) {
      // Redirect to home if already logged in (simple client-side redirect)
      window.history.pushState({}, "", "/");
      return <BarberView />;
    }
    return <RegisterView />;
  }

  // Redefinição de senha: abre mesmo com alguém logado neste aparelho
  if (route.isForgotPassword) {
    return <ForgotPasswordView />;
  }

  if (route.isResetPassword) {
    return <ResetPasswordView code={route.resetCode} />;
  }

  if (route.isEmailAction) {
    return <EmailActionView mode={route.actionMode} code={route.actionCode} />;
  }

  if (route.isCheckIn) {
    return <CheckInView barberId={route.barberId} token={route.checkinToken} />;
  }

  if (route.isClient && route.paramId) {
    return <ClientView queue={queue} clientId={route.paramId} barberId={route.barberId} clientKey={route.clientKey} />;
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <BarberView />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
