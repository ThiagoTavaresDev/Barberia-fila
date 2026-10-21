import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import InventoryView from "./InventoryView";
import {
  Scissors, Users, Trash2, CheckCircle, Clock, User, Phone, Briefcase, Plus,
  Settings, ArrowUp, ArrowDown, MessageCircle, History, DollarSign,
  Calendar, CalendarClock, XCircle, PlayCircle, Coffee, Camera, QrCode, UserCog, Package, SlidersHorizontal
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
  addService, addAppointment, removeService, getClientProfile, listenProducts,
  ensureClientKey, buildClientLink, getClientCredit
} from "../services/queueService";
import { listenPayments, listenPixConfig } from "../services/pixService";
import { formatBRL, isPixReady } from "../utils/pix";
import { listenBarberStatus, endBreak } from "../services/barberStatus";
import { formatTimeLeft, WARNING_MINUTES } from "../services/checkinLink";
import { useAuth } from "../context/AuthContext";
import { Edit2, Undo2 } from "lucide-react";
import DashboardView from "./DashboardView";
import ServiceModal from "./modals/ServiceModal";
import AppointmentModal from "./modals/AppointmentModal";
import EditClientModal from "./modals/EditClientModal";
import QrModal from "./modals/QrModal";
import BreakModal from "./modals/BreakModal";
import FinishServiceModal from "./modals/FinishServiceModal";
import PaymentReviewModal from "./modals/PaymentReviewModal";
import PrepaidResolutionModal from "./modals/PrepaidResolutionModal";
import ClientProfileModal from "./modals/ClientProfileModal";
import ClientsView from "./ClientsView";
import SettingsView from "./SettingsView";
import BrandLogo from "./BrandLogo";

