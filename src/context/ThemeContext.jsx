import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { listenBranding, saveBranding, getBranding, readCachedBranding } from "../services/brandingService";
import { applyTheme, applyFavicon, DEFAULT_THEME_ID } from "../utils/themes";

const ThemeContext = createContext({
    branding: {},
    themeId: DEFAULT_THEME_ID,
    logoUrl: "",
    previewTheme: () => { },
    setBranding: () => { },
});

const EMPTY = {};

export function ThemeProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.id;

    // Identidade salva (do barbeiro logado ou da barbearia cujo link o cliente abriu)
    const [branding, setBranding] = useState(EMPTY);
    // Tema em pré-visualização na tela de Configurações (ainda não salvo)
    const [previewId, setPreviewId] = useState(null);

    const themeId = previewId || branding.themeId || DEFAULT_THEME_ID;
    const logoUrl = branding.logoUrl || "";

    useLayoutEffect(() => {
        applyTheme(themeId);
    }, [themeId]);

    useLayoutEffect(() => {
        applyFavicon(logoUrl);
    }, [logoUrl]);

    // Barbeiro logado: acompanha o próprio branding. Ao sair, volta ao visual padrão.
    useEffect(() => {
        if (!userId) return;
        const cached = readCachedBranding(userId);
        if (cached) setBranding(cached);

        const unsubscribe = listenBranding(
            userId,
            (data) => setBranding(data),
            (error) => console.error("Erro ao carregar identidade visual:", error)
        );
        return () => {
            unsubscribe();
            setBranding(EMPTY);
            setPreviewId(null);
        };
    }, [userId]);

    // Mantém nome/instagram do perfil espelhados no doc público (usado pela tela do cliente).
    // Cobre barbeiros que já tinham perfil antes de existir o branding público.
    useEffect(() => {
        if (!userId || !user) return;
        const shopName = user.shopName || "";
        const instagramLink = user.instagramLink || "";
        if (branding.shopName === shopName && branding.instagramLink === instagramLink) return;
        if (branding === EMPTY) return; // ainda carregando o doc
        saveBranding(userId, { shopName, instagramLink }).catch((e) =>
            console.error("Erro ao sincronizar perfil público:", e)
        );
    }, [userId, user, branding]);

    const previewTheme = useCallback((id) => setPreviewId(id || null), []);

    const value = useMemo(
        () => ({ branding, themeId, logoUrl, previewTheme, setBranding }),
        [branding, themeId, logoUrl, previewTheme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

// Telas públicas (cliente / check-in): carrega a identidade da barbearia pelo id na URL.
// Devolve o branding já salvo em cache na hora, para não piscar o tema padrão.
export function usePublicBranding(barberId) {
    const { setBranding } = useTheme();
    const { user } = useAuth();

    useLayoutEffect(() => {
        if (!barberId || user?.id === barberId) return; // barbeiro logado já usa o listener do provider
        const cached = readCachedBranding(barberId);
        if (cached) setBranding(cached);
    }, [barberId, user?.id, setBranding]);

    useEffect(() => {
        if (!barberId || user?.id === barberId) return;
        let cancelled = false;
        getBranding(barberId)
            .then((data) => { if (!cancelled) setBranding(data); })
            .catch((e) => console.error("Erro ao carregar identidade visual:", e));
        return () => { cancelled = true; };
    }, [barberId, user?.id, setBranding]);
}
