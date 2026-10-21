import React, { useEffect, useState } from "react";
import { X, CheckCircle, Smartphone, Banknote, CreditCard, AlertTriangle, PiggyBank } from "lucide-react";
import { formatBRL } from "../../utils/pix";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Finalizar atendimento.
//   payment  pagamento Pix do cliente (se houver): confirmado trava o método em Pix
//   credit   crédito disponível do cliente (de um Pix de atendimento cancelado)
//   onConfirm(metodo, { creditDelta })   creditDelta < 0 desconta crédito; > 0 guarda sobra de Pix
export default function FinishServiceModal({ show, onClose, client, onConfirm, payment = null, credit = 0, onReview }) {
    const [paymentMethod, setPaymentMethod] = useState("money");
    const [useCredit, setUseCredit] = useState(false);

    const confirmed = payment?.status === "confirmed";

    useEffect(() => {
        if (show) {
            setPaymentMethod(confirmed ? "pix" : "money");
            setUseCredit(false);
        }
    }, [show, client?.id, confirmed]);

    if (!show || !client) return null;

    // Valores: o preço é o do serviço do cliente; nada é fixo
    const price = round2(client.servicePrice);
    const prepaid = confirmed ? round2(payment.receivedAmount) : 0;
    const creditAvailable = round2(credit);
    const creditUsed = useCredit ? Math.min(creditAvailable, Math.max(0, round2(price - prepaid))) : 0;
    const due = round2(price - prepaid - creditUsed);
    const toCollect = due > 0 ? due : 0;
    const surplus = due < 0 ? round2(-due) : 0;
    const surplusAsCredit = surplus > 0 && !!client.phone;
    const creditDelta = round2((surplusAsCredit ? surplus : 0) - creditUsed);
    const hasPixOrCredit = confirmed || creditUsed > 0;
    // O crédito (que veio de um Pix) cobre tudo: não há o que receber e o método não importa
    const coveredByCredit = !confirmed && creditUsed > 0 && toCollect === 0;

    const handleConfirm = () => {
        onConfirm(confirmed || coveredByCredit ? "pix" : paymentMethod, { creditDelta });
        onClose();
    };

    const methodButton = (id, Icon, label) => (
        <button
            onClick={() => setPaymentMethod(id)}
            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === id
                ? "border-green-500 bg-green-500/10 text-green-500"
                : "border-gray-700 bg-gray-700 text-gray-400 hover:border-gray-600"
                }`}
        >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-bold">{label}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full space-y-6 my-auto">
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

                {/* Pix adiantado */}
                {confirmed && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-1 text-center">
                        <p className="font-bold text-ink">Pago adiantado {formatBRL(prepaid)} ✓</p>
                        {toCollect > 0 && <p className="text-sm text-ink">Restante a receber agora: <strong>{formatBRL(toCollect)}</strong></p>}
                        {toCollect === 0 && surplus === 0 && <p className="text-sm text-ink/80">Nada a receber agora.</p>}
                        {surplus > 0 && (
                            <p className="text-sm text-ink">
                                Sobraram {formatBRL(surplus)}: {surplusAsCredit ? "viram crédito do cliente." : "devolva ao cliente (sem telefone, não dá para guardar crédito)."}
                            </p>
                        )}
                    </div>
                )}

                {/* Comprovante enviado e ainda não conferido */}
                {payment && !confirmed && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                        <p className="flex items-start gap-2 text-sm text-ink">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            {client.name} enviou um comprovante de Pix que você ainda não conferiu. Se finalizar assim, o comprovante é descartado.
                        </p>
                        {onReview && (
                            <button onClick={onReview} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg transition-colors">
                                Conferir comprovante
                            </button>
                        )}
                    </div>
                )}

                {/* Crédito do cliente */}
                {creditAvailable > 0 && round2(price - prepaid) > 0 && (
                    <label className="flex items-start gap-3 bg-gray-700 rounded-xl p-4 cursor-pointer">
                        <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} className="mt-1 accent-amber-600 w-4 h-4" />
                        <span className="text-sm text-ink">
                            <span className="flex items-center gap-1 font-semibold"><PiggyBank className="w-4 h-4 text-amber-500" /> Descontar crédito do cliente</span>
                            <span className="block text-ink/80">
                                Ele tem {formatBRL(creditAvailable)} de crédito.{useCredit && ` Desconta ${formatBRL(creditUsed)}; resta receber ${formatBRL(toCollect)}.`}
                            </span>
                        </span>
                    </label>
                )}

                {coveredByCredit && (
                    <p className="text-sm text-ink text-center bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                        Nada a receber agora: o crédito cobre o serviço.
                    </p>
                )}

                {/* Método de pagamento (travado em Pix quando já foi pago adiantado) */}
                {!confirmed && !coveredByCredit && (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-400 font-medium">Método de Pagamento:</p>
                        <div className="grid grid-cols-3 gap-3">
                            {methodButton("pix", Smartphone, "Pix")}
                            {methodButton("money", Banknote, "Dinheiro")}
                            {methodButton("card", CreditCard, "Cartão")}
                        </div>
                        {hasPixOrCredit && toCollect > 0 && (
                            <p className="text-sm text-ink text-center">Receba agora: <strong>{formatBRL(toCollect)}</strong></p>
                        )}
                    </div>
                )}

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
