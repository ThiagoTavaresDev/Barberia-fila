import React, { useMemo, useRef, useState } from "react";
import {
    AlertCircle, Camera, Check, CheckCircle2, ChevronDown, Clock, Copy, MessageCircle, Send,
    Share2, ShieldCheck, Wallet, X,
} from "lucide-react";
import PixQr from "./PixQr";
import { submitReceipt, DEFAULT_PIX_POLICY } from "../services/pixService";
import { buildPixPayload, formatBRL, isPixReady, pixTxid, sanitizePixCity, sanitizePixName } from "../utils/pix";
import { compressImage } from "../utils/imageUtils";
import { generateWhatsAppLink } from "../utils/helpers";

const MSG_BAD_IMAGE = "Imagem inválida ou grande demais. Envie um print em JPG ou PNG.";
const MSG_OFFLINE = "Sem internet. Tente de novo.";
const MSG_DENIED = "Não foi possível enviar agora. Atualize a página e tente de novo; se continuar, mostre o comprovante ao barbeiro.";

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

async function dataUrlToFile(dataUrl, name) {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Sem permissão da área de transferência: tenta o método antigo
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch { ok = false; }
        document.body.removeChild(area);
        return ok;
    }
}

// Pagamento adiantado por Pix na tela de acompanhamento do cliente.
//   client   entrada dele na fila (o valor é SEMPRE o preço do serviço escolhido: client.servicePrice)
//   config   configuração do Pix da barbearia (undefined = carregando, null = não configurou)
//   payment  pagamento dele (undefined = carregando, null = ainda não enviou comprovante)
export default function PixPaymentCard({ barberId, client, clientKey, position, config, payment }) {
    const [open, setOpen] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const [copied, setCopied] = useState(false);
    const [receiptImage, setReceiptImage] = useState(null);
    const [preparing, setPreparing] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [sentFile, setSentFile] = useState(null); // comprovante enviado nesta sessão (para compartilhar)
    const fileInputRef = useRef(null);

    const price = Math.round((Number(client?.servicePrice) || 0) * 100) / 100;
    const ready = isPixReady(config);
    const status = payment?.status;
    const hasActivePayment = status === "receipt_sent" || status === "confirmed" || status === "rejected";

    // Código Pix com o valor do serviço escolhido; recalculado se o preço mudar
    const payload = useMemo(() => {
        if (!ready || price <= 0 || !client?.id) return "";
        try {
            return buildPixPayload({
                key: config.key,
                name: config.receiverName,
                city: config.city,
                amount: price,
                txid: pixTxid(client.id),
                description: `Fila ${firstName(client.name)}`,
            });
        } catch (e) {
            console.error("Erro ao gerar o código Pix:", e);
            return "";
        }
    }, [ready, config, price, client?.id, client?.name]);

    if (!clientKey || payment === undefined || config === undefined) return null;
    // Sem pagamento: só oferece se o Pix está ativo, o serviço tem preço e o cliente ainda não é o da vez
    if (!hasActivePayment && (!payload || position === 1)) return null;

    const canPay = !!payload;
    const paidAmount = Number(payment?.receivedAmount) > 0 ? Number(payment.receivedAmount) : price;
    const policy = config?.policyText || DEFAULT_PIX_POLICY;
    const recipient = ready ? `${sanitizePixName(config.receiverName)} · ${sanitizePixCity(config.city)}` : "";

    const waMessage = `Olá! Sou ${client?.name}. Paguei ${formatBRL(price)} por Pix (${client?.serviceName}) e enviei o comprovante pelo link da fila.`;
    const waLink = config?.whatsapp ? generateWhatsAppLink(config.whatsapp, waMessage) : null;
    const canShareFile = !!(sentFile && typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [sentFile] }));

    const closeSheet = () => {
        if (sending) return;
        setOpen(false);
        setError("");
    };

    const handleCopy = async () => {
        const ok = await copyText(payload);
        if (!ok) { setError("Não deu para copiar. Toque em \"Mostrar QR Code\" ou selecione o código manualmente."); return; }
        setError("");
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    const handlePickFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // permite escolher o mesmo arquivo de novo
        if (!file) return;
        setError("");
        if (!file.type.startsWith("image/") || file.size > 25 * 1024 * 1024) {
            setError(MSG_BAD_IMAGE);
            return;
        }
        setPreparing(true);
        try {
            setReceiptImage(await compressImage(file, 0.55, { maxDimension: 1400 }));
        } catch {
            setError(MSG_BAD_IMAGE);
        } finally {
            setPreparing(false);
        }
    };

    const handleSend = async () => {
        if (!receiptImage || sending) return;
        setSending(true);
        setError("");
        try {
            await submitReceipt(barberId, client.id, clientKey, receiptImage, { resend: status === "rejected" });
            try { setSentFile(await dataUrlToFile(receiptImage, "comprovante.jpg")); } catch { setSentFile(null); }
            setReceiptImage(null);
            setOpen(false);
        } catch (err) {
            console.error("Erro ao enviar comprovante:", err);
            if (err?.code === "unavailable" || (typeof navigator !== "undefined" && navigator.onLine === false)) setError(MSG_OFFLINE);
            else setError(MSG_DENIED);
        } finally {
            setSending(false);
        }
    };

    const handleShare = async () => {
        try {
            await navigator.share({ files: [sentFile], text: waMessage });
        } catch {
            // o cliente fechou a janela de compartilhar: nada a fazer
        }
    };

    // ------------------------------------------------------------ cartão na tela

    let card;
    if (status === "confirmed") {
        card = (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-left flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                <div>
                    <p className="font-bold text-ink">Pagamento confirmado ✓</p>
                    <p className="text-sm text-ink/80">Você já pagou {formatBRL(paidAmount)}. É só chegar na sua vez.</p>
                </div>
            </div>
        );
    } else if (status === "receipt_sent") {
        card = (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-left space-y-3">
                <div className="flex items-start gap-3">
                    <Clock className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-ink">Comprovante enviado!</p>
                        <p className="text-sm text-ink/80">O barbeiro vai conferir. Você não perde sua vez.</p>
                    </div>
                </div>
                {(waLink || canShareFile) && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        {waLink && (
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-ink font-semibold py-2.5 rounded-lg transition-colors text-sm"
                            >
                                <MessageCircle className="w-4 h-4" /> Avisar no WhatsApp
                            </a>
                        )}
                        {canShareFile && (
                            <button
                                type="button"
                                onClick={handleShare}
                                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-ink font-semibold py-2.5 rounded-lg transition-colors text-sm"
                            >
                                <Share2 className="w-4 h-4" /> Compartilhar comprovante
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    } else if (status === "rejected") {
        card = (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-left space-y-3">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-ink">Não encontramos esse pagamento.</p>
                        <p className="text-sm text-ink/80">
                            {canPay
                                ? `Confira o valor (${formatBRL(price)}) e envie outro comprovante, ou pague na barbearia.`
                                : "Você pode pagar na barbearia."}
                        </p>
                    </div>
                </div>
                {canPay && (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        Enviar outro comprovante
                    </button>
                )}
            </div>
        );
    } else {
        card = (
            <div className="bg-gray-700 border border-amber-500/30 rounded-lg p-4 text-left space-y-3">
                <div className="flex items-start gap-3">
                    <Wallet className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-ink">Quer adiantar o pagamento?</p>
                        <p className="text-sm text-ink/80">
                            Pague {client?.serviceName} agora por Pix e só chegue na sua vez. É opcional.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors"
                >
                    Pagar {formatBRL(price)} com Pix
                </button>
            </div>
        );
    }

    // ------------------------------------------------------------ janela "Pagar com Pix"

    const step = (n, title, children) => (
        <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-600 text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</div>
            <div className="flex-1 space-y-2">
                <p className="font-semibold text-ink">{title}</p>
                {children}
            </div>
        </div>
    );

    const sheet = open && canPay && (
        <div
            className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Pagar com Pix"
            onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}
        >
            <div className="bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto text-left">
                <div className="flex items-center justify-between p-5 pb-3">
                    <h3 className="text-xl font-bold text-ink">Pagar com Pix</h3>
                    <button type="button" onClick={closeSheet} aria-label="Fechar" className="text-ink/80 hover:text-white p-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="px-5 pb-6 space-y-5">
                    <div className="bg-gray-700 rounded-xl p-4 text-center space-y-1">
                        <p className="text-sm text-ink/80">{client?.serviceName}</p>
                        <p className="text-4xl font-extrabold text-ink">{formatBRL(price)}</p>
                        <p className="text-xs text-ink/80">Para {recipient}</p>
                    </div>

                    {step(1, "Copie o código", (
                        <>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-lg transition-colors ${copied ? "bg-green-600 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}`}
                            >
                                {copied ? <><Check className="w-5 h-5" /> Código copiado ✓</> : <><Copy className="w-5 h-5" /> Copiar código Pix</>}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowQr((v) => !v)}
                                aria-expanded={showQr}
                                className="flex items-center gap-1 text-sm text-ink/80 hover:text-ink font-medium"
                            >
                                Pagar por outro aparelho (QR Code)
                                <ChevronDown className={`w-4 h-4 transition-transform ${showQr ? "rotate-180" : ""}`} />
                            </button>
                            {showQr && (
                                <div className="text-center space-y-2">
                                    <PixQr value={payload} size={200} />
                                    <p className="text-xs text-ink/80">Escaneie com o app do seu banco.</p>
                                </div>
                            )}
                        </>
                    ))}

                    {step(2, "Pague no app do seu banco", (
                        <p className="text-sm text-ink/80">
                            Abra o app → <strong className="text-ink">Pix</strong> → <strong className="text-ink">Pix Copia e Cola</strong> → cole o código e confirme o valor de {formatBRL(price)}.
                        </p>
                    ))}

                    {step(3, "Envie o comprovante", (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePickFile}
                            />
                            {receiptImage ? (
                                <div className="space-y-3">
                                    <img src={receiptImage} alt="Comprovante escolhido" className="max-h-52 mx-auto rounded-lg border border-gray-600" />
                                    <button
                                        type="button"
                                        onClick={handleSend}
                                        disabled={sending}
                                        className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
                                    >
                                        <Send className="w-5 h-5" /> {sending ? "Enviando..." : "Enviar comprovante"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={sending}
                                        className="w-full text-sm text-ink/80 hover:text-ink font-medium py-1"
                                    >
                                        Trocar foto
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={preparing}
                                        className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 border-2 border-dashed border-gray-600 text-ink font-semibold py-3 rounded-lg transition-colors"
                                    >
                                        <Camera className="w-5 h-5" /> {preparing ? "Preparando..." : "Escolher foto do comprovante"}
                                    </button>
                                    <p className="text-xs text-ink/80">Tire um print da tela de comprovante do seu banco.</p>
                                </>
                            )}
                        </>
                    ))}

                    {error && (
                        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-ink flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <p className="text-xs text-ink/80 flex items-start gap-2 pt-1">
                        <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>{policy}</span>
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {card}
            {sheet}
        </>
    );
}
