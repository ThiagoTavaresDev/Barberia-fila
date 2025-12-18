import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import BarberView from "./components/BarberView";
import ClientView from "./components/ClientView";
import CheckInView from "./components/CheckInView";
import LoginView from "./components/LoginView";
import RegisterView from "./components/RegisterView";
import { listenQueue } from "./services/queueService";

function AppContent() {
  const { user, isAuthenticated } = useAuth();
  const [queue, setQueue] = useState([]);

  // State for routing logic
  const [route, setRoute] = useState({
    isBarber: false,
    isCheckIn: false,
    isClient: false,
    isRegister: false, // New route
    paramId: null, // clientId or just placeholder
    barberId: null // barberId from URL
  });

  // Detect URL parameters and path
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientParam = params.get("client");
    const barberParam = params.get("barber");
    const path = window.location.pathname;

    if (path === "/checkin") {
      setRoute({ isCheckIn: true, barberId: barberParam });
    } else if (path === "/register") {
      setRoute({ isRegister: true });
    } else if (path === "/login") {
      // Explicit login route
      setRoute({ isBarber: true });
    } else if (clientParam) {
      setRoute({ isClient: true, paramId: clientParam, barberId: barberParam });
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

  if (route.isCheckIn) {
    return <CheckInView barberId={route.barberId} />;
  }

  if (route.isClient && route.paramId) {
    return <ClientView queue={queue} clientId={route.paramId} barberId={route.barberId} />;
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <BarberView />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
