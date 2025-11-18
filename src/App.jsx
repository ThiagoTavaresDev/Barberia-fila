import React, { useState, useEffect } from 'react';
import BarberView from './components/BarberView';
import ClientView from './components/ClientView';
import { listenQueue } from "./services/queueService";

export default function App() {
  const [queue, setQueue] = useState([]);
  const [clientId, setClientId] = useState(null);
  const [isBarber, setIsBarber] = useState(false);

  // Atualização em tempo real do Firestore
  useEffect(() => {
    const unsubscribe = listenQueue(setQueue);
    return () => unsubscribe();
  }, []);

  // Detecta URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientParam = params.get("client");

    if (window.location.pathname.includes("/barber")) {
      setIsBarber(true);
    } else if (clientParam) {
      setClientId(clientParam);
    }
  }, []);

  // Painel do barbeiro
  if (isBarber) {
    return <BarberView queue={queue} />;
  }

  // Tela do cliente
  if (clientId) {
    return <ClientView queue={queue} clientId={clientId} />;
  }

  // URL inválida
  return (
    <div className="min-h-screen flex justify-center items-center bg-black text-white">
      <p>URL inválida.</p>
    </div>
  );
}