export default function BarberView() {
  const { user, logout } = useAuth();
  const userId = user?.id;

  const [queue, setQueue] = useState([]);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
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

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [clientToFinish, setClientToFinish] = useState(null);
  const [finishCredit, setFinishCredit] = useState(0);

  // Pix adiantado: pagamentos ativos, quem está sendo conferido/cancelado e se o Pix está ligado
  const [payments, setPayments] = useState([]);
  const [pixEnabled, setPixEnabled] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState(null);
  const [resolveTargetId, setResolveTargetId] = useState(null);
  const knownReceiptsRef = useRef(null);

  // CRM States
  const [showClientProfileModal, setShowClientProfileModal] = useState(false);
  const [selectedClientForProfile, setSelectedClientForProfile] = useState(null);

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
    materials: [], // Array of { productId, quantity }
  });

  const [newAppointment, setNewAppointment] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    serviceId: "",
    recurrenceCount: 1,
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
    const unsubscribeProducts = listenProducts(userId, setProducts);

    return () => {
      unsubscribeQueue();
      unsubscribeServices();
      unsubscribeAppointments();
      unsubscribeProducts();
    };
  }, [userId]);

  // Pagamentos por Pix: avisa com som quando chega um comprovante novo (como no aviso de cliente novo)
  useEffect(() => {
    if (!userId) return undefined;
    const unsubscribePayments = listenPayments(
      userId,
      (list) => {
        setPayments(list);
        const waitingIds = new Set(list.filter((p) => p.status === "receipt_sent").map((p) => p.id));
        const known = knownReceiptsRef.current;
        if (known && [...waitingIds].some((id) => !known.has(id))) {
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
          audio.play().catch(e => console.log("Audio play failed:", e));
        }
        knownReceiptsRef.current = waitingIds;
      },
      (error) => console.error("Erro ao escutar pagamentos Pix:", error)
    );
    const unsubscribePix = listenPixConfig(userId, (cfg) => setPixEnabled(isPixReady(cfg)), () => setPixEnabled(false));
    return () => {
      unsubscribePayments();
      unsubscribePix();
      knownReceiptsRef.current = null;
    };
  }, [userId]);

  const paymentByClient = useMemo(() => {
    const map = {};
    payments.forEach((p) => { map[p.clientId] = p; });
    return map;
  }, [payments]);

  const receiptsToReview = queue.filter((c) => paymentByClient[c.id]?.status === "receipt_sent");

  // Selo do Pix no cartão do cliente na fila (cada selo abre a conferência)
  const renderPixStatus = (client) => {
    const payment = paymentByClient[client.id];
    if (!payment) {
      if (!pixEnabled || client.type === "break") return null;
      return (
        <button onClick={() => setReviewTargetId(client.id)} className="mt-3 block text-sm text-ink/80 hover:text-ink underline">
          Marcar Pix recebido
        </button>
      );
    }
    if (payment.status === "receipt_sent") {
      return (
        <button onClick={() => setReviewTargetId(client.id)} className="mt-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-ink text-sm font-semibold hover:bg-amber-500/20 transition-colors text-left">
          <QrCode className="w-4 h-4 text-amber-500 shrink-0" /> Comprovante de Pix enviado · {formatBRL(client.servicePrice)}
          <span className="underline">Conferir</span>
        </button>
      );
    }
    if (payment.status === "confirmed") {
      return (
        <button onClick={() => setReviewTargetId(client.id)} className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-ink text-sm font-semibold hover:bg-green-500/20 transition-colors">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> Pix pago · {formatBRL(payment.receivedAmount)}
        </button>
      );
    }
    return (
      <button onClick={() => setReviewTargetId(client.id)} className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-ink text-sm font-semibold hover:bg-red-500/20 transition-colors text-left">
        <XCircle className="w-4 h-4 text-red-500 shrink-0" /> Pix não recebido · aguardando novo comprovante
      </button>
    );
  };

  // Validade do link de check-in: avisa WARNING_MINUTES antes de expirar
  const checkinLink = user?.checkinLink;
  const [linkNow, setLinkNow] = useState(Date.now());
  const warnedLinkIdRef = useRef(null);

  useEffect(() => {
    if (!checkinLink) return;
    setLinkNow(Date.now());
    const interval = setInterval(() => setLinkNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [checkinLink]);

  const linkMsLeft = checkinLink ? checkinLink.expiresAt - linkNow : null;
  const linkExpired = linkMsLeft !== null && linkMsLeft <= 0;
  const linkExpiring = linkMsLeft !== null && linkMsLeft > 0 && linkMsLeft <= WARNING_MINUTES * 60 * 1000;

  useEffect(() => {
    if (!checkinLink || !linkExpiring || warnedLinkIdRef.current === checkinLink.linkId) return;
    warnedLinkIdRef.current = checkinLink.linkId;
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.play().catch(e => console.log("Audio play failed:", e));
  }, [checkinLink, linkExpiring]);

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
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      serviceDuration: selectedService.duration,
      servicePrice: selectedService.price,
      notes: newClient.notes,
      materials: selectedService.materials || [], // Snapshot materials
    };

    let id;
    let key;
    try {
      ({ id, key } = await addClient(userId, clientData));
    } catch (error) {
      console.error("Erro ao adicionar cliente:", error);
      alert(error?.code === "permission-denied"
        ? "O Firebase não aceitou a gravação. Confira se as regras do Firestore mais recentes foram publicadas."
        : "Não foi possível adicionar o cliente. Confira sua internet e tente de novo.");
      return;
    }

    if (!newClient.noPhone) {
      const position = queue.length + 1;
      const clientLink = buildClientLink(userId, id, key);
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

  // Auto-detect client when phone changes
  useEffect(() => {
    const checkClient = async () => {
      const phone = newClient.phone;
      if (!phone || phone.length < 8) return;

      // Debounce simple implementation
      const timeoutId = setTimeout(async () => {
        try {
          const profile = await getClientProfile(userId, phone);
          if (profile && profile.name) {
            setNewClient(prev => {
              // Only update if name is different to avoid loop
              if (prev.name === profile.name) return prev;
              return {
                ...prev,
                name: profile.name,
                notes: prev.notes || profile.notes || ""
              };
            });
          }
        } catch (error) {
          console.error("Error checking client:", error);
        }
      }, 800); // Wait 800ms after typing stops

      return () => clearTimeout(timeoutId);
    };

    checkClient();
  }, [newClient.phone, userId]);

  const handleAddService = async () => {
    if (!newService.name || !newService.duration || !newService.price) return;
    await addService(userId, newService.name, newService.duration, newService.price, newService.materials);
    setNewService({ name: "", duration: "", price: "", materials: [] });
  };

  const handleRemoveServiceWrapper = async (id) => {
    if (window.confirm("Remover este serviço?")) {
      await removeService(userId, id);
    }
  };


  const handleRemove = async (id, name) => {
    // Quem tem Pix (pago ou comprovante enviado) nunca é apagado: passa pela decisão e vira "cancelado"
    if (paymentByClient[id]) {
      setResolveTargetId(id);
      return;
    }
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
    setFinishCredit(0);
    setShowFinishModal(true);
    // Crédito guardado de um Pix de atendimento cancelado antes
    if (clientToComplete.phone) {
      getClientCredit(userId, clientToComplete.phone).then(setFinishCredit).catch(() => { });
    }
  };

  const handleConfirmFinish = async (paymentMethod, { creditDelta = 0 } = {}) => {
    if (!clientToFinish) return;

    try {
      await completeFirst(userId, queue, paymentMethod, {
        payment: paymentByClient[clientToFinish.id] || null,
        creditDelta,
      });
    } catch (error) {
      console.error("Erro ao finalizar atendimento:", error);
      alert(error?.code === "permission-denied"
        ? "O Firebase não aceitou a gravação. Confira se as regras do Firestore mais recentes foram publicadas."
        : "Não foi possível finalizar o atendimento. Confira sua internet e tente de novo.");
      return;
    }
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

  const handleResendMessage = async (client) => {
    const position = getClientPosition(queue, client.id);
    // A chave no link libera o Pix na tela do cliente; entradas antigas ganham a chave agora
    let key = null;
    try { key = await ensureClientKey(userId, client.id); } catch (e) { console.error("Erro ao obter a chave do cliente:", e); }
    const clientLink = buildClientLink(userId, client.id, key);
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
    if (paymentByClient[id]) {
      setResolveTargetId(id);
      return;
    }
    if (window.confirm(`Cancelar atendimento de ${name}?`)) {
      await cancelClient(userId, id);
      if (currentView === "history") loadHistory();
    }
  };

  // Decisão sobre o Pix de quem foi cancelado: devolvido, crédito (ou comprovante descartado)
  const handleResolvePrepaid = async (outcome, { notify } = {}) => {
    const client = queue.find((c) => c.id === resolveTargetId);
    const payment = paymentByClient[resolveTargetId];
    if (!client || !payment) { setResolveTargetId(null); return; }
    const amount = Number(payment.receivedAmount) || 0;

    await cancelClient(userId, client.id, { payment, outcome, amount, phone: client.phone });
    if (notify && client.phone && outcome) {
      const text = outcome === "refunded"
        ? `Olá ${client.name}! Seu atendimento foi cancelado e devolvi seu Pix de ${formatBRL(amount)}.`
        : `Olá ${client.name}! Seu atendimento foi cancelado. Os ${formatBRL(amount)} do seu Pix ficaram como crédito para o próximo atendimento.`;
      window.open(generateWhatsAppLink(client.phone, text), "_blank");
    }
    setResolveTargetId(null);
    if (currentView === "history") loadHistory();
  };

  const handleOpenClientProfile = (client) => {
    setSelectedClientForProfile(client);
    setShowClientProfileModal(true);
  };

  // Total Queue Time
  const totalQueueTime = queue.reduce((acc, curr) => acc + (curr.serviceDuration || 30), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Aviso de validade do link de check-in */}
        {(linkExpiring || linkExpired) && (
          <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl p-4 border ${linkExpired ? "bg-red-900/40 border-red-500 text-red-200" : "bg-amber-900/40 border-amber-500 text-amber-200"}`}>
            <div className="flex items-center gap-2 text-sm sm:text-base">
              <Clock className="w-5 h-5 shrink-0" />
              {linkExpired
                ? "O link de check-in expirou. Os clientes não conseguem mais entrar na fila por ele."
                : `O link de check-in expira em ${formatTimeLeft(linkMsLeft)}.`}
            </div>
            <button onClick={() => setShowQrModal(true)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg whitespace-nowrap">
              Gerar novo link
            </button>
          </div>
        )}

        {/* Comprovantes de Pix esperando conferência */}
        {receiptsToReview.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl p-4 border bg-amber-500/10 border-amber-500/40 text-ink">
            <div className="flex items-center gap-2 text-sm sm:text-base font-medium">
              <QrCode className="w-5 h-5 shrink-0 text-amber-500" />
              {receiptsToReview.length === 1
                ? "1 comprovante de Pix para conferir"
                : `${receiptsToReview.length} comprovantes de Pix para conferir`}
            </div>
            <button onClick={() => setReviewTargetId(receiptsToReview[0].id)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg whitespace-nowrap font-semibold">
              Conferir
            </button>
          </div>
        )}

        {/* Header */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <BrandLogo size="w-10 h-10" />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {user?.shopName || "Painel do Barbeiro"}
                </h1>
                <p className="text-xs text-gray-400 font-mono">{user?.email} (ID: {userId?.slice(0, 5)}...)</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center md:justify-end gap-2 w-full md:w-auto">
              <button onClick={() => setShowQrModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex-1 md:flex-none whitespace-nowrap">
                <QrCode className="w-4 h-4" /> Auto-Checkin
                {(linkExpiring || linkExpired) && (
                  <span className={`w-2 h-2 rounded-full ${linkExpired ? "bg-red-500" : "bg-amber-500"}`} />
                )}
              </button>
              <button onClick={() => setShowBreakModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex-1 md:flex-none whitespace-nowrap">
                <Coffee className="w-4 h-4" /> Pausa
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
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
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
            <button onClick={() => setCurrentView("clients")} className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "clients" ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
              <UserCog className="w-4 h-4" /> <span>Clientes</span>
            </button>
            <button onClick={() => setCurrentView("inventory")} className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "inventory" ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
              <Package className="w-4 h-4" /> <span>Estoque</span>
            </button>
            <button onClick={() => setCurrentView("settings")} className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "settings" ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
              <SlidersHorizontal className="w-4 h-4" /> <span>Configurações</span>
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
                          {renderPixStatus(client)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                          onClick={() => handleOpenClientProfile(client)}
                          className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Perfil & Notas"
                        >
                          <User className="w-5 h-5" />
                        </button>
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
                        {item.status === 'done' && item.prepaidAmount > 0 && (
                          <p className="text-xs text-ink font-semibold mt-1">Pix adiantado · {formatBRL(item.prepaidAmount)}</p>
                        )}
                        {item.paymentResolution && (
                          <p className="text-xs text-ink font-semibold mt-1">
                            {item.paymentResolution === 'refunded' ? 'Pix devolvido' : 'Pix virou crédito'} · {formatBRL(item.prepaidAmount)}
                          </p>
                        )}
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

        {/* CLIENTS VIEW */}
        {currentView === "clients" && <ClientsView userId={userId} onOpenProfile={handleOpenClientProfile} />}

        {/* INVENTORY VIEW */}
        {currentView === "inventory" && <InventoryView userId={userId} />}
        {currentView === "settings" && <SettingsView />}

      </div>

      {/* MODALS */}
      <ServiceModal show={showServiceModal} onClose={() => setShowServiceModal(false)} newService={newService} setNewService={setNewService} handleAddService={handleAddService} services={services} handleRemoveService={handleRemoveServiceWrapper} products={products} />

      <AppointmentModal show={showAppointmentModal} onClose={() => setShowAppointmentModal(false)} newAppointment={newAppointment} setNewAppointment={setNewAppointment} handleAddAppointment={handleAddAppointmentWrapper} services={services} />

      <EditClientModal client={editingClient} setClient={setEditingClient} onClose={() => setEditingClient(null)} handleSave={handleSaveEdit} services={services} setViewingPhoto={setViewingPhoto} />

      <QrModal show={showQrModal} onClose={() => setShowQrModal(false)} />

      <BreakModal show={showBreakModal} onClose={() => setShowBreakModal(false)} barberStatus={barberStatus} breakTimeRemaining={breakTimeRemaining} userId={userId} />


      <ClientProfileModal show={showClientProfileModal} onClose={() => setShowClientProfileModal(false)} client={selectedClientForProfile} />

      <FinishServiceModal
        show={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        client={clientToFinish}
        onConfirm={handleConfirmFinish}
        payment={clientToFinish ? paymentByClient[clientToFinish.id] || null : null}
        credit={finishCredit}
        onReview={() => { setShowFinishModal(false); setReviewTargetId(clientToFinish?.id || null); }}
      />

      <PaymentReviewModal
        show={!!reviewTargetId}
        onClose={() => setReviewTargetId(null)}
        userId={userId}
        entry={queue.find((c) => c.id === reviewTargetId)}
        payment={reviewTargetId ? paymentByClient[reviewTargetId] || null : null}
      />

      <PrepaidResolutionModal
        show={!!resolveTargetId}
        onClose={() => setResolveTargetId(null)}
        entry={queue.find((c) => c.id === resolveTargetId)}
        payment={resolveTargetId ? paymentByClient[resolveTargetId] || null : null}
        onConfirm={handleResolvePrepaid}
        onReview={() => { const id = resolveTargetId; setResolveTargetId(null); setReviewTargetId(id); }}
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
