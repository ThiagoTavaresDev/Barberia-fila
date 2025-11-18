import React from 'react';
import { Scissors, Users } from 'lucide-react';

export default function SelectView({ onSelectView }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-4">
          <Scissors className="w-20 h-20 mx-auto text-amber-500" />
          <h1 className="text-4xl font-bold text-white">Barbearia Elite</h1>
          <p className="text-gray-400">Sistema de Gerenciamento de Fila</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => onSelectView('barber')}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            <Scissors className="w-6 h-6" />
            Acesso do Barbeiro
          </button>
          
          <button
            onClick={() => onSelectView('client')}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            <Users className="w-6 h-6" />
            Visualizar Minha Posição
          </button>
        </div>
      </div>
    </div>
  );
}