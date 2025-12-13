import React, { useState } from "react";
import { X, CheckCircle, Smartphone, Banknote, CreditCard } from "lucide-react";

export default function FinishServiceModal({ show, onClose, client, onConfirm }) {
    const [paymentMethod, setPaymentMethod] = useState("money");

    if (!show || !client) return null;

    const handleConfirm = () => {
        onConfirm(paymentMethod);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        Finalizar Atendimento
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="text-center">
                    <p className="text-gray-300">
                        Finalizar serviço de <span className="font-bold text-white">{client.name}</span>?
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        {client.serviceName} - R$ {client.servicePrice}
                    </p>
                </div>

                <div className="space-y-3">
                    <p className="text-sm text-gray-400 font-medium">Método de Pagamento:</p>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setPaymentMethod("pix")}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === "pix"
                                ? "border-green-500 bg-green-500/10 text-green-500"
                                : "border-gray-700 bg-gray-700 text-gray-400 hover:border-gray-600"
                                }`}
                        >
                            <Smartphone className="w-6 h-6" />
                            <span className="text-xs font-bold">Pix</span>
                        </button>
                        <button
                            onClick={() => setPaymentMethod("money")}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === "money"
                                ? "border-green-500 bg-green-500/10 text-green-500"
                                : "border-gray-700 bg-gray-700 text-gray-400 hover:border-gray-600"
                                }`}
                        >
                            <Banknote className="w-6 h-6" />
                            <span className="text-xs font-bold">Dinheiro</span>
                        </button>
                        <button
                            onClick={() => setPaymentMethod("card")}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === "card"
                                ? "border-green-500 bg-green-500/10 text-green-500"
                                : "border-gray-700 bg-gray-700 text-gray-400 hover:border-gray-600"
                                }`}
                        >
                            <CreditCard className="w-6 h-6" />
                            <span className="text-xs font-bold">Cartão</span>
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleConfirm}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <CheckCircle className="w-5 h-5" /> Confirmar e Finalizar
                </button>
            </div>
        </div>
    );
}
