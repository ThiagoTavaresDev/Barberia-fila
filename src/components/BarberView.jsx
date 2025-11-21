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
  addClient,
  removeClient,
  completeFirst,
  listenServices,
  addService,
  removeService,
  moveClient,
} from "../services/queueService";

const BARBER_PASSWORD = process.env.REACT_APP_BARBER_PASSWORD;

export default function BarberView({ queue, onBack }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [barberPassword, setBarberPassword] = useState("");
  const [services, setServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);

  // Estado para novo cliente
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    noPhone: false, // Novo estado
    serviceId: "",
  });

  // Estado para novo serviço
  const [newService, setNewService] = useState({
    name: "",
    duration: "",
  });

  // Carregar serviços
  useEffect(() => {
    const unsubscribe = listenServices((list) => {
      setServices(list);
      // Se não tiver serviço selecionado e a lista não for vazia, seleciona o primeiro
      if (!newClient.serviceId && list.length > 0) {
        setNewClient((prev) => ({ ...prev, serviceId: list[0].id }));
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Adicionei o comentário acima para suprimir o warning, pois queremos que rode apenas uma vez ou quando newClient.serviceId mudar logicamente, mas aqui é inicialização.
  // Na verdade, a lógica de selecionar o primeiro deve rodar quando 'list' muda.

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
    if (!newService.name || !newService.duration) return;
    await addService(newService.name, newService.duration);
    setNewService({ name: "", duration: "" });
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
              <h1 className="text-3xl font-bold text-white">
                Painel do Barbeiro
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowServiceModal(true)}
                className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Settings className="w-5 h-5" />
                <span className="hidden md:inline">Serviços</span>
              </button>
              <button
                onClick={() => {
                  setIsAuthenticated(false);
                  window.location.href = "/barber";
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Sair
              </button>
            </div>
          </div>

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
        </div>

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
                  {services.length === 0 && <option>Nenhum serviço cadastrado</option>}
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.duration} min)
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

        {/* Lista */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Fila de Espera</h2>

          {queue.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Nenhum cliente na fila</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((client, index) => (
                <div
                  key={client.id}
                  className={`p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${index === 0 ? "bg-amber-600" : "bg-gray-700"
                    }`}
                >
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${index === 0
                        ? "bg-amber-700 text-white"
                        : "bg-gray-600 text-gray-300"
                        }`}
                    >
                      {index + 1}
                    </div>

                    <div>
                      <p
                        className={`font-semibold ${index === 0 ? "text-white" : "text-gray-200"
                          }`}
                      >
                        {client.name}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span
                          className={
                            index === 0 ? "text-amber-100" : "text-gray-400"
                          }
                        >
                          {client.phone || "Sem celular"}
                        </span>

                        <span
                          className={`flex items-center gap-1 ${index === 0 ? "text-amber-100" : "text-gray-400"
                            }`}
                        >
                          <Briefcase className="w-4 h-4" />
                          {client.serviceName}
                        </span>

                        <span
                          className={`flex items-center gap-1 ${index === 0 ? "text-amber-100" : "text-gray-400"
                            }`}
                        >
                          <Clock className="w-4 h-4" />
                          {getWaitingTime(client.joinedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {/* Botões de Reordenar */}
                    <div className="flex items-center mr-2 bg-black/20 rounded-lg">
                      <button
                        onClick={() => handleMove(client, "up")}
                        disabled={index === 0}
                        className="p-2 hover:text-amber-300 disabled:opacity-30 disabled:hover:text-inherit transition-colors"
                      >
                        <ArrowUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleMove(client, "down")}
                        disabled={index === queue.length - 1}
                        className="p-2 hover:text-amber-300 disabled:opacity-30 disabled:hover:text-inherit transition-colors"
                      >
                        <ArrowDown className="w-5 h-5" />
                      </button>
                    </div>

                    {client.phone && (
                      <button
                        onClick={() => handleResendMessage(client)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                        title="Reenviar mensagem WhatsApp"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    )}

                    {index === 0 && (
                      <button
                        onClick={handleComplete}
                        className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors"
                        title="Finalizar atendimento"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleRemove(client.id, client.name)}
                      className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                      title="Remover da fila"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Serviços */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newService.name}
                  onChange={(e) =>
                    setNewService({ ...newService, name: e.target.value })
                  }
                  placeholder="Nome do serviço"
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <input
                  type="number"
                  value={newService.duration}
                  onChange={(e) =>
                    setNewService({ ...newService, duration: e.target.value })
                  }
                  placeholder="Min"
                  className="w-20 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={handleAddService}
                  className="bg-amber-600 hover:bg-amber-700 text-white p-2 rounded-lg"
                >
                  <Plus className="w-6 h-6" />
                </button>
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
                        {service.duration} min
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
    </div>
  );
}
