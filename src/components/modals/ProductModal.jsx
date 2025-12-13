import React, { useState, useEffect } from "react";
import { X, Save, Package } from "lucide-react";
import { addProduct, updateProduct } from "../../services/queueService";
import { useAuth } from "../../context/AuthContext";

export default function ProductModal({ show, onClose, productToEdit }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [category, setCategory] = useState("consumable"); // consumable, resale
    const [quantity, setQuantity] = useState("");
    const [minQuantity, setMinQuantity] = useState("5");
    const [price, setPrice] = useState(""); // Cost or Resale Price

    // Reset or Populate on Open
    useEffect(() => {
        if (show) {
            if (productToEdit) {
                setName(productToEdit.name);
                setCategory(productToEdit.category || "consumable");
                setQuantity(productToEdit.quantity.toString());
                setMinQuantity(productToEdit.minQuantity?.toString() || "5");
                setPrice(productToEdit.price?.toString() || "");
            } else {
                setName("");
                setCategory("consumable");
                setQuantity("");
                setMinQuantity("5");
                setPrice("");
            }
        }
    }, [show, productToEdit]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user?.uid) return;

        setLoading(true);
        try {
            const productData = {
                name,
                category,
                quantity: parseInt(quantity) || 0,
                minQuantity: parseInt(minQuantity) || 0,
                price: parseFloat(price) || 0,
            };

            if (productToEdit) {
                await updateProduct(user.uid, productToEdit.id, productData);
            } else {
                await addProduct(user.uid, productData);
            }
            onClose();
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Erro ao salvar produto.");
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl overflow-hidden">
                <div className="bg-gray-750 p-6 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Package className="w-6 h-6 text-amber-500" />
                        {productToEdit ? "Editar Produto" : "Novo Produto"}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Nome do Produto</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="Ex: Pomada Matte, Lâminas"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Categoria</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                        >
                            <option value="consumable">Consumo Interno (Material)</option>
                            <option value="resale">Revenda (Produto)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Quantidade Atual</label>
                            <input
                                type="number"
                                required
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Mínimo (Alerta)</label>
                            <input
                                type="number"
                                required
                                value={minQuantity}
                                onChange={(e) => setMinQuantity(e.target.value)}
                                className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {category === 'resale' ? "Preço de Venda (R$)" : "Custo Unitário (R$)"}
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="0.00"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                {productToEdit ? "Salvar Alterações" : "Cadastrar Produto"}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
