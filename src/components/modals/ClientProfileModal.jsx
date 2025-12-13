import React, { useState, useEffect } from "react";
import { X, Calendar, History } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getClientProfile } from "../../services/queueService";
import LoyaltyCard from "../LoyaltyCard";

export default function ClientProfileModal({ show, onClose, client }) {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            setLoading(true);
            const data = await getClientProfile(user.uid, client.phone);
            if (data) {
                setProfile(data);
            } else {
                // Se não tem perfil ainda, usa dados básicos do cliente atual na fila
                setProfile({
                    name: client.name,
                    phone: client.phone,
                    totalVisits: 1, // Assumindo primeira visita ou não trackeado ainda
                    lastVisit: null
                });
            }
            setLoading(false);
        };

        if (show && client?.phone && user?.uid) {
            loadProfile();
        } else {
            setProfile(null);
        }
    }, [show, client, user]);

    if (!show || !client) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gray-750 p-6 border-b border-gray-700 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-gray-900 font-bold text-xl">
                            {client.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white leading-tight">{client.name}</h3>
                            <p className="text-sm text-gray-400">{client.phone}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                        </div>
                    ) : (
                        <>
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600">
                                    <div className="flex items-center gap-2 mb-1">
                                        <History className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs text-gray-400">Total de Visitas</span>
                                    </div>
                                    <p className="text-lg font-bold text-white">
                                        {profile?.totalVisits || (client.totalVisits ?? 1)}
                                    </p>
                                </div>
                                <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calendar className="w-4 h-4 text-green-400" />
                                        <span className="text-xs text-gray-400">Última Visita</span>
                                    </div>
                                    <p className="text-sm font-medium text-white truncate">
                                        {profile?.lastVisit
                                            ? new Date(profile.lastVisit).toLocaleDateString('pt-BR')
                                            : "Hoje"}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {profile?.lastService || client.serviceName}
                                    </p>
                                </div>
                            </div>

                            {/* CARTÃO FIDELIDADE DIGITAL 🎫 */}
                            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 rounded-xl border border-amber-500/30 shadow-lg relative overflow-hidden group">
                                {/* Efeito de brilho no fundo */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-amber-500 p-1.5 rounded-full">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-black">
                                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <span className="text-amber-500 font-bold uppercase tracking-wider text-sm">Barber Club</span>
                                    </div>
                                    <span className="text-xs text-gray-400 font-mono">
                                        #{String(profile?.phone || client.phone).slice(-4)}
                                    </span>
                                </div>

                                {/* Grid de Carimbos */}
                                <div className="grid grid-cols-5 gap-3 relative z-10">
                                    {Array.from({ length: 10 }).map((_, index) => {
                                        const totalVisits = profile?.totalVisits || (client.totalVisits ?? 1);
                                        const currentCycle = Math.floor((totalVisits - 1) / 10);
                                        const visitsInCycle = totalVisits - (currentCycle * 10);
                                        const isStamped = index < visitsInCycle;

                                        return (
                                            <div
                                                key={index}
                                                className={`
                                                    aspect-square rounded-full flex items-center justify-center border-2 transition-all duration-500 relative
                                                    ${isStamped
                                                        ? "border-amber-500 bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105"
                                                        : "border-gray-700 bg-gray-800/50"}
                                                `}
                                            >
                                                {isStamped ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-black drop-shadow-sm animate-stamp-in">
                                                        <path d="M5.223 2.25c-.497 0-.974.198-1.325.55l-1.3 1.298A3.75 3.75 0 7.5 9.75c0 2.292.545 4.4 1.503 6.313l-2.158 3.106 3.728 3.729 3.106-2.158c1.912.958 4.021 1.503 6.313 1.503a3.75 3.75 0 0 0 3.75-3.75v-2.098c0-.497-.199-.973-.55-1.325l-1.299-1.3a3.748 3.748 0 0 0-3.748-3.748H12.25v-3h.75a3.75 3.75 0 0 0 3.75-3.75V2.25h-11.5Z" />
                                                    </svg>
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 font-bold">{index + 1}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 flex justify-between items-center text-xs relative z-10">
                                    <span className="text-gray-400">Complete 10 e suba de nível!</span>
                                    <div className="flex gap-1">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= Math.floor(((profile?.totalVisits || 1) - 1) / 10) ? "bg-amber-500" : "bg-gray-700"}`}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>


                        </>
                    )}
                </div>
            </div >
        </div >
    );
}

