import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save, Instagram, Building2, Camera, Image as ImageIcon, Trash2, Palette, Check, Store } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { saveBranding } from "../services/brandingService";
import { THEME_PRESETS, DEFAULT_THEME_ID, buildPalette } from "../utils/themes";
import ImageCropModal from "./modals/ImageCropModal";
import PixSettings from "./PixSettings";

const MAX_FILE_MB = 15;
const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

const rgb = (value) => `rgb(${value})`;

// Miniatura do preset: fundo da página, cartão, linhas de texto e botão de destaque
function PresetPreview({ preset }) {
    const { vars } = useMemo(() => buildPalette(preset), [preset]);
    return (
        <div className="rounded-lg p-2 h-16" style={{ background: rgb(vars["--gray-900"]) }}>
            <div
                className="h-full rounded-md p-1.5 flex flex-col justify-between"
                style={{ background: rgb(vars["--gray-800"]), border: `1px solid ${rgb(vars["--gray-700"])}` }}
            >
                <div className="space-y-1">
                    <div className="h-1.5 w-3/4 rounded-full" style={{ background: rgb(vars["--gray-400"]) }} />
                    <div className="h-1.5 w-1/2 rounded-full" style={{ background: rgb(vars["--gray-600"]) }} />
                </div>
                <div className="h-2.5 w-1/2 rounded-full" style={{ background: rgb(vars["--accent-600"]) }} />
            </div>
        </div>
    );
}

