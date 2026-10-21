import React, { useState, useEffect, useMemo, useRef } from "react";
import { User, Phone, Search, X, Clock, Users, ShieldCheck, Wallet } from "lucide-react";
import BrandLogo from "./BrandLogo";
import { usePublicBranding } from "../context/ThemeContext";
import { addClient, listenServices, listenQueue } from "../services/queueService";
import { getPublicLinkInfo, isLinkValid } from "../services/checkinLink";
import { getPixConfig } from "../services/pixService";
import { isPixReady } from "../utils/pix";
import { validateClientName, cleanName } from "../utils/nameFilter";
import { formatPhoneBR, validatePhoneBR } from "../utils/phone";

const LINK_RECHECK_MS = 30000;

// Minúsculas e sem acento, para a busca ignorar "Navalhádo" x "navalhado"
const normalizeText = (s) =>
    String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function CheckInView({ barberId, token }) {
    usePublicBranding(barberId);

    const [services, setServices] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [servicesError, setServicesError] = useState(null);

    const [newClient, setNewClient] = useState({
        name: "",
        phone: "",
        serviceId: "",
    });
    const [loading, setLoading] = useState(false);

    // Busca do serviço: o texto digitado filtra a lista; só vale quando um item é escolhido (serviceId)
    const [serviceQuery, setServiceQuery] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [serviceError, setServiceError] = useState("");
    const serviceBoxRef = useRef(null);

    const [shopName, setShopName] = useState("");
    const [nameError, setNameError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    // Tela "confirme seu número" antes de entrar na fila (evita número digitado errado)
    const [confirming, setConfirming] = useState(false);

    // Quantas pessoas estão na fila agora (tempo real). null = ainda carregando.
    const [queueCount, setQueueCount] = useState(null);

    // O barbeiro aceita Pix adiantado? (só para avisar o cliente de que dá para pagar depois de entrar)
    const [pixEnabled, setPixEnabled] = useState(false);
    useEffect(() => {
        if (!barberId) return;
        let cancelled = false;
        getPixConfig(barberId)
            .then((cfg) => { if (!cancelled) setPixEnabled(isPixReady(cfg)); })
            .catch(() => { /* sem aviso: o Pix continua disponível na tela da fila */ });
        return () => { cancelled = true; };
    }, [barberId]);
    // "checking" | "valid" | "expired"
    const [linkStatus, setLinkStatus] = useState("checking");

    // Valida o link (token na URL x link vigente do barbeiro) e revalida de tempos em tempos,
    // para quem deixou a aba aberta além da expiração.
    useEffect(() => {
        if (!barberId) return;
        let cancelled = false;

        const checkLink = async () => {
            try {
                const info = await getPublicLinkInfo(barberId);
                if (cancelled) return;
                if (info?.shopName) setShopName(info.shopName);
                setLinkStatus(isLinkValid(info, token) ? "valid" : "expired");
            } catch (error) {
                console.error("Error checking check-in link:", error);
                if (!cancelled) setLinkStatus("expired");
            }
        };

        checkLink();
        const interval = setInterval(checkLink, LINK_RECHECK_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [barberId, token]);

    useEffect(() => {
        if (!barberId) return;
        setServicesLoading(true);
        setServicesError(null);

        const unsubscribe = listenServices(
            barberId,
            (list) => {
                setServices(list);
                setServicesLoading(false);
            },
            (error) => {
                console.error("Error loading services:", error);
                setServicesError("Não foi possível carregar os serviços. Tente novamente.");
                setServicesLoading(false);
            }
        );

        return () => unsubscribe();
    }, [barberId]);

    useEffect(() => {
        if (!barberId) return;
        const unsubscribe = listenQueue(barberId, (list) => setQueueCount(list.length));
        return () => unsubscribe();
    }, [barberId]);

    // Fecha a lista ao clicar/tocar fora do campo de serviço
    useEffect(() => {
        const handleOutside = (e) => {
            if (serviceBoxRef.current && !serviceBoxRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        document.addEventListener("touchstart", handleOutside);
        return () => {
            document.removeEventListener("mousedown", handleOutside);
            document.removeEventListener("touchstart", handleOutside);
        };
    }, []);

    // Todas as palavras digitadas precisam aparecer no nome, em qualquer ordem
    const filteredServices = useMemo(() => {
        const words = normalizeText(serviceQuery).split(/\s+/).filter(Boolean);
        if (words.length === 0) return services;
        return services.filter((service) => {
            const name = normalizeText(service.name);
            return words.every((w) => name.includes(w));
        });
    }, [services, serviceQuery]);

    const handleServiceQueryChange = (value) => {
        setServiceQuery(value);
        // Texto editado deixa de corresponder ao serviço escolhido antes
        setNewClient((prev) => ({ ...prev, serviceId: "" }));
        setServiceError("");
        setDropdownOpen(true);
    };

    const selectService = (service) => {
        setNewClient((prev) => ({ ...prev, serviceId: service.id }));
        setServiceQuery(service.name);
        setServiceError("");
        setDropdownOpen(false);
    };

    const clearService = () => {
        setServiceQuery("");
        setNewClient((prev) => ({ ...prev, serviceId: "" }));
        setServiceError("");
        setDropdownOpen(true);
    };

    const handleServiceKeyDown = (e) => {
        if (e.key === "Escape") {
            setDropdownOpen(false);
        } else if (e.key === "Enter") {
            // Enter escolhe o primeiro resultado em vez de enviar o formulário
            e.preventDefault();
            if (dropdownOpen && !newClient.serviceId && filteredServices.length > 0) {
                selectService(filteredServices[0]);
            }
        }
    };

    const handleNameChange = (value) => {
        setNewClient({ ...newClient, name: value });
        // Só mostra o erro depois que o cliente começou a digitar algo
        setNameError(value.trim() ? validateClientName(value).message : "");
    };

    const handlePhoneChange = (value) => {
        const formatted = formatPhoneBR(value);
        setNewClient({ ...newClient, phone: formatted });
        // Só cobra o número depois de completo, para não gritar erro enquanto digita
        setPhoneError(formatted.replace(/\D/g, "").length >= 11 ? validatePhoneBR(formatted).message : "");
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newClient.name.trim() || !newClient.phone.trim() || (!newClient.serviceId && !serviceQuery.trim())) {
            alert("Por favor, preencha todos os campos.");
            return;
        }

        // Digitou na busca mas não escolheu nenhum item da lista
        if (!newClient.serviceId) {
            setServiceError("Selecione um serviço da lista");
            setDropdownOpen(true);
            return;
        }

        const nameCheck = validateClientName(newClient.name);
        if (!nameCheck.valid) {
            setNameError(nameCheck.message);
            return;
        }

        const phoneCheck = validatePhoneBR(newClient.phone);
        if (!phoneCheck.valid) {
            setPhoneError(phoneCheck.message);
            return;
        }

        // Antes de entrar na fila, o cliente confere o número
        setConfirming(true);
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            const selectedService = services.find(s => s.id === newClient.serviceId);

            const clientData = {
                name: cleanName(newClient.name),
                phone: newClient.phone,
                serviceId: selectedService.id,
                serviceName: selectedService.name,
                serviceDuration: selectedService.duration,
                servicePrice: selectedService.price,
            };

            const { id, key } = await addClient(barberId, clientData, token);

            // Redirecionar para a tela de acompanhamento com o barberId correto
            // (k = chave secreta do cliente: é ela que libera o pagamento por Pix na tela dele)
            window.location.href = `/?client=${id}&barber=${barberId}&k=${key}`;

        } catch (error) {
            console.error("Erro ao fazer check-in:", error);
            setConfirming(false);
            if (error?.code === "permission-denied") {
                // Quase sempre é o link que expirou (ou foi trocado) entre abrir a página e enviar.
                // Confere antes de dizer isso: se o link continua válido, o problema é outro.
                let linkStillValid = false;
                try { linkStillValid = isLinkValid(await getPublicLinkInfo(barberId), token); } catch { /* sem rede: trata como link expirado */ }
                if (linkStillValid) {
                    alert("Não foi possível entrar na fila agora. Atualize a página e tente de novo. Se continuar, avise o barbeiro.");
                } else {
                    setLinkStatus("expired");
                }
            } else if (error?.code === "unavailable" || navigator.onLine === false) {
                alert("Sem internet. Confira sua conexão e tente de novo.");
            } else {
                alert("Erro ao entrar na fila. Tente novamente.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!barberId) return <div className="text-white">Carregando...</div>;

    if (linkStatus === "checking") {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 flex items-center justify-center p-4">
                <p className="text-gray-400">Carregando...</p>
            </div>
        );
    }

    if (linkStatus === "expired") {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 space-y-4 shadow-2xl border border-gray-700 text-center">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                        <Clock className="w-10 h-10 text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Link expirado</h2>
                    <p className="text-gray-400">
                        Este link para entrar na fila não é mais válido. Peça ao barbeiro o link ou QR Code atualizado.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 space-y-6 shadow-2xl border border-gray-700">
                <div className="text-center">
                    <BrandLogo variant="badge" size="w-20 h-20" className="mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {shopName ? `Entrar na Fila - ${shopName}` : "Entrar na Fila"}
                    </h2>
                    <p className="text-gray-400">Preencha seus dados para aguardar atendimento</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-300 mb-2">Seu Nome</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={newClient.name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                placeholder="Digite seu nome"
                                maxLength={40}
                                className={`w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 ${nameError ? "ring-2 ring-red-500 focus:ring-red-500" : "focus:ring-amber-500"}`}
                            />
                        </div>
                        {nameError && (
                            <p className="text-red-400 text-sm mt-1">{nameError}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Seu Telefone (WhatsApp)</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                value={newClient.phone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                placeholder="(11) 99999-9999"
                                maxLength={15}
                                className={`w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 ${phoneError ? "ring-2 ring-red-500 focus:ring-red-500" : "focus:ring-amber-500"}`}
                            />
                        </div>
                        {phoneError ? (
                            <p className="text-red-400 text-sm mt-1">{phoneError}</p>
                        ) : (
                            <p className="text-ink/70 text-xs mt-1">É por esse WhatsApp que o barbeiro vai te chamar.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Serviço Desejado</label>
                        <div className="relative" ref={serviceBoxRef}>
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                role="combobox"
                                aria-expanded={dropdownOpen}
                                aria-controls="service-listbox"
                                aria-autocomplete="list"
                                autoComplete="off"
                                inputMode="search"
                                value={serviceQuery}
                                onChange={(e) => handleServiceQueryChange(e.target.value)}
                                onFocus={() => setDropdownOpen(true)}
                                onClick={() => setDropdownOpen(true)}
                                onKeyDown={handleServiceKeyDown}
                                placeholder={servicesLoading ? "Carregando serviços..." :
                                    servicesError ? "Erro ao carregar serviços" :
                                        "Busque ou selecione um serviço"}
                                disabled={servicesLoading || !!servicesError}
                                className={`w-full pl-10 pr-10 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 ${serviceError ? "ring-2 ring-red-500 focus:ring-red-500" : "focus:ring-amber-500"}`}
                            />
                            {serviceQuery && !servicesLoading && !servicesError && (
                                <button
                                    type="button"
                                    onClick={clearService}
                                    aria-label="Limpar busca"
                                    className="absolute right-3 top-3 text-gray-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}

                            {dropdownOpen && !servicesLoading && !servicesError && services.length > 0 && (
                                <ul
                                    id="service-listbox"
                                    role="listbox"
                                    // Evita o blur do input antes do clique/toque no item
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-gray-700 border border-gray-600 rounded-lg shadow-xl"
                                >
                                    {filteredServices.length === 0 ? (
                                        <li className="px-4 py-3 text-gray-400 text-sm">
                                            Nenhum serviço encontrado para “{serviceQuery.trim()}”
                                        </li>
                                    ) : (
                                        filteredServices.map((service) => (
                                            <li
                                                key={service.id}
                                                role="option"
                                                aria-selected={service.id === newClient.serviceId}
                                                onClick={() => selectService(service)}
                                                className={`px-4 py-3 text-white cursor-pointer hover:bg-amber-600/30 ${service.id === newClient.serviceId ? "bg-amber-600/20" : ""}`}
                                            >
                                                {service.name}{" "}
                                                <span className="text-gray-400 text-sm">
                                                    ({service.duration} min - R$ {service.price})
                                                </span>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </div>
                        {serviceError && (
                            <p className="text-red-400 text-sm mt-1">{serviceError}</p>
                        )}
                        {servicesError && (
                            <p className="text-red-400 text-sm mt-1">{servicesError}</p>
                        )}
                        {services.length === 0 && !servicesLoading && !servicesError && (
                            <p className="text-yellow-500 text-sm mt-1">Nenhum serviço disponível no momento.</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || services.length === 0}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-colors shadow-lg mt-4"
                    >
                        {loading ? "Entrando..." : "Entrar na Fila"}
                    </button>
                    {pixEnabled && (
                        <p className="flex items-start justify-center gap-2 text-xs text-ink/80 text-center pt-1">
                            <Wallet className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>Depois de entrar na fila você poderá adiantar o pagamento por Pix.</span>
                        </p>
                    )}
                </form>

                {/* Rodapé: fila ao vivo */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-700">
                    <span className="flex items-center gap-2 text-xs text-ink/70">
                        <span className="relative flex w-2 h-2">
                            <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-75 animate-ping"></span>
                            <span className="relative inline-flex w-2 h-2 rounded-full bg-green-500"></span>
                        </span>
                        Atualizado ao vivo
                    </span>
                    <div
                        key={queueCount}
                        className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 animate-pop"
                        aria-live="polite"
                    >
                        <Users className="w-5 h-5 text-amber-500 shrink-0" />
                        {queueCount === null ? (
                            <span className="text-sm text-ink/70">Carregando fila...</span>
                        ) : queueCount === 0 ? (
                            <span className="text-sm font-bold text-ink">Ninguém na sua frente</span>
                        ) : (
                            <span className="text-sm text-ink">
                                <span className="text-2xl font-extrabold align-middle mr-1">{queueCount}</span>
                                <span className="font-semibold">
                                    {queueCount === 1 ? "pessoa na sua frente" : "pessoas na sua frente"}
                                </span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {confirming && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
                        <div className="text-center space-y-2">
                            <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                                <ShieldCheck className="w-7 h-7 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-bold text-ink">Confirme seu WhatsApp</h3>
                            <p className="text-sm text-ink/80">
                                O barbeiro vai te avisar por este número. Confira se está certinho.
                            </p>
                        </div>

                        <div className="bg-gray-700 rounded-lg p-4 text-center space-y-1">
                            <p className="text-3xl font-extrabold text-ink tracking-wide">{newClient.phone}</p>
                            <p className="text-sm text-ink/80">{cleanName(newClient.name)} · {serviceQuery}</p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                disabled={loading}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-ink font-semibold py-3 rounded-lg transition-colors"
                            >
                                Corrigir
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={loading}
                                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
                            >
                                {loading ? "Entrando..." : "Está certo"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
