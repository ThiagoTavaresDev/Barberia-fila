import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { confirmEmailVerification } from '../services/emailActions';

// Tela aberta por links de e-mail do Firebase que não são de redefinição de senha.
// Hoje trata a confirmação de e-mail (mode=verifyEmail); qualquer outro tipo mostra um aviso claro.
export default function EmailActionView({ mode, code }) {
    const supported = mode === 'verifyEmail';
    const [status, setStatus] = useState(supported ? 'checking' : 'invalid'); // 'checking' | 'done' | 'invalid'
    const [linkError, setLinkError] = useState(null);
    // O link só vale uma vez e o React (modo de desenvolvimento) roda o efeito duas vezes: confirma uma só
    const startedRef = useRef(false);

    useEffect(() => {
        if (!supported || startedRef.current) return;
        startedRef.current = true;
        confirmEmailVerification(code)
            .then(() => setStatus('done'))
            .catch((err) => {
                setLinkError(err);
                setStatus('invalid');
            });
    }, [supported, code]);

    const shell = (children) => (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700">
                {children}
            </div>
        </div>
    );

    if (status === 'checking') {
        return shell(
            <div className="text-center py-6">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-ink">Confirmando seu e-mail...</p>
            </div>
        );
    }

    if (status === 'done') {
        return shell(
            <div className="text-center space-y-5">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-ink">E-mail confirmado!</h2>
                <p className="text-ink">Pronto. Seu e-mail foi confirmado.</p>
                <a
                    href="/"
                    className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg"
                >
                    Entrar no sistema
                </a>
            </div>
        );
    }

    const offline = linkError?.kind === 'network';
    let title = 'Link inválido';
    if (!supported) title = 'Link não reconhecido';
    else if (linkError?.kind === 'expired') title = 'Link expirado';
    else if (offline) title = 'Sem conexão';

    return shell(
        <div className="text-center space-y-5">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-3xl font-bold text-ink">{title}</h2>
            <p className="text-ink">
                {supported
                    ? linkError?.message
                    : 'Este tipo de link não é aceito por aqui. Se precisar de ajuda, fale com o suporte.'}
            </p>
            {offline ? (
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg"
                >
                    Tentar de novo
                </button>
            ) : (
                <a
                    href="/"
                    className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg"
                >
                    Entrar no sistema
                </a>
            )}
        </div>
    );
}
