import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Printer, RefreshCw, Clock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  generateCheckinLink, buildCheckinUrl, formatTimeLeft, clampValidityHours,
  DEFAULT_VALIDITY_HOURS, MIN_VALIDITY_HOURS, MAX_VALIDITY_HOURS,
} from "../../services/checkinLink";

const HOUR_SHORTCUTS = [2, 4, 6, 8, 12, 24];

export default function QrModal({ show, onClose }) {
  const { user, patchUser } = useAuth();
  const link = user?.checkinLink;

  const [hours, setHours] = useState(String(link?.validityHours || DEFAULT_VALIDITY_HOURS));
  const [generating, setGenerating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const qrBoxRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [show]);

  if (!show) return null;

  const isActive = !!link && link.expiresAt > now;
  const checkInUrl = isActive ? buildCheckinUrl(user.id, link.token) : "";
  const expiresAtLabel = isActive
    ? new Date(link.expiresAt).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  const handleGenerate = async () => {
    const validityHours = clampValidityHours(hours);
    if (isActive && !window.confirm("Gerar um novo link vai invalidar o link e o QR Code atuais imediatamente. Continuar?")) {
      return;
    }
    setGenerating(true);
    try {
      const newLink = await generateCheckinLink(user.id, validityHours, user.shopName);
      patchUser({ checkinLink: newLink });
      setHours(String(validityHours));
      setNow(Date.now());
    } catch (error) {
      console.error("Erro ao gerar link de check-in:", error);
      alert("Erro ao gerar o link. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintQr = () => {
    const qrSvg = qrBoxRef.current?.innerHTML;
    if (!qrSvg) return;
    const printWindow = window.open('', '', 'width=600,height=600');
    if (!printWindow) {
      alert("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente de novo.");
      return;
    }
    const safeUrl = checkInUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    printWindow.document.write(`
          <html>
            <head>
              <title>QR Code - Auto Check-in</title>
              <style>
                body {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  font-family: sans-serif;
                }
                svg {
                  width: 400px;
                  max-width: 80%;
                  height: auto;
                }
                h1 {
                  margin-bottom: 20px;
                  color: #333;
                }
                p {
                  margin-top: 10px;
                  color: #666;
                  font-size: 1.2rem;
                }
                @media print {
                  button { display: none; }
                }
              </style>
            </head>
            <body onload="window.print();window.close()">
              <h1>Auto Check-in</h1>
              ${qrSvg}
              <p>Escaneie para entrar na fila</p>
              <p>${safeUrl}</p>
            </body>
          </html>
        `);
    printWindow.document.close();
  };


  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-6 text-center my-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-ink">Auto-Atendimento</h3>
          <button
            onClick={onClose}
            className="text-ink/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isActive ? (
          <>
            <div ref={qrBoxRef} className="bg-white p-4 rounded-lg inline-block leading-none">
              <QRCodeSVG value={checkInUrl} size={200} level="M" marginSize={0} bgColor="#ffffff" fgColor="#000000" title="QR Code Check-in" />
            </div>

            <p className="text-ink">
              Peça para o cliente escanear este código para entrar na fila sozinho.
            </p>

            <div className="flex items-center justify-center gap-2 text-ink text-sm">
              <Clock className="w-4 h-4" />
              Expira {expiresAtLabel} (faltam {formatTimeLeft(link.expiresAt - now)})
            </div>

            <div className="bg-gray-700 p-3 rounded-lg break-all text-sm text-ink/80">
              {checkInUrl}
            </div>
          </>
        ) : (
          <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 text-ink text-sm">
            {link
              ? "O link anterior expirou. Gere um novo link para os clientes voltarem a entrar na fila."
              : "Gere um link para os clientes entrarem na fila sozinhos. Cada link vale só pelo tempo que você definir."}
          </div>
        )}

        <div className="space-y-3 text-left">
          <label className="block text-ink font-medium text-sm">Validade do link (horas)</label>
          <input
            type="number"
            min={MIN_VALIDITY_HOURS}
            max={MAX_VALIDITY_HOURS}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex flex-wrap gap-2">
            {HOUR_SHORTCUTS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(String(h))}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${Number(hours) === h ? "bg-amber-600 text-white" : "bg-gray-700 text-ink hover:bg-gray-600"}`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-ink font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-5 h-5 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Gerando..." : isActive ? "Gerar novo link" : "Gerar link"}
        </button>

        {isActive && (
          <>
            <button
              onClick={handlePrintQr}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Imprimir QR Code
            </button>
            <p className="text-xs text-ink/70">
              O QR impresso só funciona até o link expirar.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
