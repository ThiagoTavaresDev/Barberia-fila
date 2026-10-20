import React from "react";
import { Scissors } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// Logo da barbearia no lugar da tesoura. Sem logo configurada, mostra a tesoura padrão.
//
//   variant="inline" → ícone solto (cabeçalhos)
//   variant="badge"  → ícone dentro de um círculo translúcido (telas de cartão)
//
// `size` é a classe de tamanho do contêiner (ex.: "w-20 h-20"); `iconSize` a do ícone da tesoura.
export default function BrandLogo({ variant = "inline", size = "w-8 h-8", iconSize, className = "", alt = "Logo" }) {
    const { logoUrl } = useTheme();

    if (logoUrl) {
        return (
            <img
                src={logoUrl}
                alt={alt}
                className={`${size} rounded-xl object-cover shrink-0 ${className}`}
            />
        );
    }

    if (variant === "badge") {
        return (
            <div className={`${size} bg-amber-500/10 rounded-full flex items-center justify-center shrink-0 ${className}`}>
                <Scissors className={`${iconSize || "w-10 h-10"} text-amber-500`} />
            </div>
        );
    }

    return <Scissors className={`${size} text-amber-500 shrink-0 ${className}`} />;
}
