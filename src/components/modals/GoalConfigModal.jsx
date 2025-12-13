import React, { useState, useEffect } from "react";
import { X, Save, Target } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function GoalConfigModal({ show, onClose }) {
    const { user, updateProfile } = useAuth();
    const [formData, setFormData] = useState({
        monthlyGoal: "",
        dailyGoal: "",
        fixedCosts: ""
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                monthlyGoal: user.monthlyGoal || "",
                dailyGoal: user.dailyGoal || "",
                fixedCosts: user.fixedCosts || ""
            });
        }
    }, [user, show]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await updateProfile({
                monthlyGoal: formData.monthlyGoal,
                dailyGoal: formData.dailyGoal,
                fixedCosts: formData.fixedCosts
            });
            onClose();
        } catch (error) {
            console.error("Erro ao salvar metas:", error);
            alert("Erro ao salvar metas.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full space-y-6 border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-500" />
                        Definir Metas
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Meta Diária (Opcional)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-500 font-bold">R$</span>
                            <input
                                type="number"
                                value={formData.dailyGoal}
                                min="0"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || parseFloat(val) >= 0) {
                                        setFormData({ ...formData, dailyGoal: val });
                                    }
                                }}
                                placeholder="Ex: 200.00"
                                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-600"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Custo Fixo Mensal (R$)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-500 font-bold">R$</span>
                            <input
                                type="number"
                                value={formData.fixedCosts}
                                min="0"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || parseFloat(val) >= 0) {
                                        setFormData({ ...formData, fixedCosts: val });
                                    }
                                }}
                                placeholder="Aluguel, Luz, etc..."
                                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-600"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1 ml-1">Para calcular seu lucro líquido.</p>
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Meta Mensal (Opcional)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-500 font-bold">R$</span>
                            <input
                                type="number"
                                value={formData.monthlyGoal}
                                min="0"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || parseFloat(val) >= 0) {
                                        setFormData({ ...formData, monthlyGoal: val });
                                    }
                                }}
                                placeholder="Ex: 5000.00"
                                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-600"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95"
                    >
                        {isLoading ? (
                            "Salvando..."
                        ) : (
                            <>
                                <Save className="w-5 h-5" /> Salvar Metas
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
