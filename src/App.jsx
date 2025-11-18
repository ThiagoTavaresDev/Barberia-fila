import React, { useState, useEffect } from 'react';
import SelectView from './components/SelectView';
import BarberView from './components/BarberView';
import ClientView from './components/ClientView';
import { loadQueue } from './services/storage';

export default function App() {
  const [view, setView] = useState('select');
  const [queue, setQueue] = useState([]);
  const [clientId, setClientId] = useState(null);

  // Carregar fila ao iniciar
  useEffect(() => {
    const savedQueue = loadQueue();
    setQueue(savedQueue);
  }, []);

  // Auto-atualização a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      const updatedQueue = loadQueue();
      setQueue(updatedQueue);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Verificar se há ID de cliente na URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientParam = params.get('client');
    if (clientParam) {
      setClientId(parseInt(clientParam));
      setView('client');
    }
  }, []);

  const handleSelectView = (selectedView) => {
    setView(selectedView);
  };

  const handleBack = () => {
    setView('select');
    setClientId(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  if (view === 'select') {
    return <SelectView onSelectView={handleSelectView} />;
  }

  if (view === 'barber') {
    return <BarberView queue={queue} setQueue={setQueue} onBack={handleBack} />;
  }

  if (view === 'client') {
    return <ClientView queue={queue} clientId={clientId} onBack={handleBack} />;
  }

  return null;
}