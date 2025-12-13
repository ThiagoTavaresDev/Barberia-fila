import React from "react";
import { X, Printer } from "lucide-react";

export default function QrModal({ show, onClose, checkInUrl }) {
  if (!show) return null;

  const handlePrintQr = () => {
    const printWindow = window.open('', '', 'width=600,height=600');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(checkInUrl)}`;

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
                img {
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
            <body>
              <h1>Auto Check-in</h1>
              <img src="${qrUrl}" onload="window.print();window.close()" />
              <p>Escaneie para entrar na fila</p>
              <p>${checkInUrl}</p>
            </body>
          </html>
        `);
    printWindow.document.close();
  };


  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-6 text-center">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Auto-Atendimento</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg inline-block">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkInUrl)}`}
            alt="QR Code Check-in"
          />
        </div>

        <p className="text-gray-300">
          Peça para o cliente escanear este código para entrar na fila sozinho.
        </p>

        <div className="bg-gray-700 p-3 rounded-lg break-all text-sm text-gray-400">
          {checkInUrl}
        </div>

        <button
          onClick={handlePrintQr}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Printer className="w-5 h-5" />
          Imprimir QR Code
        </button>
      </div>
    </div>
  );
}
