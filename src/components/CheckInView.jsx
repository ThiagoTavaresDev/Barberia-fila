import React, { useState, useEffect } from "react";
import { User, Phone, Briefcase, Scissors } from "lucide-react";
import { addClient, listenServices } from "../services/queueService";
import { generateWhatsAppMessage, generateWhatsAppLink } from "../utils/helpers";

export default function CheckInView() {
    const [services, setServices] = useState([]);
    const [newClient, setNewClient] = useState({
        name: "",
        phone: "",
        serviceId: "",
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const unsubscribe = listenServices(setServices);
        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newClient.name.trim() || !newClient.phone.trim() || !newClient.serviceId) {
            alert("Por favor, preencha todos os campos.");
            return;
        }

        setLoading(true);
        try {
            const selectedService = services.find(s => s.id === newClient.serviceId);

            const clientData = {
                name: newClient.name,
                phone: newClient.phone,
                serviceName: selectedService.name,
                serviceDuration: selectedService.duration,
                servicePrice: selectedService.price,
            };

            const { id } = await addClient(clientData);

            // Redirecionar para a tela de acompanhamento
            window.location.href = `/?client=${id}`;

        } catch (error) {
            console.error("Erro ao fazer check-in:", error);
            alert("Erro ao entrar na fila. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 space-y-6 shadow-2xl border border-gray-700">
                <div className="text-center">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Scissors className="w-10 h-10 text-amber-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Entrar na Fila
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
                                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                                placeholder="Digite seu nome"
                                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Seu Telefone (WhatsApp)</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="tel"
                                value={newClient.phone}
                                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                                placeholder="(11) 99999-9999"
                                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Serviço Desejado</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <select
                                value={newClient.serviceId}
                                onChange={(e) => setNewClient({ ...newClient, serviceId: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
                            >
                                <option value="">Selecione um serviço</option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {service.name} ({service.duration} min - R$ {service.price})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || services.length === 0}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-colors shadow-lg mt-4"
                    >
                        {loading ? "Entrando..." : "Entrar na Fila"}
                    </button>
                </form>
            </div>
        </div>
    );
}
