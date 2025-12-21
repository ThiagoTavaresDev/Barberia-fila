import React, { useState, useEffect } from "react";
import { User, Phone, Briefcase, Scissors } from "lucide-react";
import { addClient, listenServices } from "../services/queueService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function CheckInView({ barberId }) {
    const [services, setServices] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [servicesError, setServicesError] = useState(null);

    const [newClient, setNewClient] = useState({
        name: "",
        phone: "",
        serviceId: "",
    });
    const [loading, setLoading] = useState(false);

    const [shopName, setShopName] = useState("");

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

        // Buscar nome da barbearia para exibir
        const fetchBarberProfile = async () => {
            try {
                const docRef = doc(db, "users", barberId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setShopName(docSnap.data().shopName || "");
                }
            } catch (error) {
                console.error("Error fetching barber profile:", error);
            }
        };
        fetchBarberProfile();

        return () => unsubscribe();
    }, [barberId]);

    // Vou precisar adicionar imports se quiser buscar o nome.
    // Ou melhor, vou apenas assumir que preciso adicionar a busca.


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

            const { id } = await addClient(barberId, clientData);

            // Redirecionar para a tela de acompanhamento com o barberId correto
            window.location.href = `/?client=${id}&barber=${barberId}`;

        } catch (error) {
            console.error("Erro ao fazer check-in:", error);
            alert("Erro ao entrar na fila. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    if (!barberId) return <div className="text-white">Carregando...</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 space-y-6 shadow-2xl border border-gray-700">
                <div className="text-center">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Scissors className="w-10 h-10 text-amber-500" />
                    </div>
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
                                disabled={servicesLoading || !!servicesError}
                            >
                                <option value="">
                                    {servicesLoading ? "Carregando serviços..." :
                                        servicesError ? "Erro ao carregar serviços" :
                                            "Selecione um serviço"}
                                </option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {service.name} ({service.duration} min - R$ {service.price})
                                    </option>
                                ))}
                            </select>
                        </div>
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
                </form>
            </div>
        </div>
    );
}
