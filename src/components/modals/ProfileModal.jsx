import React, { useState, useEffect } from "react";
import { X, Save, User, Instagram, Building2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function ProfileModal({ show, onClose }) {
    const { user, updateProfile } = useAuth();
    const [formData, setFormData] = useState({
        shopName: "",
        instagramLink: "",
        monthlyGoal: "",
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                shopName: user.shopName || "",
                instagramLink: user.instagramLink || "",
                monthlyGoal: user.monthlyGoal || "",
            });
        }
    }, [user, show]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await updateProfile(formData);
            alert("Perfil atualizado com sucesso!");
            onClose();
        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            alert("Erro ao atualizar perfil.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-amber-500" />
                        Configurações do Perfil
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Nome da Barbearia</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                value={formData.shopName}
                                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                                placeholder="Nome da Barbearia"
                                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Link do Instagram</label>
                        <div className="relative">
                            <Instagram className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                            <input
                                type="url"
                                value={formData.instagramLink}
                                onChange={(e) => setFormData({ ...formData, instagramLink: e.target.value })}
                                placeholder="https://instagram.com/seu_usuario"
                                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Este link será exibido para o cliente ao final do atendimento.
                        </p>
                    </div>



                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                        {isLoading ? (
                            "Salvando..."
                        ) : (
                            <>
                                <Save className="w-5 h-5" /> Salvar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
