import React, { useEffect, useState } from "react";
import { X, CheckCircle, XCircle, AlertTriangle, ImageOff, Trash2 } from "lucide-react";
import { confirmPayment, deleteReceipt, getReceipt, markPixReceived, rejectPayment } from "../../services/pixService";
import { formatBRL, parseMoneyInput } from "../../utils/pix";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const plain = (n) => round2(n).toFixed(2).replace(".", ",");

// Conferência de um pagamento Pix: o barbeiro olha o comprovante, confere no banco e confirma
// (ou recusa). Sem `payment`, é o registro manual de um Pix recebido sem comprovante.
// O valor sugerido é o preço do serviço do cliente; o "recebido" é sempre digitado pelo barbeiro.
export default function PaymentReviewModal({ show, onClose, userId, entry, payment }) {
    const [image, setImage] = useState(undefined); // undefined = carregando, null = sem imagem
    const [amountText, setAmountText] = useState("");
    const [busy, setBusy] = useState(null); // "confirm" | "reject" | "delete"
    const [error, setError] = useState("");
    const [zoom, setZoom] = useState(false);

    const price = round2(entry?.servicePrice);
    const status = payment?.status;
    const confirmed = status === "confirmed";

    useEffect(() => {
        if (!show || !entry) return undefined;
        setError("");
        setBusy(null);
        setZoom(false);
        setAmountText(plain(payment?.receivedAmount > 0 ? payment.receivedAmount : price));
        if (!payment) { setImage(null); return undefined; }

        let cancelled = false;
        setImage(undefined);
        getReceipt(userId, payment.id)
            .then((img) => { if (!cancelled) setImage(img); })
            .catch((e) => { console.error("Erro ao abrir o comprovante:", e); if (!cancelled) setImage(null); });
        return () => { cancelled = true; };
    }, [show, entry?.id, payment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!show || !entry) return null;

    const amount = parseMoneyInput(amountText);
    const amountValid = Number.isFinite(amount) && amount > 0;
    const diff = amountValid ? round2(amount - price) : 0;

    const run = async (kind, action) => {
        setBusy(kind);
        setError("");
        try {
            await action();
            onClose();
        } catch (e) {
            console.error("Erro no pagamento Pix:", e);
            setError("Não foi possível salvar agora. Confira sua internet e tente de novo.");
            setBusy(null);
        }
    };

    const handleConfirm = () => {
        if (!amountValid) { setError("Digite o valor que caiu na sua conta, ex.: 40,00."); return; }
        run("confirm", () => (payment ? confirmPayment(userId, payment, amount) : markPixReceived(userId, entry.id, amount)));
    };

    const handleReject = () => run("reject", () => rejectPayment(userId, payment));

    const handleDeleteImage = async () => {
        if (!window.confirm("Apagar a imagem do comprovante? Isso não pode ser desfeito.")) return;
        setBusy("delete");
        try { await deleteReceipt(userId, payment.id); setImage(null); }
        catch (e) { console.error(e); setError("Não foi possível apagar agora. Tente de novo."); }
        finally { setBusy(null); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Conferir pagamento">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-5 my-auto shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-xl font-bold text-ink">{payment ? "Conferir pagamento" : "Registrar Pix recebido"}</h3>
                        <p className="text-sm text-ink/80">{entry.name} · {entry.serviceName}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={!!busy} aria-label="Fechar" className="text-ink/80 hover:text-white p-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Comprovante */}
                {payment ? (
                    image === undefined ? (
                        <div className="bg-gray-700 rounded-lg h-40 flex items-center justify-center text-ink/80 text-sm">Abrindo o comprovante...</div>
                    ) : image ? (
                        <button type="button" onClick={() => setZoom(true)} className="block w-full bg-gray-700 rounded-lg p-2" aria-label="Ampliar o comprovante">
                            <img src={image} alt="Comprovante enviado pelo cliente" className="max-h-72 mx-auto object-contain rounded" />
                            <span className="block text-xs text-ink/80 mt-1">Toque para ampliar</span>
                        </button>
                    ) : (
                        <div className="bg-gray-700 rounded-lg p-4 flex items-center gap-3 text-sm text-ink/80">
                            <ImageOff className="w-5 h-5 shrink-0" /> Sem imagem do comprovante.
                        </div>
                    )
                ) : (
                    <p className="text-sm text-ink bg-gray-700 rounded-lg p-3">
                        Sem comprovante: confirme só se o dinheiro já caiu na sua conta.
                    </p>
                )}

                {/* Valores */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-3">
                        <span className="text-sm text-ink/80">Valor do serviço</span>
                        <span className="font-bold text-ink">{formatBRL(price)}</span>
                    </div>

                    {confirmed ? (
                        <p className="text-sm text-ink bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                            Pagamento confirmado: <strong>{formatBRL(payment.receivedAmount)}</strong> recebidos.
                        </p>
                    ) : (
                        <div>
                            <label htmlFor="pix-received" className="block text-ink font-medium text-sm mb-1">Valor que caiu na sua conta (R$)</label>
                            <input
                                id="pix-received"
                                type="text"
                                inputMode="decimal"
                                value={amountText}
                                onChange={(e) => { setAmountText(e.target.value); setError(""); }}
                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            {amountValid && diff < 0 && <p className="text-sm text-ink mt-1">Faltam {formatBRL(-diff)}: cobre ao finalizar.</p>}
                            {amountValid && diff > 0 && (
                                <p className="text-sm text-ink mt-1">
                                    Sobram {formatBRL(diff)}: {entry.phone ? "viram crédito do cliente ao finalizar." : "devolva ao cliente ao finalizar (ele não tem telefone cadastrado)."}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {!confirmed && (
                    <p className="flex items-start gap-2 text-sm text-ink bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        Confirme no app do seu banco. Print de comprovante pode ser falso.
                    </p>
                )}

                {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

                {/* Ações: cada botão diz o que acontece */}
                {confirmed ? (
                    <div className="space-y-2">
                        {image && (
                            <button type="button" onClick={handleDeleteImage} disabled={!!busy} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-ink font-semibold py-3 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" /> Apagar imagem do comprovante
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors">Fechar</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={!!busy}
                                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
                            >
                                <CheckCircle className="w-5 h-5" /> {busy === "confirm" ? "Confirmando..." : "Confirmar pagamento"}
                            </button>
                            <p className="text-xs text-ink/80 mt-1 text-center">O cliente vê "Pagamento confirmado".</p>
                        </div>
                        {payment && status !== "rejected" && (
                            <div>
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    disabled={!!busy}
                                    className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-ink font-semibold py-3 rounded-lg transition-colors"
                                >
                                    <XCircle className="w-5 h-5" /> {busy === "reject" ? "Avisando..." : "Não recebi"}
                                </button>
                                <p className="text-xs text-ink/80 mt-1 text-center">O cliente é avisado e pode enviar outro comprovante ou pagar no local.</p>
                            </div>
                        )}
                        {status === "rejected" && (
                            <p className="text-xs text-ink/80 text-center">Você marcou "não recebi". O cliente já foi avisado e pode reenviar.</p>
                        )}
                    </div>
                )}
            </div>

            {zoom && image && (
                <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4" onClick={() => setZoom(false)}>
                    <img src={image} alt="Comprovante ampliado" className="max-w-full max-h-full rounded-lg" />
                </div>
            )}
        </div>
    );
}
