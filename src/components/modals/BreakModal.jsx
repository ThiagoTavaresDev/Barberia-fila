import React from "react";
import { X, Coffee } from "lucide-react";
import { setBarberStatus, endBreak } from "../../services/barberStatus";

export default function BreakModal({ show, onClose, barberStatus, breakTimeRemaining, userId }) {
    if (!show) return null;

    const handleSetBreak = async (duration) => {
        await setBarberStatus(userId, 'on_break', duration);
        onClose();
    };

    const handleEndBreak = async () => {
        await endBreak(userId);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Gerenciar Pausa</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {barberStatus.status === 'on_break' ? (
                    <div className="space-y-4">
                        <div className="text-center p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                            <Coffee className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                            <h4 className="text-lg font-bold text-white mb-1">Em Pausa</h4>
                            {barberStatus.breakEndsAt ? (
                                <p className="text-amber-200">
                                    Retorno previsto em: {Math.ceil(breakTimeRemaining / 60000)} min
                                </p>
                            ) : (
                                <p className="text-amber-200">Tempo Indeterminado</p>
                            )}
                        </div>
                        <button
                            onClick={handleEndBreak}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors"
                        >
                            Voltar ao Trabalho
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-gray-300 text-sm">
                            Selecione o tipo de pausa que deseja realizar. Isso ficará visível para os clientes.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleSetBreak(15)}
                                className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-lg transition-colors"
                            >
                                15 min
                            </button>
                            <button
                                onClick={() => handleSetBreak(30)}
                                className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-lg transition-colors"
                            >
                                30 min
                            </button>
                            <button
                                onClick={() => handleSetBreak(60)}
                                className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-lg transition-colors"
                            >
                                1 hora
                            </button>
                            <button
                                onClick={() => handleSetBreak(null)}
                                className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-lg transition-colors"
                            >
                                Indefinido
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
