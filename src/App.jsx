import React, { useState, useEffect } from 'react';
import SelectView from './components/SelectView';
import BarberView from './components/BarberView';
import ClientView from './components/ClientView';
import { listenQueue } from "./services/queueService";

export default function App() {
  const [view, setView] = useState('select');
  const [queue, setQueue] = useState([]);
  const [clientId, setClientId] = useState(null);

  // Fila em tempo real
  useEffect(() => {
    const unsubscribe = listenQueue(setQueue);
    return () => unsubscribe();
  }, []);

  // Detectar cliente pela URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("client");

    if (id) {
      setClientId(id);
      setView("client");
    }
  }, []);

  const handleSelectView = (view) => setView(view);

  const handleBack = () => {
    setView('select');
    setClientId(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  if (view === 'select') return <SelectView onSelectView={handleSelectView} />;
  if (view === 'barber') return <BarberView queue={queue} onBack={handleBack} />;
  if (view === 'client') return <ClientView queue={queue} clientId={clientId} onBack={handleBack} />;

  return null;
}
