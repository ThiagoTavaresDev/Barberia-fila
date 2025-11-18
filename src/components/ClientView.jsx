import React from "react";
import { Users, Clock, User, Phone } from "lucide-react";
import { getWaitingTime } from "../utils/helpers";

export default function ClientView({ queue, clientId, onBack }) {
  const clientIndex = queue.findIndex((c) => c.id === clientId);
  const client = clientIndex >= 0 ? queue[clientIndex] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black p-4 flex justify-center">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-6 space-y-6">

        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors mb-4"
        >
          Voltar
        </button>

        <h1 className="text-3xl font-bold text-white text-center mb-6">
          Sua Posição na Fila
        </h1>

        {/* Cliente encontrado */}
        {client ? (
          <div className="space-y-4 text-white">
            <div className="bg-gray-700 p-4 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <User className="w-5 h-5 text-amber-500" />
                <span className="font-semibold">{client.name}</span>
              </div>

              <div className="flex items-center gap-3 mb-2">
                <Phone className="w-5 h-5 text-amber-500" />
                <span className="text-gray-300">{client.phone}</span>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500" />
                <span className="text-gray-300">
                  Esperando há: {getWaitingTime(client.joinedAt)}
                </span>
              </div>
            </div>

            <div className="bg-black p-4 rounded-xl text-center border border-gray-700">
              <p className="text-xl text-gray-400 mb-2">Sua posição é:</p>
              <p className="text-6xl font-bold text-amber-500">{clientIndex + 1}</p>
            </div>

            <div className="bg-gray-900 p-4 rounded-xl text-center">
              <div className="flex justify-center items-center gap-2 text-gray-400">
                <Users className="w-5 h-5" />
                <span>Total na fila: {queue.length}</span>
              </div>
            </div>
          </div>
        ) : (
          // Cliente não encontrado
          <div className="text-center text-gray-300 py-16">
            <Users className="w-16 h-16 mx-auto opacity-50 mb-4" />
            <p>Não foi possível encontrar seus dados na fila.</p>
            <p className="text-sm text-gray-500 mt-2">
              Talvez sua posição já tenha sido atendida.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
