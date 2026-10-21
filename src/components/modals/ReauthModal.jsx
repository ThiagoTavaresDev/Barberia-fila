import React, { useEffect, useState } from "react";
import { X, Lock } from "lucide-react";

// Pede a senha de novo antes de uma ação sensível (ex.: mudar a chave Pix, que redireciona dinheiro).
// `onConfirm(senha)` deve lançar um Error com a mensagem a mostrar quando algo falhar.
export default function ReauthModal({ show, title, message, confirmLabel = "Confirmar", onConfirm, onClose }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) { setPassword(""); setError(""); setLoading(false); }
    }, [show]);

    if (!show) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password) { setError("Digite sua senha."); return; }
        setLoading(true);
        setError("");
        try {
            await onConfirm(password);
        } catch (err) {
            setError(err?.message || "Não foi possível confirmar. Tente de novo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
            <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-2">
                            <Lock className="w-6 h-6 text-amber-500" />
                        </div>
                        <h3 className="text-xl font-bold text-ink">{title}</h3>
                        <p className="text-sm text-ink/80">{message}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={loading} aria-label="Fechar" className="text-ink/80 hover:text-white p-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div>
                    <label htmlFor="reauth-password" className="block text-ink font-medium text-sm mb-1">Sua senha</label>
                    <input
                        id="reauth-password"
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        autoComplete="current-password"
                        autoFocus
                        className={`w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 ${error ? "ring-2 ring-red-500 focus:ring-red-500" : "focus:ring-amber-500"}`}
                    />
                    {error && <p role="alert" className="text-red-400 text-sm mt-1">{error}</p>}
                </div>

                <div className="flex gap-3">
                    <button type="button" onClick={onClose} disabled={loading} className="flex-1 bg-gray-700 hover:bg-gray-600 text-ink font-semibold py-3 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" disabled={loading} className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors">
                        {loading ? "Confirmando..." : confirmLabel}
                    </button>
                </div>
            </form>
        </div>
    );
}
