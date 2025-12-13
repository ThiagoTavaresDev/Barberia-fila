import React, { useState, useEffect, useCallback } from "react";
import {
  Scissors, Users, Trash2, CheckCircle, Clock, User, Phone, Briefcase, Plus,
  Settings, ArrowUp, ArrowDown, MessageCircle, History, DollarSign,
  Calendar, CalendarClock, XCircle, PlayCircle, Coffee, Camera, QrCode
} from "lucide-react";
import LiveTimer from "./LiveTimer";
import { compressImage } from "../utils/imageUtils";
import {
  generateWhatsAppMessage, generateStatusMessage, generateWhatsAppLink,
  formatDuration, getClientPosition
} from "../utils/helpers";
import {
  listenServices, addClient, removeClient, moveClient, completeFirst,
  listenQueue, listenAppointments, moveAppointmentToQueue, cancelAppointment,
  cancelClient, getFullHistory, updateClient, undoComplete,
  addService, addAppointment, removeService // Imported missing functions directly
} from "../services/queueService";
import { listenBarberStatus, endBreak } from "../services/barberStatus";
import { useAuth } from "../context/AuthContext";
import { Edit2, Undo2 } from "lucide-react";
import DashboardView from "./DashboardView";
import ServiceModal from "./modals/ServiceModal";
import AppointmentModal from "./modals/AppointmentModal";
import EditClientModal from "./modals/EditClientModal";
import QrModal from "./modals/QrModal";
import BreakModal from "./modals/BreakModal";
import { ProfileModal } from "./modals/ProfileModal";
import FinishServiceModal from "./modals/FinishServiceModal";