export default function SettingsView() {
    const { user, updateProfile } = useAuth();
    const { branding, previewTheme, setBranding } = useTheme();

    // ---- Perfil ----
    const [profile, setProfile] = useState({ shopName: "", instagramLink: "" });
    const [savingProfile, setSavingProfile] = useState(false);

    useEffect(() => {
        if (user) {
            setProfile({ shopName: user.shopName || "", instagramLink: user.instagramLink || "" });
        }
    }, [user]);

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        try {
            await updateProfile(profile);
            await saveBranding(user.id, profile);
            alert("Perfil atualizado com sucesso!");
        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            alert("Erro ao atualizar perfil.");
        } finally {
            setSavingProfile(false);
        }
    };

    // ---- Logo ----
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const [pendingFile, setPendingFile] = useState(null);
    const [savingLogo, setSavingLogo] = useState(false);

    const handleFileChosen = (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // permite escolher o mesmo arquivo de novo
        if (!file) return;

        if (!ACCEPTED_TYPES.includes(file.type)) {
            alert("Formato não suportado. Envie uma imagem PNG ou JPEG.");
            return;
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
            alert(`A imagem é grande demais (máximo ${MAX_FILE_MB} MB).`);
            return;
        }
        setPendingFile(file);
    };

    const handleLogoConfirmed = async (dataUrl) => {
        setPendingFile(null);
        setSavingLogo(true);
        try {
            await saveBranding(user.id, { logoUrl: dataUrl });
        } catch (error) {
            console.error("Erro ao salvar logo:", error);
            alert("Erro ao salvar a logo. Tente novamente.");
        } finally {
            setSavingLogo(false);
        }
    };

    const handleRemoveLogo = async () => {
        if (!window.confirm("Remover a logo e voltar para o ícone de tesoura?")) return;
        setSavingLogo(true);
        try {
            await saveBranding(user.id, { logoUrl: "" });
        } catch (error) {
            console.error("Erro ao remover logo:", error);
            alert("Erro ao remover a logo.");
        } finally {
            setSavingLogo(false);
        }
    };

    // ---- Aparência ----
    const savedThemeId = branding.themeId || DEFAULT_THEME_ID;
    const [selectedTheme, setSelectedTheme] = useState(savedThemeId);
    const [savingTheme, setSavingTheme] = useState(false);

    useEffect(() => setSelectedTheme(savedThemeId), [savedThemeId]);
    // Ao sair da tela, descarta qualquer pré-visualização não salva
    useEffect(() => () => previewTheme(null), [previewTheme]);

    const handleSelectTheme = (id) => {
        setSelectedTheme(id);
        previewTheme(id === savedThemeId ? null : id);
    };

    const handleCancelTheme = () => handleSelectTheme(savedThemeId);

    const handleSaveTheme = async () => {
        setSavingTheme(true);
        try {
            await saveBranding(user.id, { themeId: selectedTheme });
            setBranding((prev) => ({ ...prev, themeId: selectedTheme }));
            previewTheme(null);
        } catch (error) {
            console.error("Erro ao salvar tema:", error);
            alert("Erro ao salvar as cores. Tente novamente.");
        } finally {
            setSavingTheme(false);
        }
    };

    const themeDirty = selectedTheme !== savedThemeId;
    const inputClass = "w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500";
    const cardClass = "bg-gray-800 rounded-xl p-6 space-y-5";

    return (
        <div className="space-y-6">
            {/* Perfil + logo */}
            <div className={cardClass}>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Store className="w-5 h-5 text-amber-500" /> Perfil da Barbearia
                </h2>

                <div className="flex flex-col sm:flex-row items-center gap-5">
                    <div className="w-28 h-28 rounded-2xl bg-gray-700 flex items-center justify-center overflow-hidden shrink-0 border border-gray-600">
                        {branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo da barbearia" className="w-full h-full object-cover" />
                        ) : (
                            <ImageIcon className="w-10 h-10 text-gray-500" />
                        )}
                    </div>
                    <div className="space-y-3 w-full">
                        <div>
                            <p className="text-white font-medium">Logo da barbearia</p>
                            <p className="text-xs text-gray-500">
                                Aparece no lugar da tesoura e como ícone do site. PNG ou JPEG.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                disabled={savingLogo}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg transition-colors"
                            >
                                <Camera className="w-4 h-4" /> Tirar foto
                            </button>
                            <button
                                type="button"
                                onClick={() => galleryInputRef.current?.click()}
                                disabled={savingLogo}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg transition-colors"
                            >
                                <ImageIcon className="w-4 h-4" /> Escolher da galeria
                            </button>
                            {branding.logoUrl && (
                                <button
                                    type="button"
                                    onClick={handleRemoveLogo}
                                    disabled={savingLogo}
                                    className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" /> Remover
                                </button>
                            )}
                        </div>
                        {savingLogo && <p className="text-sm text-gray-400">Salvando logo...</p>}
                    </div>
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChosen} />
                    <input ref={galleryInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChosen} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Nome da Barbearia</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                value={profile.shopName}
                                onChange={(e) => setProfile({ ...profile, shopName: e.target.value })}
                                placeholder="Nome da Barbearia"
                                className={inputClass}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Link do Instagram</label>
                        <div className="relative">
                            <Instagram className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                            <input
                                type="url"
                                value={profile.instagramLink}
                                onChange={(e) => setProfile({ ...profile, instagramLink: e.target.value })}
                                placeholder="https://instagram.com/seu_usuario"
                                className={inputClass}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Este link será exibido para o cliente ao final do atendimento.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="w-full sm:w-auto sm:px-8 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    {savingProfile ? "Salvando..." : <><Save className="w-5 h-5" /> Salvar Perfil</>}
                </button>
            </div>

            {/* Pix */}
            <PixSettings />

            {/* Aparência */}
            <div className={cardClass}>
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Palette className="w-5 h-5 text-amber-500" /> Cores do site
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Escolha um tema. Ele vale para o seu painel e para as telas que seus clientes veem.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {THEME_PRESETS.map((preset) => {
                        const active = preset.id === selectedTheme;
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => handleSelectTheme(preset.id)}
                                aria-pressed={active}
                                className={`text-left rounded-xl p-2 border-2 transition-colors ${active ? "border-amber-500 bg-amber-500/10" : "border-gray-700 hover:border-gray-600"}`}
                            >
                                <PresetPreview preset={preset} />
                                <div className="flex items-center justify-between mt-2 px-1">
                                    <span className="text-sm text-white font-medium">{preset.name}</span>
                                    {active && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {themeDirty && (
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <p className="text-sm text-gray-400 flex-1">
                            Pré-visualizando o tema. Salve para aplicar também aos seus clientes.
                        </p>
                        <button
                            onClick={handleCancelTheme}
                            className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors w-full sm:w-auto"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveTheme}
                            disabled={savingTheme}
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition-colors w-full sm:w-auto"
                        >
                            {savingTheme ? "Salvando..." : "Salvar cores"}
                        </button>
                    </div>
                )}
            </div>

            {pendingFile && (
                <ImageCropModal
                    file={pendingFile}
                    onCancel={() => setPendingFile(null)}
                    onConfirm={handleLogoConfirmed}
                />
            )}
        </div>
    );
}
