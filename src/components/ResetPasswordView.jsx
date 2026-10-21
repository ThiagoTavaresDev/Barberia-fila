import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { evaluatePassword, maskEmail } from '../utils/password';
import { completePasswordReset, isCurrentPassword, verifyResetCode } from '../services/passwordReset';
import PasswordStrength from './PasswordStrength';

function PasswordInput({ id, label, value, onChange, show, onToggle, error, autoFocus, describedBy }) {
    return (
        <div>
            <label htmlFor={id} className="block text-ink font-medium mb-2">{label}</label>
            <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                    id={id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    autoComplete="new-password"
                    autoFocus={autoFocus}
                    aria-describedby={describedBy}
                    aria-invalid={!!error}
                    className={`w-full pl-10 pr-12 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 transition-all placeholder-gray-500 ${error ? 'ring-2 ring-red-500 focus:ring-red-500' : 'focus:ring-amber-500'}`}
                    placeholder="••••••••"
                />
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
                    className="absolute right-3 top-2.5 p-1 text-gray-400 hover:text-white"
                >
                    {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}

// Tela aberta pelo link do e-mail: confere o link e pede a senha nova duas vezes
export default function ResetPasswordView({ code }) {
    const [status, setStatus] = useState('checking'); // 'checking' | 'form' | 'invalid' | 'done'
    const [email, setEmail] = useState('');
    const [linkError, setLinkError] = useState(null);

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [sameAsCurrent, setSameAsCurrent] = useState(false);

    useEffect(() => {
        let cancelled = false;
        verifyResetCode(code)
            .then((accountEmail) => {
                if (cancelled) return;
                setEmail(accountEmail);
                setStatus('form');
            })
            .catch((err) => {
                if (cancelled) return;
                setLinkError(err);
                setStatus('invalid');
            });
        return () => { cancelled = true; };
    }, [code]);

    const evaluation = useMemo(() => evaluatePassword(password, { email }), [password, email]);
    const matches = confirm.length > 0 && password === confirm;
    const mismatch = confirm.length > 0 && password !== confirm;
    const canSubmit = evaluation.strong && matches && !submitting;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSubmitting(true);
        setError('');
        try {
            // Não aceita a senha que a pessoa já usa hoje
            if (await isCurrentPassword(email, password)) {
                setSameAsCurrent(true);
                setError('A nova senha não pode ser igual à senha atual. Escolha uma senha diferente.');
                return;
            }
            await completePasswordReset(code, password);
            setPassword('');
            setConfirm('');
            setStatus('done');
        } catch (err) {
            if (err.kind === 'expired' || err.kind === 'invalid') {
                setLinkError(err);
                setStatus('invalid');
            } else {
                setError(err.message || 'Não foi possível salvar a senha agora. Tente de novo.');
            }
        } finally {
            setSubmitting(false);
        }
    };

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
                <p className="text-ink">Verificando o link...</p>
            </div>
        );
    }

    if (status === 'invalid') {
        const expired = linkError?.kind === 'expired';
        return shell(
            <div className="text-center space-y-5">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-3xl font-bold text-ink">{expired ? 'Link expirado' : 'Link inválido'}</h2>
                <p className="text-ink">
                    {linkError?.message || 'Este link é inválido ou já foi usado. Peça um novo link para redefinir a senha.'}
                </p>
                <a
                    href="/forgot-password"
                    className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg"
                >
                    Pedir um novo link
                </a>
                <a href="/login" className="block text-sm text-amber-500 hover:text-amber-400 font-medium">Voltar ao login</a>
            </div>
        );
    }

    if (status === 'done') {
        return shell(
            <div className="text-center space-y-5">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-ink">Senha alterada!</h2>
                <p className="text-ink">Pronto. Agora é só entrar com a sua nova senha.</p>
                <a
                    href="/login?reset=ok"
                    className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg"
                >
                    Ir para o login
                </a>
            </div>
        );
    }

    return shell(
        <>
            <div className="text-center mb-6">
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="w-10 h-10 text-amber-500" />
                </div>
                <h2 className="text-3xl font-bold text-ink mb-2">Criar nova senha</h2>
                <p className="text-ink/80">
                    Conta: <strong className="text-ink">{maskEmail(email)}</strong>
                </p>
            </div>

            {error && (
                <div role="alert" className="bg-red-500/10 border border-red-500/30 text-ink p-3 rounded-lg mb-6 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Escondido: o gerenciador de senhas do navegador salva a senha nova junto com o e-mail da conta */}
                <input type="email" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />

                <PasswordInput
                    id="new-password"
                    label="Nova senha"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); setSameAsCurrent(false); }}
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    error={sameAsCurrent}
                    autoFocus
                    describedBy="password-rules"
                />

                <div id="password-rules">
                    <PasswordStrength evaluation={evaluation} hasValue={password.length > 0} />
                </div>

                <div>
                    <PasswordInput
                        id="confirm-password"
                        label="Confirmar nova senha"
                        value={confirm}
                        onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                        show={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                        error={mismatch}
                    />
                    {mismatch && <p role="alert" className="text-red-400 text-sm mt-1">As senhas não conferem.</p>}
                    {matches && <p className="text-ink text-sm mt-1">As senhas conferem ✓</p>}
                </div>

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {submitting ? 'Salvando...' : 'Salvar nova senha'}
                </button>
                {!canSubmit && !submitting && (
                    <p className="text-xs text-ink/80 text-center">
                        O botão libera quando a senha cumprir todas as regras e as duas senhas forem iguais.
                    </p>
                )}
            </form>

            <div className="mt-6 text-center">
                <a href="/login" className="text-sm text-amber-500 hover:text-amber-400 font-medium">Cancelar e voltar ao login</a>
            </div>
        </>
    );
}