export default function BarberView() {
  const { user, logout } = useAuth();
  const userId = user?.id;

  const [queue, setQueue] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [currentView, setCurrentView] = useState("queue");
  const [history, setHistory] = useState([]);

  // Estados para Edição e Undo
  const [editingClient, setEditingClient] = useState(null);
  const [lastCompletedClient, setLastCompletedClient] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [clientToFinish, setClientToFinish] = useState(null);

  // Estados para Status do Barbeiro
  const [barberStatus, setLocalBarberStatus] = useState({ status: 'available' });
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(null);

  // Estado para visualizador de fotos
  const [viewingPhoto, setViewingPhoto] = useState(null);

  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    noPhone: false,
    serviceId: "",
    notes: "",
  });

  const [newService, setNewService] = useState({
    name: "",
    duration: "",
    price: "",
  });

  const [newAppointment, setNewAppointment] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    time: "",
    serviceId: "",
    recurrenceCount: 1, // Default 1 (just once)
  });

  useEffect(() => {
    if (!userId) return;

    const unsubscribeQueue = listenQueue(userId, (newQueue) => {
      setQueue(prevQueue => {
        if (prevQueue.length > 0 && newQueue.length > prevQueue.length) {
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
          audio.play().catch(e => console.log("Audio play failed:", e));
        }
        return newQueue;
      });
    });
    const unsubscribeServices = listenServices(userId, setServices);
    const unsubscribeAppointments = listenAppointments(userId, setAppointments);

    return () => {
      unsubscribeQueue();
      unsubscribeServices();
      unsubscribeAppointments();
    };
  }, [userId]);

  // Listener para status do barbeiro
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = listenBarberStatus(userId, (status) => {
      setLocalBarberStatus(status);
      if (status.status === 'on_break' && status.breakEndsAt) {
        const remaining = Math.max(0, status.breakEndsAt - Date.now());
        setBreakTimeRemaining(remaining);
      } else {
        setBreakTimeRemaining(null);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Timer para atualização da pausa
  useEffect(() => {
    if (barberStatus.status === 'on_break' && barberStatus.breakEndsAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, barberStatus.breakEndsAt - Date.now());
        setBreakTimeRemaining(remaining);
        if (remaining === 0) {
          endBreak(userId);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [barberStatus, userId]);

  const loadHistory = useCallback(async () => {
    if (userId) {
      const fullHistory = await getFullHistory(userId);
      setHistory(fullHistory);
    }
  }, [userId]);

  useEffect(() => {
    if (user?.shopName) {
      document.title = `${user.shopName} - Painel`;
    }
  }, [user]);

  useEffect(() => {
    if (currentView === "history") {
      loadHistory();
    }
  }, [currentView, loadHistory]);

  const handleAddClient = async () => {
    if (!newClient.name.trim()) {
      alert("Por favor, insira o nome do cliente");
      return;
    }
    if (!newClient.noPhone && (!newClient.phone.trim() || newClient.phone.length < 10)) {
      alert("Por favor, insira um número de telefone válido");
      return;
    }
    if (!newClient.serviceId) {
      alert("Por favor, cadastre e selecione um serviço primeiro");
      return;
    }

    const selectedService = services.find(s => s.id === newClient.serviceId);
    if (!selectedService) return;

    const clientData = {
      name: newClient.name,
      phone: newClient.noPhone ? "" : newClient.phone,
      serviceName: selectedService.name,
      serviceDuration: selectedService.duration,
      servicePrice: selectedService.price,
      notes: newClient.notes,
    };

    const { id } = await addClient(userId, clientData);

    if (!newClient.noPhone) {
      const position = queue.length + 1;
      const clientLink = `${window.location.origin}?client=${id}&barber=${userId}`;
      const message = generateWhatsAppMessage(
        { id, ...clientData },
        position,
        clientLink
      );
      const whatsappLink = generateWhatsAppLink(newClient.phone, message);
      window.open(whatsappLink, "_blank");
    }

    setNewClient({ ...newClient, name: "", phone: "", noPhone: false, notes: "" });
  };

  const handleAddService = async () => {
    if (!newService.name || !newService.duration || !newService.price) return;
    await addService(userId, newService.name, newService.duration, newService.price);
    setNewService({ name: "", duration: "", price: "" });
  };

  const handleRemoveServiceWrapper = async (id) => {
    if (window.confirm("Remover este serviço?")) {
      await removeService(userId, id);
    }
  };


  const handleRemove = async (id, name) => {
    if (window.confirm(`Tem certeza que deseja remover ${name} da fila?`)) {
      await removeClient(userId, id);
    }
  };

  const handleComplete = async () => {
    if (queue.length === 0) {
      alert("A fila está vazia!");
      return;
    }

    const clientToComplete = queue[0];
    setClientToFinish(clientToComplete);
    setShowFinishModal(true);
  };

  const handleConfirmFinish = async (paymentMethod) => {
    if (!clientToFinish) return;

    await completeFirst(userId, queue, paymentMethod);
    setLastCompletedClient(clientToFinish);
    setShowUndo(true);
    setClientToFinish(null);
    setTimeout(() => setShowUndo(false), 10000);
  };

  const handleUndo = async () => {
    if (lastCompletedClient) {
      await undoComplete(userId, lastCompletedClient.id);
      setShowUndo(false);
      setLastCompletedClient(null);
    }
  };

  const handleEditClient = (client) => {
    setEditingClient({
      ...client,
      serviceId: services.find(s => s.name === client.serviceName)?.id || ""
    });
  };

  const handleSaveEdit = async () => {
    if (!editingClient.name.trim()) return;

    const selectedService = services.find(s => s.id === editingClient.serviceId);
    const updates = {
      name: editingClient.name,
      phone: editingClient.noPhone ? "" : editingClient.phone,
      serviceName: selectedService ? selectedService.name : editingClient.serviceName,
      serviceDuration: selectedService ? selectedService.duration : editingClient.serviceDuration,
      servicePrice: selectedService ? selectedService.price : editingClient.servicePrice,
      notes: editingClient.notes || "",
      photoUrl: editingClient.photoUrl || "",
    };

    await updateClient(userId, editingClient.id, updates);
    setEditingClient(null);
  };

  const handleMove = async (client, direction) => {
    await moveClient(userId, client, direction, queue);
  };

  const handleResendMessage = (client) => {
    const position = getClientPosition(queue, client.id);
    const clientLink = `${window.location.origin}?client=${client.id}&barber=${userId}`;
    const message = generateStatusMessage(client, position, clientLink);
    const whatsappLink = generateWhatsAppLink(client.phone, message);
    window.open(whatsappLink, "_blank");
  };

  const handlePhotoUpload = async (clientId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const base64 = await compressImage(file);
        await updateClient(userId, clientId, { photoUrl: base64 });
        alert('Foto salva com sucesso!');
      } catch (error) {
        console.error('Error uploading photo:', error);
        alert('Erro ao salvar foto. Tente novamente.');
      }
    };
    input.click();
  };


  const handleAddAppointmentWrapper = async () => {
    try {
      if (!newAppointment.name || !newAppointment.date || !newAppointment.time) {
        alert("Por favor, preencha nome, data e horário");
        return;
      }
      const selectedService = services.find(s => s.id === newAppointment.serviceId);
      const [year, month, day] = newAppointment.date.split("-");
      const dateObj = new Date(year, month - 1, day);
      const scheduledDate = dateObj.getTime();

      const appointmentData = {
        name: newAppointment.name,
        phone: newAppointment.phone,
        scheduledDate,
        scheduledTime: newAppointment.time,
        serviceName: selectedService?.name || "",
        serviceDuration: selectedService?.duration || 0,
        servicePrice: selectedService?.price || 0,
        recurrenceCount: parseInt(newAppointment.recurrenceCount) || 1,
      };

      await addAppointment(userId, appointmentData);

      setNewAppointment({ name: "", phone: "", date: "", time: "", serviceId: "", recurrenceCount: 1 });
      setShowAppointmentModal(false);
      alert("Agendamento criado com sucesso!");
    } catch (error) {
      console.error("Error creating appointment:", error);
      alert("Erro ao criar agendamento: " + error.message);
    }
  }

  const handleMoveToQueue = async (appointment) => {
    if (window.confirm(`Iniciar atendimento de ${appointment.name}?`)) {
      await moveAppointmentToQueue(userId, appointment);
    }
  };

  const handleCancelAppointment = async (id, name) => {
    if (window.confirm(`Cancelar agendamento de ${name}?`)) {
      await cancelAppointment(userId, id);
    }
  };

  const handleCancelClient = async (id, name) => {
    if (window.confirm(`Cancelar atendimento de ${name}?`)) {
      await cancelClient(userId, id);
      if (currentView === "history") loadHistory();
    }
  };

  // Total Queue Time
  const totalQueueTime = queue.reduce((acc, curr) => acc + (curr.serviceDuration || 30), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Scissors className="w-8 h-8 text-amber-500" />
              <h1 className="text-2xl font-bold text-white">
                {user?.shopName || "Painel do Barbeiro"}
              </h1>
            </div>
            <div className="flex flex-wrap justify-center md:justify-end gap-2 w-full md:w-auto">
              <button onClick={() => setShowQrModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex-1 md:flex-none whitespace-nowrap">
                <QrCode className="w-4 h-4" /> Auto-Checkin
              </button>
              <button onClick={() => setShowBreakModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex-1 md:flex-none whitespace-nowrap">
                <Coffee className="w-4 h-4" /> Pausa
              </button>
              <button onClick={() => setShowProfileModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex-1 md:flex-none whitespace-nowrap">
                <User className="w-4 h-4" /> Perfil
              </button>
              <button onClick={() => setShowServiceModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex-1 md:flex-none whitespace-nowrap">
                <Settings className="w-4 h-4" /> Serviços
              </button>
              <button onClick={logout} className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex-1 md:flex-none whitespace-nowrap">
                Sair
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <button onClick={() => setCurrentView("queue")} className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "queue" ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
              <Users className="w-4 h-4" /> <span>Fila ({queue.length})</span>
            </button>
            <button onClick={() => setCurrentView("appointments")} className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "appointments" ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
              <Calendar className="w-4 h-4" /> <span className="whitespace-nowrap">Agendamentos ({appointments.length})</span>
            </button>
            <button onClick={() => setCurrentView("history")} className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "history" ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
              <History className="w-4 h-4" /> <span>Histórico</span>
            </button>
            <button onClick={() => setCurrentView("dashboard")} className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "dashboard" ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
              <DollarSign className="w-4 h-4" /> <span>Financeiro</span>
            </button>
          </div>

          {currentView === "queue" && (
            <div className="flex items-center gap-6 text-gray-300">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                <span className="font-semibold">{queue.length}</span>
                <span>na fila</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <span className="font-semibold">{formatDuration(totalQueueTime)}</span>
                <span>total estimado</span>
              </div>
            </div>
          )}
        </div>

        {/* QUEUE VIEW */}
        {currentView === "queue" && (
          <>
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Adicionar Cliente à Fila</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 mb-2">Nome do Cliente</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input type="text" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Digite o nome" className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Telefone (WhatsApp)</label>
                    <div className="relative mb-2">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input type="tel" value={newClient.phone} disabled={newClient.noPhone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="(11) 99999-9999" className={`w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${newClient.noPhone ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </div>
                    <label className="flex items-center cursor-pointer group">
                      <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={newClient.noPhone} onChange={(e) => setNewClient({ ...newClient, noPhone: e.target.checked, phone: e.target.checked ? "" : newClient.phone })} />
                        <div className="w-10 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      </div>
                      <span className="ml-3 text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Sem celular (Criança/Outros)</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Tipo de Serviço</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <select value={newClient.serviceId} onChange={(e) => setNewClient({ ...newClient, serviceId: e.target.value })} className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none">
                      <option value="">Selecione um serviço</option>
                      {services.length === 0 && <option disabled>Nenhum serviço cadastrado</option>}
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>{service.name} ({service.duration} min - R$ {service.price})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Observações / Preferências</label>
                  <textarea value={newClient.notes} onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })} placeholder="Ex: Usa máquina 2 nas laterais..." rows={3} className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
                </div>
                <button onClick={handleAddClient} disabled={services.length === 0} className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors">
                  Adicionar à Fila
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {queue.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="w-8 h-8 text-gray-400" /></div>
                  <h3 className="text-xl font-bold text-white mb-2">Fila Vazia</h3>
                  <p className="text-gray-400">Adicione clientes para começar o atendimento</p>
                </div>
              ) : (
                queue.map((client, index) => (
                  <div key={client.id} className={`relative bg-gray-800 rounded-xl p-6 transition-all ${index === 0 ? "border-2 border-amber-500 shadow-lg shadow-amber-500/10" : ""}`}>
                    {index === 0 && (
                      <div className="absolute -top-3 left-6 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><Scissors className="w-3 h-3" /> EM ATENDIMENTO</div>
                    )}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${index === 0 ? "bg-amber-500 text-white" : "bg-gray-700 text-gray-300"}`}>{index + 1}</div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{client.type === 'break' ? `☕ ${client.name}` : client.name}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mt-1">
                            <div className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {client.serviceName} {client.servicePrice && ` - R$ ${client.servicePrice}`}</div>
                            <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> {client.serviceDuration} min</div>
                            <div className="flex items-center gap-1"><Clock className="w-4 h-4 text-gray-500" /> Tempo aguardando: <LiveTimer joinedAt={client.joinedAt} /></div>
                          </div>
                          {client.notes && <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"><p className="text-sm text-blue-200 flex items-start gap-2"><span className="text-blue-400 font-bold">📝</span><span className="flex-1">{client.notes}</span></p></div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        {index === 0 ? (
                          <button onClick={handleComplete} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                            <CheckCircle className="w-5 h-5" /> Finalizar
                          </button>
                        ) : (
                          <>
                            <button onClick={() => handleMove(client, "up")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><ArrowUp className="w-5 h-5" /></button>
                            <button onClick={() => handleMove(client, "down")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><ArrowDown className="w-5 h-5" /></button>
                          </>
                        )}
                        <button onClick={() => handleEditClient(client)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><Edit2 className="w-5 h-5" /></button>
                        {client.photoUrl ? (
                          <button onClick={() => setViewingPhoto(client.photoUrl)} className="p-2 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded-lg transition-colors relative"><Camera className="w-5 h-5" /><span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></span></button>
                        ) : (
                          <button onClick={() => handlePhotoUpload(client.id)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><Camera className="w-5 h-5" /></button>
                        )}
                        {client.phone && <button onClick={() => handleResendMessage(client)} className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"><MessageCircle className="w-5 h-5" /></button>}
                        <button onClick={() => handleCancelClient(client.id, client.name)} className="p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-400/10 rounded-lg transition-colors"><XCircle className="w-5 h-5" /></button>
                        <button onClick={() => handleRemove(client.id, client.name)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* APPOINTMENTS VIEW */}
        {currentView === "appointments" && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button onClick={() => setShowAppointmentModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors">
                <Plus className="w-5 h-5" /> <span>Novo Agendamento</span>
              </button>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Agendamentos</h2>
              <div className="space-y-3">
                {appointments.length === 0 ? <p className="text-gray-500 text-center py-8">Nenhum agendamento pendente.</p> : appointments.map((appointment) => (
                  <div key={appointment.id} className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-base sm:text-lg">{appointment.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400 mt-1">
                          <div className="flex items-center gap-1"><CalendarClock className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="whitespace-nowrap">{new Date(appointment.scheduledDate).toLocaleDateString()} às {appointment.scheduledTime}</span></div>
                          {appointment.serviceName && <span className="truncate">• {appointment.serviceName}</span>}
                          {appointment.phone && <span className="truncate">• {appointment.phone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button onClick={() => handleMoveToQueue(appointment)} className="flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"><PlayCircle className="w-4 h-4" /> <span>Iniciar</span></button>
                        <button onClick={() => handleCancelAppointment(appointment.id, appointment.name)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"><XCircle className="w-5 h-5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY VIEW */}
        {currentView === "history" && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Estatísticas resumidas do histórico */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Concluídos</p>
                <p className="text-2xl font-bold text-white">{history.filter(h => h.status === "done").length}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Faturamento</p>
                <p className="text-2xl font-bold text-white">R$ {history.filter(h => h.status === "done").reduce((acc, curr) => acc + (Number(curr.servicePrice) || 0), 0).toFixed(2)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Cancelados</p>
                <p className="text-2xl font-bold text-white">{history.filter(h => h.status === "cancelled").length}</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-4">Histórico Completo</h2>
              <div className="space-y-3">
                {history.length === 0 ? <p className="text-gray-500 text-center">Nenhum registro.</p> : history.map(item => (
                  <div key={item.id} className="bg-gray-700/50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-bold">{item.name}</p>
                        <p className="text-sm text-gray-400">{item.serviceName} - R$ {item.servicePrice}</p>
                        <p className="text-xs text-gray-500">{new Date(item.completedAt || item.cancelledAt || item.joinedAt).toLocaleString()}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${item.status === 'done' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {item.status === 'done' ? 'Concluído' : 'Cancelado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {currentView === "dashboard" && <DashboardView userId={userId} user={user} />}

      </div>

      {/* MODALS */}
      <ServiceModal show={showServiceModal} onClose={() => setShowServiceModal(false)} newService={newService} setNewService={setNewService} handleAddService={handleAddService} services={services} handleRemoveService={handleRemoveServiceWrapper} />

      <AppointmentModal show={showAppointmentModal} onClose={() => setShowAppointmentModal(false)} newAppointment={newAppointment} setNewAppointment={setNewAppointment} handleAddAppointment={handleAddAppointmentWrapper} services={services} />

      <EditClientModal client={editingClient} setClient={setEditingClient} onClose={() => setEditingClient(null)} handleSave={handleSaveEdit} services={services} setViewingPhoto={setViewingPhoto} />

      <QrModal show={showQrModal} onClose={() => setShowQrModal(false)} checkInUrl={`${window.location.origin}/checkin?barber=${userId}`} />

      <BreakModal show={showBreakModal} onClose={() => setShowBreakModal(false)} barberStatus={barberStatus} breakTimeRemaining={breakTimeRemaining} userId={userId} />

      <ProfileModal show={showProfileModal} onClose={() => setShowProfileModal(false)} />

      <FinishServiceModal
        show={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        client={clientToFinish}
        onConfirm={handleConfirmFinish}
      />

      {/* Undo Button */}
      {showUndo && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <button onClick={handleUndo} className="bg-gray-800 border border-amber-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 hover:bg-gray-700 transition-colors">
            <Undo2 className="w-5 h-5 text-amber-500" /> <span>Desfazer conclusão</span>
          </button>
        </div>
      )}

      {/* Photo Viewer */}
      {viewingPhoto && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
          <img src={viewingPhoto} alt="Visualização" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
