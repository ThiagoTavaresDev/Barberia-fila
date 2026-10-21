import React from "react";
import { QRCodeSVG } from "qrcode.react";

// QR Code do Pix: sempre preto sobre branco e com a margem exigida pelo padrão (4 módulos),
// independente do tema, para qualquer app de banco conseguir ler.
export default function PixQr({ value, size = 208 }) {
    return (
        <div className="inline-block rounded-xl overflow-hidden border border-gray-300 shadow-sm leading-none">
            <QRCodeSVG
                value={value}
                size={size}
                level="M"
                marginSize={4}
                bgColor="#ffffff"
                fgColor="#000000"
                title="QR Code Pix"
            />
        </div>
    );
}
