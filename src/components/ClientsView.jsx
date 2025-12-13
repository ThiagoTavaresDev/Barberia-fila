import React, { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, AlertCircle, User, Calendar, Download } from "lucide-react";
import { getInactiveClients, listenClients } from "../services/queueService";
import html2canvas from "html2canvas";
import LoyaltyCard from "./LoyaltyCard";

export default function ClientsView({ userId, onOpenProfile }) {
    const [activeTab, setActiveTab] = useState("recovery"); // 'recovery' | 'all'
    const [recoveryList, setRecoveryList] = useState([]);
    const [allClientsList, setAllClientsList] = useState([]);
    const [loading, setLoading] = useState(false);

    // States directly related to sharing
    const [clientToShare, setClientToShare] = useState(null);
    const cardRef = useRef(null);

    const loadRecovery = useCallback(async () => {
        setLoading(true);
        const data = await getInactiveClients(userId, 20); // 20 dias inativo
        setRecoveryList(data || []);
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        if (userId) {
            if (activeTab === "recovery") loadRecovery();

            // Real-time listener for "all" tab
            if (activeTab === "all") {
                setLoading(true);
                const unsubscribe = listenClients(userId, (data) => {
                    setAllClientsList(data || []);
                    setLoading(false);
                });
                return () => unsubscribe();
            }
        }
    }, [userId, activeTab, loadRecovery]);

    // Effect to trigger capture once clientToShare is set and rendered
    useEffect(() => {
        if (clientToShare && cardRef.current) {
            const generateAndShare = async () => {
                try {
                    // Slight delay to ensure fonts/styles loaded
                    await new Promise(resolve => setTimeout(resolve, 500));

                    const canvas = await html2canvas(cardRef.current, {
                        backgroundColor: null,
                        scale: 2 // High resolution
                    });

                    // Convert to blob/url
                    const image = canvas.toDataURL("image/png");

                    // Create download link
                    const link = document.createElement("a");
                    link.href = image;
                    link.download = `Cartao_Fidelidade_${clientToShare.name.replace(/\s+/g, '_')}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Open WhatsApp
                    const message = `Olá ${clientToShare.name?.split(' ')[0]}! 💈\n\nAqui está seu Cartão Fidelidade digital atualizado! 👇\n\nFaltam apenas *${10 - ((clientToShare.totalVisits % 10 === 0 && clientToShare.totalVisits > 0) ? 10 : clientToShare.totalVisits % 10)}* visitas para completar o nível.`;

                    const url = `https://wa.me/55${clientToShare.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
                    window.open(url, '_blank');

                } catch (error) {
                    console.error("Erro ao gerar cartão:", error);
                    alert("Erro ao gerar imagem do cartão.");
                } finally {
                    setClientToShare(null); // Reset
                }
            };

            generateAndShare();
        }
    }, [clientToShare]);

    const getWhatsAppLink = (client) => {
        const message = `Olá ${client.name?.split(' ')[0]}! Sumiu, cara! 😅 Bora dar aquele talento no visual essa semana?`;
        return `https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    };

    const handleShareClick = (client) => {
        setClientToShare(client);
    };

    return (
        <div className="animate-fade-in space-y-6">
            {/* Hidden Container for Generating Image */}
            {clientToShare && (
                <div style={{ position: "absolute", top: "-9999px", left: "-9999px" }}>
                    <LoyaltyCard
                        ref={cardRef}
                        client={clientToShare}
                        profile={null} // ClientsView usually behaves with 'client' object holding totalVisits directly from listener
                    />
                </div>
            )}

            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <User className="w-6 h-6 text-amber-500" />
                    Gestão de Clientes
                </h2>

                {/* Tabs */}
                <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                    <button
                        onClick={() => setActiveTab("recovery")}
                        className={`px-4 py-2 text-sm rounded-md transition-all ${activeTab === "recovery"
                            ? "bg-amber-500 text-white font-bold"
                            : "text-gray-400 hover:text-white"
                            }`}
                    >
                        Recuperação
                        {recoveryList.length > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{recoveryList.length}</span>
                        )}
                    </button>
                    {/* Placeholder for 'All Clients' in future updates if needed, kept simple for now */}
                    <button
                        onClick={() => setActiveTab("all")}
                        className={`px-4 py-2 text-sm rounded-md transition-all ${activeTab === "all"
                            ? "bg-amber-500 text-white font-bold"
                            : "text-gray-400 hover:text-white"
                            }`}
                    >
                        Todos
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden min-h-[400px]">
                {activeTab === "recovery" && (
                    <div className="p-4">
                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg mb-6 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                            <div>
                                <h4 className="text-amber-500 font-bold text-sm">Lista de Recuperação</h4>
                                <p className="text-gray-400 text-xs mt-1">
                                    Clientes que não aparecem há mais de 20 dias. Mande um 'Zap' para trazê-los de volta!
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                            </div>
                        ) : recoveryList.length === 0 ? (
                            <div className="text-center py-20 text-gray-500">
                                <p>Nenhum cliente inativo encontrado. Todos estão fiéis! 🚀</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {recoveryList.map(client => (
                                    <div key={client.id || client.phone} className="bg-gray-750 border border-gray-700 p-4 rounded-lg flex items-center justify-between hover:border-gray-600 transition-colors">
                                        <div>
                                            <h4 className="font-bold text-white text-lg">{client.name}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                                <Calendar className="w-3 h-3" />
                                                <span>{client.daysSince} dias sem vir</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Última: {new Date(client.lastVisit).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onOpenProfile && onOpenProfile(client)}
                                                className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-3 rounded-full transition-transform active:scale-95"
                                                title="Ver Perfil Completo"
                                            >
                                                <User className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleShareClick(client)}
                                                className="bg-amber-600/20 hover:bg-amber-600/40 text-amber-500 p-3 rounded-full transition-transform active:scale-95"
                                                title="Baixar e Enviar Cartão"
                                            >
                                                <Download className="w-5 h-5" />
                                            </button>
                                            <a
                                                href={getWhatsAppLink(client)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full transition-transform transform hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center"
                                                title="Enviar mensagem no WhatsApp"
                                            >
                                                <MessageCircle className="w-5 h-5" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "all" && (
                    <div className="p-4">
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg mb-6 flex items-start gap-3">
                            <User className="w-5 h-5 text-blue-500 mt-0.5" />
                            <div>
                                <h4 className="text-blue-500 font-bold text-sm">Todos os Clientes</h4>
                                <p className="text-gray-400 text-xs mt-1">
                                    Lista dos clientes mais recentes atendidos.
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                            </div>
                        ) : allClientsList.length === 0 ? (
                            <div className="text-center py-20 text-gray-500">
                                <p>Nenhum cliente registrado ainda.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {allClientsList.map(client => (
                                    <div key={client.id || client.phone} className="bg-gray-750 border border-gray-700 p-4 rounded-lg flex items-center justify-between hover:border-gray-600 transition-colors">
                                        <div>
                                            <h4 className="font-bold text-white text-lg">{client.name}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                                <Calendar className="w-3 h-3" />
                                                <span>{client.lastVisit ? new Date(client.lastVisit).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                                            </div>
                                            {client.totalVisits && (
                                                <div className="flex flex-col mt-1">
                                                    <p className="text-xs text-gray-500">
                                                        {client.totalVisits} visitas totais
                                                    </p>
                                                    {client.totalSpent > 0 && (
                                                        <p className="text-xs text-green-400 font-bold flex items-center gap-1 mt-0.5">
                                                            <span className="text-gray-500 font-normal">LTV:</span>
                                                            R$ {client.totalSpent.toFixed(2)}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onOpenProfile && onOpenProfile(client)}
                                                className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-3 rounded-full transition-transform active:scale-95"
                                                title="Ver Perfil Completo"
                                            >
                                                <User className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleShareClick(client)}
                                                className="bg-amber-600/20 hover:bg-amber-600/40 text-amber-500 p-3 rounded-full transition-transform active:scale-95"
                                                title="Baixar e Enviar Cartão"
                                            >
                                                <Download className="w-5 h-5" />
                                            </button>
                                            <a
                                                href={getWhatsAppLink(client)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full transition-transform transform hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center"
                                                title="Enviar mensagem no WhatsApp"
                                            >
                                                <MessageCircle className="w-5 h-5" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
