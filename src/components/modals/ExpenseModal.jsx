import React, { useState } from "react";
import { X, Save, DollarSign } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { addExpense } from "../../services/queueService";

export default function ExpenseModal({ show, onClose, onSave }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        category: "general"
    });

    const categories = [
        { id: "general", label: "Geral" },
        { id: "supplies", label: "Insumos (Lâminas, Golas)" },
        { id: "products", label: "Produtos (Pomada, Shave)" },
        { id: "infrastructure", label: "Infra (Lâmpada, Reparos)" },
        { id: "marketing", label: "Marketing" }
    ];

    const handleSubmit = async () => {
        if (!formData.description || !formData.amount) return;

        setLoading(true);
        try {
            await addExpense(user.uid, {
                ...formData,
                amount: parseFloat(formData.amount)
            });
            setFormData({ description: "", amount: "", category: "general" });
            onSave(); // Refresh stats
            onClose();
        } catch (error) {
            console.error("Error adding expense", error);
            alert("Erro ao salvar despesa.");
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-gray-800 rounded-xl max-w-sm w-full border border-gray-700 shadow-2xl overflow-hidden">
                <div className="bg-gray-750 p-6 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-red-500" />
                        Lançar Despesa
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Descrição</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Ex: Cartela de Lâminas"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Valor (R$)</label>
                        <input
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            placeholder="0.00"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Categoria</label>
                        <div className="grid grid-cols-2 gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setFormData({ ...formData, category: cat.id })}
                                    className={`text-xs p-2 rounded-lg border transition-colors ${formData.category === cat.id
                                            ? "bg-red-500/20 border-red-500 text-red-500"
                                            : "bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600"
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4"
                    >
                        {loading ? "Salvando..." : (
                            <>
                                <Save className="w-5 h-5" /> Salvar Despesa
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
