import React, { useEffect, useState } from "react";
import { X, Undo2, PiggyBank, AlertTriangle, MessageCircle } from "lucide-react";
import { formatBRL } from "../../utils/pix";

// Cancelar/remover um cliente que já pagou por Pix: o barbeiro decide o destino do valor
// (nada some sem decisão registrada). Se o comprovante ainda não foi conferido, oferece conferir.
//   onConfirm(outcome, { notify })   outcome = "refunded" | "credit" (null = descartar sem conferir)
export default function PrepaidResolutionModal({ show, onClose, entry, payment, onConfirm, onReview }) {
    const [outcome, setOutcome] = useState("");
    const [notify, setNotify] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (show) { setOutcome(""); setNotify(false); setBusy(false); setError(""); }
    }, [show, payment?.id]);

    if (!show || !entry || !payment) return null;

    const confirmed = payment.status === "confirmed";
    const amount = Number(payment.receivedAmount) || 0;
    const canCredit = !!entry.phone;

    const submit = async (chosen) => {
        setBusy(true);
        setError("");
        try {
            await onConfirm(chosen, { notify: notify && !!entry.phone });
        } catch (e) {
            console.error("Erro ao cancelar o atendimento:", e);
            setError(e?.message?.startsWith("Escolha") || e?.message?.startsWith("Cliente sem") ? e.message : "Não foi possível cancelar agora. Confira sua internet e tente de novo.");
            setBusy(false);
        }
    };

    const option = (id, Icon, title, text, disabled = false) => (
        <label
            key={id}
            className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${disabled ? "opacity-50 cursor-not-allowed border-gray-600" : outcome === id ? "border-amber-500 bg-amber-500/10" : "border-gray-600 hover:border-gray-500"}`}
        >
            <input
                type="radio"
                name="pix-outcome"
                value={id}
                checked={outcome === id}
                disabled={disabled}
                onChange={() => { setOutcome(id); setError(""); }}
                className="mt-1 accent-amber-600"
            />
            <Icon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <span>
                <span className="block font-semibold text-ink">{title}</span>
                <span className="block text-sm text-ink/80">{text}</span>
            </span>
        </label>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Pix do cliente">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-5 my-auto shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    {confirmed ? (
                        <div>
                            <h3 className="text-xl font-bold text-ink">{entry.name} já pagou {formatBRL(amount)} por Pix</h3>
                            <p className="text-sm text-ink/80 mt-1">Como tratar esse valor ao cancelar o atendimento?</p>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-xl font-bold text-ink">Comprovante ainda não conferido</h3>
                            <p className="text-sm text-ink/80 mt-1">{entry.name} enviou um comprovante de Pix que você ainda não conferiu.</p>
                        </div>
                    )}
                    <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar" className="text-ink/80 hover:text-white p-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {confirmed ? (
                    <>
                        <div className="space-y-3" role="radiogroup" aria-label="Destino do valor">
                            {option("refunded", Undo2, "Devolvi o dinheiro", "Você fez o Pix de volta. Fica registrado como devolvido.")}
                            {option("credit", PiggyBank, "Guardar como crédito", canCredit
                                ? "O valor fica no cadastro do cliente e é descontado no próximo atendimento."
                                : "Este cliente não tem telefone cadastrado, então não dá para guardar crédito.", !canCredit)}
                        </div>

                        {entry.phone && (
                            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-amber-600 w-4 h-4" />
                                <MessageCircle className="w-4 h-4 text-amber-500" /> Avisar o cliente no WhatsApp
                            </label>
                        )}

                        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} disabled={busy} className="flex-1 bg-gray-700 hover:bg-gray-600 text-ink font-semibold py-3 rounded-lg transition-colors">Voltar</button>
                            <button
                                type="button"
                                onClick={() => (outcome ? submit(outcome) : setError("Escolha o que fazer com o valor pago."))}
                                disabled={busy}
                                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
                            >
                                {busy ? "Cancelando..." : "Confirmar e cancelar"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="flex items-start gap-2 text-sm text-ink bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            Se cancelar sem conferir, o comprovante é descartado e o cliente não é avisado.
                        </p>
                        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
                        <div className="space-y-2">
                            <button type="button" onClick={onReview} disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors">Conferir comprovante</button>
                            <button type="button" onClick={() => submit(null)} disabled={busy} className="w-full bg-gray-700 hover:bg-gray-600 text-ink font-semibold py-3 rounded-lg transition-colors">
                                {busy ? "Cancelando..." : "Cancelar mesmo assim"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
