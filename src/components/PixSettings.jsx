import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Copy, QrCode, Save, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getPixConfig, savePixConfig, DEFAULT_PIX_POLICY } from "../services/pixService";
import {
    PIX_CITY_MAX, PIX_KEY_TYPES, PIX_NAME_MAX, buildPixPayload, guessPixKeyType, normalizePixKey,
    sanitizePixCity, sanitizePixName, sanitizePixText,
} from "../utils/pix";
import { formatPhoneBR, phoneDigits, validatePhoneBR } from "../utils/phone";
import PixQr from "./PixQr";
import ReauthModal from "./modals/ReauthModal";

const KEY_HINTS = {
    cpf: "Digite os 11 números do CPF.",
    cnpj: "Digite os 14 caracteres do CNPJ (letras e números).",
    phone: "O celular cadastrado como chave no banco, com DDD.",
    email: "O mesmo e-mail cadastrado como chave no banco.",
    random: "Copie a chave aleatória do app do seu banco (ex.: 123e4567-e12b-12d1-a456-426655440000).",
};
const KEY_LABEL = { cpf: "CPF", cnpj: "CNPJ", phone: "celular", email: "e-mail", random: "aleatória" };

// Máscaras só para mostrar a chave salva de forma legível
function formatKeyForInput(type, key) {
    if (!key) return "";
    if (type === "cpf" && /^\d{11}$/.test(key)) return key.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (type === "cnpj" && /^[0-9A-Z]{12}\d{2}$/.test(key)) return key.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
    if (type === "phone" && key.startsWith("+55")) return formatPhoneBR(key.slice(3));
    return key;
}

const whatsappForInput = (stored) => (stored ? formatPhoneBR(String(stored).replace(/^55/, "")) : "");

const emptyForm = (shopName) => ({
    enabled: false,
    keyType: "random",
    key: "",
    receiverName: sanitizePixText(shopName || "", PIX_NAME_MAX), // começa com o nome da barbearia (sem acento)
    city: "",
    whatsapp: "",
    policyText: DEFAULT_PIX_POLICY,
});

