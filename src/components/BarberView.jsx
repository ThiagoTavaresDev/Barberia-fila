import React, { useState } from "react";
import {
  Scissors,
  Users,
  Trash2,
  CheckCircle,
  Clock,
  User,
  Phone,
} from "lucide-react";
import {
  getWaitingTime,
  generateWhatsAppMessage,
  generateWhatsAppLink,
} from "../utils/helpers";
import {
  addClient,
  removeClient,
  completeFirst,
} from "../services/queueService";

const BARBER_PASSWORD = "1234";

export default function BarberView({ queue, onBack }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [barberPassword, setBarberPassword] = useState("");
  const [newClient, setNewClient] = useState({ name: "", phone: "" });

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
    if (!newClient.phone.trim() || newClient.phone.length < 10) {
      alert("Por favor, insira um número de telefone válido");
      return;
    }

    // Adicionar no Firestore
    const { id } = await addClient(newClient);

    const position = queue.length + 1;
    const clientLink = `${window.location.origin}?client=${id}`;
    const message = generateWhatsAppMessage(
      { id, ...newClient },
      position,
      clientLink
    );

    const whatsappLink = generateWhatsAppLink(newClient.phone, message);

    // Abre o WhatsApp diretamente
    window.open(whatsappLink, "_blank");

    // Limpar inputs
    setNewClient({ name: "", phone: "" });
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

            {/* <button
              onClick={onBack}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Voltar
            </button> */}
          </div>

          <p className="text-sm text-gray-500 text-center">
            Senha padrão: 1234
          </p>
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

            <button
              onClick={() => {
                setIsAuthenticated(false);
                onBack();
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Sair
            </button>
          </div>

          <div className="flex items-center gap-6 text-gray-300">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <span className="font-semibold">{queue.length}</span>
              <span>na fila</span>
            </div>
          </div>
        </div>

        {/* Adicionar cliente */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Adicionar Cliente à Fila
          </h2>
          <div className="space-y-4">
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
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) =>
                    setNewClient({ ...newClient, phone: e.target.value })
                  }
                  placeholder="(11) 99999-9999"
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <button
              onClick={handleAddClient}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-colors"
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
                  className={`p-4 rounded-lg flex items-center justify-between ${
                    index === 0 ? "bg-amber-600" : "bg-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        index === 0
                          ? "bg-amber-700 text-white"
                          : "bg-gray-600 text-gray-300"
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div>
                      <p
                        className={`font-semibold ${
                          index === 0 ? "text-white" : "text-gray-200"
                        }`}
                      >
                        {client.name}
                      </p>

                      <div className="flex items-center gap-4 text-sm">
                        <span
                          className={
                            index === 0 ? "text-amber-100" : "text-gray-400"
                          }
                        >
                          {client.phone}
                        </span>

                        <span
                          className={`flex items-center gap-1 ${
                            index === 0 ? "text-amber-100" : "text-gray-400"
                          }`}
                        >
                          <Clock className="w-4 h-4" />
                          {getWaitingTime(client.joinedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
    </div>
  );
}
