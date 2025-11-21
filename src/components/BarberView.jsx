import React, { useState, useEffect } from "react";
import {
  Scissors,
  Users,
  Trash2,
  CheckCircle,
  Clock,
  User,
  Phone,
  Briefcase,
  Plus,
  X,
  Settings,
  ArrowUp,
  ArrowDown,
  MessageCircle,
  History,
  DollarSign,
  Star,
  Calendar,
  CalendarClock,
  XCircle,
  PlayCircle
} from "lucide-react";
import {
  getWaitingTime,
  generateWhatsAppMessage,
  generateStatusMessage,
  generateWhatsAppLink,
  formatDuration,
  getClientPosition,
} from "../utils/helpers";
import {
  addService,
  removeService,
  listenServices,
  addClient,
  removeClient,
  moveClient,
  completeFirst,
  listenQueue,
  addAppointment,
  listenAppointments,
  moveAppointmentToQueue,
  cancelAppointment,
  cancelClient,
  getFullHistory
} from "../services/queueService";

export default function BarberView() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [barberPassword, setBarberPassword] = useState("");
  const [queue, setQueue] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [currentView, setCurrentView] = useState("queue"); // "queue", "appointments", "history"
  const [history, setHistory] = useState([]);

  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    noPhone: false,
    serviceId: "",
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
    serviceId: "",
  });

  const BARBER_PASSWORD = "Diniz1010"; // Em produção, usar env var ou auth real

  useEffect(() => {
    console.log("Setting up listeners...");
    const unsubscribeQueue = listenQueue(setQueue);
    const unsubscribeServices = listenServices(setServices);
    const unsubscribeAppointments = listenAppointments((apps) => {
      console.log("Appointments updated:", apps);
      setAppointments(apps);
    });
    return () => {
      unsubscribeQueue();
      unsubscribeServices();
      unsubscribeAppointments();
    };
  }, []);

  const loadHistory = async () => {
    const fullHistory = await getFullHistory();
    setHistory(fullHistory);
  };

  useEffect(() => {
    if (currentView === "history") {
      loadHistory();
    }
  }, [currentView]);

  const handleLogin = () => {
    if (barberPassword === BARBER_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert("Senha incorreta!");
    }
  };

  // 🔥 ADICIONAR CLIENTE
  const handleAddClient = async () => {
    if (!newClient.name.trim()) {
      alert("Por favor, insira o nome do cliente");
      return;
    }
    // Validação de telefone apenas se não tiver marcado "Sem celular"
    if (!newClient.noPhone && (!newClient.phone.trim() || newClient.phone.length < 10)) {
      alert("Por favor, insira um número de telefone válido");
      return;
    }
    if (!newClient.serviceId) {
      alert("Por favor, cadastre e selecione um serviço primeiro");
      return;
    }

    // Encontrar dados do serviço selecionado
    const selectedService = services.find(s => s.id === newClient.serviceId);
    if (!selectedService) return;

    const clientData = {
      name: newClient.name,
      phone: newClient.noPhone ? "" : newClient.phone, // Salva vazio se não tiver fone
      serviceName: selectedService.name,
      serviceDuration: selectedService.duration,
      servicePrice: selectedService.price,
    };

    // Adicionar no Firestore
    const { id } = await addClient(clientData);

    // Só gera link e abre WhatsApp se tiver telefone
    if (!newClient.noPhone) {
      const position = queue.length + 1;
      const clientLink = `${window.location.origin}?client=${id}`;
      const message = generateWhatsAppMessage(
        { id, ...clientData },
        position,
        clientLink
      );

      const whatsappLink = generateWhatsAppLink(newClient.phone, message);
      window.open(whatsappLink, "_blank");
    }

    setNewClient({ ...newClient, name: "", phone: "", noPhone: false });
  };

  // ⚙️ GERENCIAR SERVIÇOS
  const handleAddService = async () => {
    if (!newService.name || !newService.duration || !newService.price) return;
    await addService(newService.name, newService.duration, newService.price);
    setNewService({ name: "", duration: "", price: "" });
  };

  const handleRemoveService = async (id) => {
    if (window.confirm("Remover este serviço?")) {
      await removeService(id);
    }
  };

  // ❌ REMOVER CLIENTE
  const handleRemove = async (id, name) => {
    if (window.confirm(`Tem certeza que deseja remover ${name} da fila?`)) {
      await removeClient(id);
    }
  };

  // 🟢 FINALIZAR ATENDIMENTO
  const handleComplete = async () => {
    if (queue.length === 0) {
      alert("A fila está vazia!");
      return;
    }

    if (window.confirm(`Finalizar atendimento de ${queue[0].name}?`)) {
      await completeFirst(queue);
    }
  };

  // ⬆️⬇️ MOVER CLIENTE
  const handleMove = async (client, direction) => {
    await moveClient(client, direction, queue);
  };

  // 📨 REENVIAR WHATSAPP
  const handleResendMessage = (client) => {
    const position = getClientPosition(queue, client.id);
    const clientLink = `${window.location.origin}?client=${client.id}`;
    const message = generateStatusMessage(client, position, clientLink);
    const whatsappLink = generateWhatsAppLink(client.phone, message);
    window.open(whatsappLink, "_blank");
  };

  // 📅 GERENCIAR AGENDAMENTOS
  const handleAddAppointment = async () => {
    try {
      if (!newAppointment.name || !newAppointment.date || !newAppointment.time) {
        alert("Por favor, preencha nome, data e horário");
        return;
      }

      console.log("Creating appointment with data:", newAppointment);

      const selectedService = services.find(s => s.id === newAppointment.serviceId);

      // Converter data para timestamp
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
      };

      console.log("Appointment data to save:", appointmentData);

      const result = await addAppointment(appointmentData);
      console.log("Appointment created successfully:", result);

      setNewAppointment({ name: "", phone: "", date: "", time: "", serviceId: "" });
      setShowAppointmentModal(false);

      alert("Agendamento criado com sucesso!");
    } catch (error) {
      console.error("Error creating appointment:", error);
      alert("Erro ao criar agendamento: " + error.message);
    }
  };

  const handleMoveToQueue = async (appointment) => {
    if (window.confirm(`Iniciar atendimento de ${appointment.name}?`)) {
      await moveAppointmentToQueue(appointment);
    }
  };

  const handleCancelAppointment = async (id, name) => {
    if (window.confirm(`Cancelar agendamento de ${name}?`)) {
      await cancelAppointment(id);
    }
  };

  const handleCancelClient = async (id, name) => {
    if (window.confirm(`Cancelar atendimento de ${name}?`)) {
      await cancelClient(id);
      // Recarregar histórico se estiver na view de histórico
      if (currentView === "history") {
        loadHistory();
      }
    }
  };

  // Calcular tempo total estimado da fila
  const totalQueueTime = queue.reduce((acc, curr) => acc + (curr.serviceDuration || 30), 0);

  // 🔐 Tela de login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 space-y-6">
          <div className="text-center">
            <Scissors className="w-16 h-16 mx-auto text-amber-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Acesso do Barbeiro
            </h2>
            <p className="text-gray-400">Digite a senha para continuar</p>
          </div>

          <input
            type="password"
            value={barberPassword}
            onChange={(e) => setBarberPassword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Senha"
            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          <div className="space-y-3">
            <button
              onClick={handleLogin}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🟦 Tela principal
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Scissors className="w-8 h-8 text-amber-500" />
              <h1 className="text-2xl font-bold text-white">Painel do Barbeiro</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowServiceModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Serviços
              </button>
              <button
                onClick={() => setIsAuthenticated(false)}
                className="text-gray-400 hover:text-white transition-colors px-4 py-2"
              >
                Sair
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <button
              onClick={() => setCurrentView("queue")}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "queue"
                ? "bg-amber-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
            >
              <Users className="w-4 h-4" />
              <span>Fila ({queue.length})</span>
            </button>
            <button
              onClick={() => setCurrentView("appointments")}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "appointments"
                ? "bg-amber-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="whitespace-nowrap">Agendamentos ({appointments.length})</span>
            </button>
            <button
              onClick={() => setCurrentView("history")}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${currentView === "history"
                ? "bg-amber-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
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

        {/* � QUEUE VIEW */}
        {currentView === "queue" && (
          <>
            {/* Adicionar cliente */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Adicionar Cliente à Fila
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 mb-2">
                      Nome do Cliente
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={newClient.name}
                        onChange={(e) =>
                          setNewClient({ ...newClient, name: e.target.value })
                        }
                        placeholder="Digite o nome"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2">
                      Telefone (WhatsApp)
                    </label>
                    <div className="relative mb-2">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        value={newClient.phone}
                        disabled={newClient.noPhone}
                        onChange={(e) =>
                          setNewClient({ ...newClient, phone: e.target.value })
                        }
                        placeholder="(11) 99999-9999"
                        className={`w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${newClient.noPhone ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    <label className="flex items-center cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="noPhone"
                          className="sr-only peer"
                          checked={newClient.noPhone}
                          onChange={(e) =>
                            setNewClient({
                              ...newClient,
                              noPhone: e.target.checked,
                              phone: e.target.checked ? "" : newClient.phone,
                            })
                          }
                        />
                        <div className="w-10 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      </div>
                      <span className="ml-3 text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                        Sem celular (Criança/Outros)
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">
                    Tipo de Serviço
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <select
                      value={newClient.serviceId}
                      onChange={(e) =>
                        setNewClient({ ...newClient, serviceId: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
                    >
                      <option value="">Selecione um serviço</option>
                      {services.length === 0 && <option disabled>Nenhum serviço cadastrado</option>}
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} ({service.duration} min - R$ {service.price})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAddClient}
                  disabled={services.length === 0}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Adicionar à Fila
                </button>
              </div>
            </div>

            {/* Lista de espera */}
            <div className="space-y-4">
              {queue.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Fila Vazia
                  </h3>
                  <p className="text-gray-400">
                    Adicione clientes para começar o atendimento
                  </p>
                </div>
              ) : (
                queue.map((client, index) => (
                  <div
                    key={client.id}
                    className={`relative bg-gray-800 rounded-xl p-6 transition-all ${index === 0 ? "border-2 border-amber-500 shadow-lg shadow-amber-500/10" : ""
                      }`}
                  >
                    {index === 0 && (
                      <div className="absolute -top-3 left-6 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <Scissors className="w-3 h-3" />
                        EM ATENDIMENTO
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${index === 0
                            ? "bg-amber-500 text-white"
                            : "bg-gray-700 text-gray-300"
                            }`}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">
                            {client.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mt-1">
                            <div className="flex items-center gap-1">
                              <Briefcase className="w-4 h-4" />
                              {client.serviceName}
                              {client.servicePrice && ` - R$ ${client.servicePrice}`}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {client.serviceDuration} min
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-gray-500" />
                              Espere: {getWaitingTime(client.joinedAt)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto">
                        {index === 0 ? (
                          <button
                            onClick={handleComplete}
                            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Finalizar
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleMove(client, "up")}
                              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleMove(client, "down")}
                              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-5 h-5" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleResendMessage(client)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                          title="Reenviar mensagem"
                        >
                          <MessageCircle className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleCancelClient(client.id, client.name)}
                          className="p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-400/10 rounded-lg transition-colors"
                          title="Cancelar atendimento"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleRemove(client.id, client.name)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Remover da fila"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* 📅 APPOINTMENTS VIEW */}
        {currentView === "appointments" && (
          <div className="space-y-6">
            {/* Botão Adicionar Agendamento */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowAppointmentModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Novo Agendamento</span>
              </button>
            </div>

            {/* Lista de Agendamentos */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Agendamentos</h2>
              <div className="space-y-3">
                {appointments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Nenhum agendamento pendente.</p>
                ) : (
                  appointments.map((appointment) => {
                    const date = new Date(appointment.scheduledDate);
                    const dateStr = date.toLocaleDateString('pt-BR');
                    const isToday = date.toDateString() === new Date().toDateString();

                    return (
                      <div key={appointment.id} className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="text-white font-bold text-base sm:text-lg">{appointment.name}</h3>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400 mt-1">
                              <div className="flex items-center gap-1">
                                <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="whitespace-nowrap">{dateStr} às {appointment.scheduledTime}</span>
                              </div>
                              {appointment.serviceName && (
                                <>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="truncate">{appointment.serviceName}</span>
                                </>
                              )}
                              {appointment.phone && (
                                <>
                                  <span className="hidden sm:inline">•</span>
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="truncate">{appointment.phone}</span>
                                  </div>
                                </>
                              )}
                            </div>
                            {isToday && (
                              <span className="inline-block mt-2 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                                Hoje
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleMoveToQueue(appointment)}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                              title="Iniciar atendimento"
                            >
                              <PlayCircle className="w-4 h-4" />
                              <span>Iniciar</span>
                            </button>
                            <button
                              onClick={() => handleCancelAppointment(appointment.id, appointment.name)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Cancelar agendamento"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 📜 HISTORY VIEW */}
        {currentView === "history" && (
          <div className="space-y-4 sm:space-y-6">
            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <h3 className="text-gray-400 font-medium text-sm sm:text-base">Concluídos</h3>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {history.filter(h => h.status === "done").length}
                </p>
              </div>

              <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  <h3 className="text-gray-400 font-medium text-sm sm:text-base">Cancelados</h3>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {history.filter(h => h.status === "cancelled").length}
                </p>
              </div>

              <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                  <h3 className="text-gray-400 font-medium text-sm sm:text-base">Faturamento</h3>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  R$ {history
                    .filter(h => h.status === "done")
                    .reduce((acc, curr) => acc + (Number(curr.servicePrice) || 0), 0)
                    .toFixed(2)}
                </p>
              </div>
            </div>

            {/* Lista de Histórico */}
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-4">Histórico de Hoje</h2>
              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Nenhum registro hoje.</p>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-base sm:text-lg">{item.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-400 mt-1">
                            {item.serviceName && (
                              <>
                                <span className="truncate">{item.serviceName}</span>
                                <span className="hidden sm:inline">•</span>
                              </>
                            )}
                            {item.servicePrice > 0 && (
                              <>
                                <span className="whitespace-nowrap">R$ {item.servicePrice}</span>
                                <span className="hidden sm:inline">•</span>
                              </>
                            )}
                            <span className="whitespace-nowrap">
                              {new Date(item.completedAt || item.cancelledAt || item.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {item.type === "appointment" && (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <span className="text-blue-400 whitespace-nowrap">Agendamento</span>
                              </>
                            )}
                          </div>
                          {item.rating && (
                            <div className="flex items-center gap-1 mt-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3 h-3 sm:w-4 sm:h-4 ${star <= item.rating
                                    ? "fill-amber-500 text-amber-500"
                                    : "text-gray-600"
                                    }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-end sm:justify-start">
                          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap ${item.status === "done"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-orange-500/20 text-orange-400"
                            }`}>
                            {item.status === "done" ? "Concluído" : "Cancelado"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Serviços */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Gerenciar Serviços</h3>
              <button
                onClick={() => setShowServiceModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  type="text"
                  value={newService.name}
                  onChange={(e) =>
                    setNewService({ ...newService, name: e.target.value })
                  }
                  placeholder="Nome do serviço"
                  className="w-full md:flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newService.duration}
                    onChange={(e) =>
                      setNewService({ ...newService, duration: e.target.value })
                    }
                    placeholder="Min"
                    className="flex-1 md:w-20 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <input
                    type="number"
                    value={newService.price}
                    onChange={(e) =>
                      setNewService({ ...newService, price: e.target.value })
                    }
                    placeholder="R$"
                    className="flex-1 md:w-24 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={handleAddService}
                    className="bg-amber-600 hover:bg-amber-700 text-white p-2 rounded-lg flex-shrink-0"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
                  >
                    <div>
                      <p className="text-white font-medium">{service.name}</p>
                      <p className="text-sm text-gray-400">
                        {service.duration} min • R$ {service.price}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveService(service.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {services.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    Nenhum serviço cadastrado.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agendamentos */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Novo Agendamento</h3>
              <button
                onClick={() => setShowAppointmentModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Nome do Cliente *</label>
                <input
                  type="text"
                  value={newAppointment.name}
                  onChange={(e) => setNewAppointment({ ...newAppointment, name: e.target.value })}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Telefone</label>
                <input
                  type="tel"
                  value={newAppointment.phone}
                  onChange={(e) => setNewAppointment({ ...newAppointment, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Data *</label>
                  <input
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Horário *</label>
                  <input
                    type="time"
                    value={newAppointment.time}
                    onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Serviço (opcional)</label>
                <select
                  value={newAppointment.serviceId}
                  onChange={(e) => setNewAppointment({ ...newAppointment, serviceId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">A definir</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.duration} min - R$ {service.price})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAddAppointment}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Criar Agendamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
