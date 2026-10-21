import React, { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Mail, MailCheck } from 'lucide-react';
import { isValidEmail, requestPasswordReset } from '../services/passwordReset';

const RESEND_SECONDS = 60;

// Lembra quando o último e-mail foi enviado e para quem (a contagem sobrevive a um F5). A espera vale só
// para o MESMO e-mail: quem digitou errado consegue corrigir e enviar para o certo na hora.
const SENT_KEY = 'resetSent';
const normalize = (email) => String(email || '').trim().toLowerCase();
const readSecondsLeft = (email) => {
    try {
        const saved = JSON.parse(sessionStorage.getItem(SENT_KEY) || 'null');
        if (!saved || saved.email !== normalize(email)) return 0;
        return Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - saved.at) / 1000));
    } catch {
        return 0;
    }
};

export default function ForgotPasswordView() {
    const [email, setEmail] = useState(() => {
        // Se a pessoa já tinha digitado o e-mail na tela de login, ele vem preenchido
        try { return sessionStorage.getItem('resetEmail') || ''; } catch { return ''; }
    });
    const [status, setStatus] = useState('form'); // 'form' | 'sent'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(0);

    // Contagem regressiva do "Reenviar e-mail"
    useEffect(() => {
        if (secondsLeft <= 0) return undefined;
        const timer = setTimeout(() => setSecondsLeft(readSecondsLeft(email)), 1000);
        return () => clearTimeout(timer);
    }, [secondsLeft, email]);

    const send = async () => {
        const clean = email.trim();
        if (!isValidEmail(clean)) {
            setError('Digite um e-mail válido, como seu@email.com.');
            return false;
        }

        // Acabou de enviar para este e-mail (ex.: recarregou a página): mostra a tela de "enviado" sem enviar de novo
        const waiting = readSecondsLeft(clean);
        if (waiting > 0) {
            setSecondsLeft(waiting);
            setError('');
            setStatus('sent');
            return true;
        }

        setLoading(true);
        setError('');
        try {
            await requestPasswordReset(clean);
            try {
                sessionStorage.setItem(SENT_KEY, JSON.stringify({ at: Date.now(), email: normalize(clean) }));
            } catch { /* sem armazenamento: só não guarda a contagem */ }
            setSecondsLeft(RESEND_SECONDS);
            setStatus('sent');
            return true;
        } catch (err) {
            setError(err.message || 'Não foi possível enviar o e-mail agora. Tente de novo.');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        send();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700">
                {status === 'form' ? (
                    <>
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <KeyRound className="w-10 h-10 text-amber-500" />
                            </div>
                            <h2 className="text-3xl font-bold text-ink mb-2">Esqueceu sua senha?</h2>
                            <p className="text-ink/80">
                                Digite o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
                            </p>
                        </div>

                        {error && (
                            <div role="alert" className="bg-red-500/10 border border-red-500/30 text-ink p-3 rounded-lg mb-6 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                            <div>
                                <label htmlFor="forgot-email" className="block text-ink font-medium mb-2">E-mail</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input
                                        id="forgot-email"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="email"
                                        autoCapitalize="none"
                                        autoFocus
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                        className={`w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 transition-all placeholder-gray-500 ${error ? 'ring-2 ring-red-500 focus:ring-red-500' : 'focus:ring-amber-500'}`}
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50"
                            >
                                {loading ? 'Enviando...' : 'Enviar link'}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="text-center space-y-5">
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                            <MailCheck className="w-10 h-10 text-green-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-ink">Confira seu e-mail</h2>
                        <p className="text-ink">
                            Se existir uma conta com <strong>{email.trim()}</strong>, enviamos um link para criar uma nova senha.
                        </p>
                        <ul className="text-sm text-ink/80 text-left bg-gray-700 rounded-lg p-4 space-y-1.5">
                            <li>• O link vale por <strong className="text-ink">1 hora</strong> e só pode ser usado <strong className="text-ink">uma vez</strong>.</li>
                            <li>• Não achou? Olhe também a caixa de <strong className="text-ink">spam</strong>.</li>
                            <li>• Digitou o e-mail errado? Volte e envie de novo.</li>
                        </ul>

                        {error && (
                            <div role="alert" className="bg-red-500/10 border border-red-500/30 text-ink p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={send}
                            disabled={loading || secondsLeft > 0}
                            className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed text-ink font-semibold py-3 rounded-lg transition-colors"
                        >
                            {loading ? 'Enviando...' : secondsLeft > 0 ? `Reenviar e-mail em ${secondsLeft}s` : 'Reenviar e-mail'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setStatus('form'); setError(''); }}
                            className="text-sm text-ink/80 hover:text-ink font-medium underline"
                        >
                            Usar outro e-mail
                        </button>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <a href="/login" className="inline-flex items-center gap-1 text-sm text-amber-500 hover:text-amber-400 font-medium">
                        <ArrowLeft className="w-4 h-4" /> Voltar ao login
                    </a>
                </div>
            </div>
        </div>
    );
}