export default function PixSettings() {
    const { user, reauthenticate } = useAuth();
    const [saved, setSaved] = useState(undefined); // undefined = carregando, null = nunca configurou
    const [form, setForm] = useState(() => emptyForm(user?.shopName));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState(null); // { type: "ok" | "error", text }
    const [pending, setPending] = useState(null); // config aguardando a senha
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!user?.id) return undefined;
        let cancelled = false;
        getPixConfig(user.id)
            .then((cfg) => {
                if (cancelled) return;
                setSaved(cfg);
                if (cfg) {
                    setForm({
                        enabled: !!cfg.enabled,
                        keyType: cfg.keyType || "random",
                        key: formatKeyForInput(cfg.keyType, cfg.key),
                        receiverName: cfg.receiverName || "",
                        city: cfg.city || "",
                        whatsapp: whatsappForInput(cfg.whatsapp),
                        policyText: cfg.policyText || DEFAULT_PIX_POLICY,
                    });
                }
            })
            .catch((e) => {
                console.error("Erro ao carregar o Pix:", e);
                if (!cancelled) { setSaved(null); setNotice({ type: "error", text: "Não foi possível carregar a configuração do Pix. Atualize a página." }); }
            });
        return () => { cancelled = true; };
    }, [user?.id]);

    const update = (patch) => {
        setForm((prev) => ({ ...prev, ...patch }));
        setNotice(null);
    };

    // Valida o formulário e monta o documento que vai para o Firestore
    const validate = () => {
        const next = {};
        const hasKey = form.key.trim() !== "";
        let key = "";
        if (form.enabled || hasKey) {
            const check = normalizePixKey(form.keyType, form.key);
            if (!check.valid) next.key = check.message; else key = check.key;
        }
        const receiverName = form.receiverName.trim();
        const city = form.city.trim();
        if (form.enabled && !receiverName) next.receiverName = "Informe o nome que aparece no banco.";
        if (form.enabled && !city) next.city = "Informe a cidade.";

        let whatsapp = "";
        if (form.whatsapp.trim()) {
            const w = validatePhoneBR(form.whatsapp);
            if (!w.valid) next.whatsapp = w.message; else whatsapp = `55${phoneDigits(form.whatsapp)}`;
        }
        if (form.policyText.length > 300) next.policyText = "O aviso pode ter até 300 caracteres.";

        return {
            errors: next,
            config: { enabled: form.enabled, keyType: form.keyType, key, receiverName, city, whatsapp, policyText: form.policyText.trim() },
        };
    };

    // Mudar para onde o dinheiro vai (ou ligar o Pix) pede a senha
    const needsPassword = (config) =>
        !saved
            ? config.enabled
            : config.key !== saved.key || config.keyType !== saved.keyType ||
              config.receiverName !== saved.receiverName || config.city !== saved.city ||
              (config.enabled && !saved.enabled);

    const persist = async (config) => {
        setSaving(true);
        try {
            await savePixConfig(user.id, config);
            setSaved({ ...config, updatedAt: Date.now() });
            setNotice({
                type: "ok",
                text: config.enabled
                    ? "Pix configurado! Seus clientes já podem pagar adiantado depois de entrar na fila."
                    : "Configuração salva. O Pix está desativado: os clientes não veem a opção de pagar.",
            });
        } catch (e) {
            console.error("Erro ao salvar o Pix:", e);
            setNotice({
                type: "error",
                text: e?.code === "permission-denied"
                    ? "O Firebase não aceitou a gravação. Confira se as regras do Firestore mais recentes foram publicadas."
                    : "Não foi possível salvar. Confira sua internet e tente de novo.",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        const result = validate();
        setErrors(result.errors);
        if (Object.keys(result.errors).length > 0) {
            setNotice({ type: "error", text: "Corrija os campos em vermelho para salvar." });
            return;
        }
        if (needsPassword(result.config)) {
            setPending(result.config);
            return;
        }
        await persist(result.config);
    };

    const handleReauth = async (password) => {
        await reauthenticate(password); // lança Error com a mensagem se a senha estiver errada
        const config = pending;
        setPending(null);
        await persist(config);
    };

    // Prévia: como o cliente vai ver (QR sem valor: o valor é o do serviço de cada cliente)
    const preview = useMemo(() => {
        const check = normalizePixKey(form.keyType, form.key);
        if (!check.valid || !form.receiverName.trim() || !form.city.trim()) return null;
        try {
            return {
                payload: buildPixPayload({ key: check.key, name: form.receiverName, city: form.city }),
                recipient: `${sanitizePixName(form.receiverName)} · ${sanitizePixCity(form.city)}`,
            };
        } catch {
            return null;
        }
    }, [form.keyType, form.key, form.receiverName, form.city]);

    const handleCopyPreview = async () => {
        try {
            await navigator.clipboard.writeText(preview.payload);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch {
            setNotice({ type: "error", text: "Não deu para copiar. Selecione o código manualmente." });
        }
    };

    const handleKeyChange = (value) => {
        const guess = guessPixKeyType(value);
        update({ key: form.keyType === "phone" ? formatPhoneBR(value) : value, ...(guess && guess !== form.keyType ? { keyType: guess } : {}) });
        setErrors((e) => ({ ...e, key: undefined }));
    };

    const inputClass = (field) =>
        `w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 ${errors[field] ? "ring-2 ring-red-500 focus:ring-red-500" : "focus:ring-amber-500"}`;
    const labelClass = "block text-ink font-medium text-sm mb-1";
    const errorText = (field) => errors[field] && <p role="alert" className="text-red-400 text-sm mt-1">{errors[field]}</p>;

    const personalKey = ["cpf", "cnpj", "phone", "email"].includes(form.keyType);

    if (saved === undefined) {
        return <div className="bg-gray-800 rounded-xl p-6 text-ink/80">Carregando o Pix...</div>;
    }

    return (
        <div className="bg-gray-800 rounded-xl p-6 space-y-5">
            <div>
                <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-amber-500" /> Receber por Pix
                </h2>
                <p className="text-sm text-ink/80 mt-1">
                    Deixe seus clientes pagarem adiantado depois de entrar na fila. O dinheiro cai direto na sua conta.
                    O valor é o preço do serviço que o cliente escolher.
                </p>
            </div>

            {/* Interruptor */}
            <label className="flex items-center justify-between gap-4 bg-gray-700 rounded-lg p-4 cursor-pointer">
                <span>
                    <span className="block font-semibold text-ink">Aceitar Pix adiantado</span>
                    <span className="block text-xs text-ink/80">{form.enabled ? "Ligado: os clientes veem a opção de pagar." : "Desligado: nada muda para os clientes."}</span>
                </span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={form.enabled}
                    onClick={() => update({ enabled: !form.enabled })}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${form.enabled ? "bg-amber-600" : "bg-gray-600"}`}
                >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.enabled ? "translate-x-5" : ""}`} />
                </button>
            </label>

            {/* Chave */}
            <div>
                <span className={labelClass}>Tipo da chave</span>
                <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Tipo da chave Pix">
                    {PIX_KEY_TYPES.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={form.keyType === t.id}
                            onClick={() => { update({ keyType: t.id, key: "" }); setErrors((e) => ({ ...e, key: undefined })); }}
                            className={`py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${form.keyType === t.id ? "bg-amber-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-ink"}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label htmlFor="pix-key" className={labelClass}>Chave Pix</label>
                <input
                    id="pix-key"
                    type="text"
                    value={form.key}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder={form.keyType === "random" ? "123e4567-e12b-12d1-a456-426655440000" : form.keyType === "email" ? "seu@email.com" : form.keyType === "phone" ? "(11) 99999-9999" : ""}
                    autoComplete="off"
                    spellCheck={false}
                    className={inputClass("key")}
                />
                <p className="text-xs text-ink/80 mt-1">{KEY_HINTS[form.keyType]}</p>
                {errorText("key")}
            </div>

            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm text-ink border ${personalKey ? "bg-amber-500/10 border-amber-500/30" : "bg-green-500/10 border-green-500/30"}`}>
                <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${personalKey ? "text-amber-500" : "text-green-500"}`} />
                <p>
                    {personalKey
                        ? `Quem pagar verá o código Pix, que contém sua chave (${KEY_LABEL[form.keyType]}). Prefira uma chave aleatória: ela não expõe seus dados pessoais. Você cria uma no app do seu banco.`
                        : "Boa escolha: a chave aleatória não expõe seus dados pessoais no código Pix."}
                </p>
            </div>

            {/* Nome e cidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="pix-name" className={labelClass}>Nome que aparece no banco</label>
                    <input
                        id="pix-name"
                        type="text"
                        value={form.receiverName}
                        maxLength={PIX_NAME_MAX}
                        onChange={(e) => { update({ receiverName: e.target.value }); setErrors((er) => ({ ...er, receiverName: undefined })); }}
                        className={inputClass("receiverName")}
                    />
                    <p className="text-xs text-ink/80 mt-1">
                        Aparece como: <strong className="text-ink">{sanitizePixName(form.receiverName)}</strong> (até {PIX_NAME_MAX} letras, sem acento)
                    </p>
                    {errorText("receiverName")}
                </div>
                <div>
                    <label htmlFor="pix-city" className={labelClass}>Cidade</label>
                    <input
                        id="pix-city"
                        type="text"
                        value={form.city}
                        maxLength={PIX_CITY_MAX}
                        onChange={(e) => { update({ city: e.target.value }); setErrors((er) => ({ ...er, city: undefined })); }}
                        className={inputClass("city")}
                    />
                    <p className="text-xs text-ink/80 mt-1">Até {PIX_CITY_MAX} letras.</p>
                    {errorText("city")}
                </div>
            </div>

            {/* WhatsApp e aviso */}
            <div>
                <label htmlFor="pix-whatsapp" className={labelClass}>WhatsApp para receber comprovantes (opcional)</label>
                <input
                    id="pix-whatsapp"
                    type="tel"
                    inputMode="numeric"
                    value={form.whatsapp}
                    maxLength={15}
                    onChange={(e) => { update({ whatsapp: formatPhoneBR(e.target.value) }); setErrors((er) => ({ ...er, whatsapp: undefined })); }}
                    placeholder="(11) 99999-9999"
                    className={inputClass("whatsapp")}
                />
                <p className="text-xs text-ink/80 mt-1">O cliente poderá abrir uma conversa com você já com a mensagem pronta.</p>
                {errorText("whatsapp")}
            </div>

            <div>
                <label htmlFor="pix-policy" className={labelClass}>Aviso ao cliente (aparece antes de pagar)</label>
                <textarea
                    id="pix-policy"
                    rows={3}
                    value={form.policyText}
                    maxLength={300}
                    onChange={(e) => { update({ policyText: e.target.value }); setErrors((er) => ({ ...er, policyText: undefined })); }}
                    className={`${inputClass("policyText")} resize-none`}
                />
                {errorText("policyText")}
            </div>

            {/* Prévia */}
            <div className="bg-gray-700 rounded-xl p-4 space-y-3">
                <p className="font-semibold text-ink">Assim o cliente vê</p>
                {preview ? (
                    <div className="text-center space-y-3">
                        <p className="text-sm text-ink/80">Para <strong className="text-ink">{preview.recipient}</strong></p>
                        <PixQr value={preview.payload} size={160} />
                        <p className="text-xs text-ink/80">
                            QR de exemplo, sem valor: cada cliente recebe o valor do serviço que escolheu.
                            Escaneie com o app do seu banco só para conferir o nome e a cidade. <strong className="text-ink">Não conclua o pagamento.</strong>
                        </p>
                        <button
                            type="button"
                            onClick={handleCopyPreview}
                            className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                            {copied ? <><Check className="w-4 h-4" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar código de exemplo</>}
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-ink/80">Preencha a chave, o nome e a cidade para ver o QR Code de exemplo.</p>
                )}
            </div>

            {notice && (
                <div
                    role={notice.type === "error" ? "alert" : "status"}
                    className={`flex items-start gap-2 rounded-lg p-3 text-sm text-ink border ${notice.type === "ok" ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}
                >
                    {notice.type === "ok" ? <Check className="w-5 h-5 text-green-500 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
                    <span>{notice.text}</span>
                </div>
            )}

            <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto sm:px-8 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
                {saving ? "Salvando..." : <><Save className="w-5 h-5" /> Salvar Pix</>}
            </button>
            {saved?.updatedAt && (
                <p className="text-xs text-ink/80">Última alteração: {new Date(saved.updatedAt).toLocaleString("pt-BR")}</p>
            )}

            <ReauthModal
                show={!!pending}
                title="Confirme sua senha"
                message="Mudar a chave Pix muda para onde os clientes pagam. Por segurança, confirme sua senha para salvar."
                confirmLabel="Confirmar e salvar"
                onConfirm={handleReauth}
                onClose={() => setPending(null)}
            />
        </div>
    );
}
