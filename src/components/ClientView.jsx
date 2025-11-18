import React from 'react';
import { Scissors, Users, Clock } from 'lucide-react';
import { getClientPosition, getWaitingTime } from '../utils/helpers';

export default function ClientView({ queue, clientId, onBack }) {
  const position = clientId ? getClientPosition(queue, clientId) : 0;
  const client = queue.find(c => c.id === clientId);

  if (!clientId || position === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center space-y-6">
          <Scissors className="w-16 h-16 mx-auto text-amber-500" />
          <h2 className="text-2xl font-bold text-white">Cliente não encontrado</h2>
          <p className="text-gray-400">
            Você não está na fila ou seu atendimento já foi concluído.
          </p>
          <button
            onClick={onBack}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-gray-800 rounded-xl p-8 text-center space-y-6">
          <Scissors className="w-16 h-16 mx-auto text-amber-500" />
          <h2 className="text-3xl font-bold text-white">Olá, {client.name}!</h2>
          
          <div className="bg-gradient-to-r from-amber-600 to-amber-500 rounded-xl p-8">
            <p className="text-amber-100 text-sm uppercase tracking-wide mb-2">Sua posição na fila</p>
            <p className="text-6xl font-bold text-white">{position}º</p>
          </div>

          <div className="space-y-3 text-left">
            <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-amber-500" />
                <span className="text-gray-300">Pessoas na sua frente</span>
              </div>
              <span className="text-white font-bold">{position - 1}</span>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500" />
                <span className="text-gray-300">Tempo de espera</span>
              </div>
              <span className="text-white font-bold">{getWaitingTime(client.joinedAt)}</span>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-amber-500" />
                <span className="text-gray-300">Total na fila</span>
              </div>
              <span className="text-white font-bold">{queue.length}</span>
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">
              A fila é atualizada automaticamente. Mantenha esta página aberta para acompanhar sua posição em tempo real.
            </p>
          </div>

          {/* <button
            onClick={onBack}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Voltar
          </button> */}
        </div>
      </div>
    </div>
  );
}