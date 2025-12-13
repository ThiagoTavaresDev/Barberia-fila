import React, { useState, useEffect } from "react";
import { Package, Plus, Search, AlertTriangle, Trash2, Edit2, Minus, PlusCircle } from "lucide-react";
import { listenProducts, updateProduct, removeProduct } from "../services/queueService";
import ProductModal from "./modals/ProductModal";

export default function InventoryView({ userId }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    useEffect(() => {
        if (userId) {
            const unsubscribe = listenProducts(userId, (data) => {
                setProducts(data);
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, [userId]);

    const handleEdit = (product) => {
        setEditingProduct(product);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Tem certeza que deseja remover este produto?")) {
            await removeProduct(userId, id);
        }
    };

    const handleStockChange = async (product, change) => {
        const newQuantity = Math.max(0, parseInt(product.quantity) + change);
        await updateProduct(userId, product.id, { quantity: newQuantity });
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate Low Stock
    const lowStockCount = products.filter(p => p.quantity <= (p.minQuantity || 5)).length;

    return (
        <div className="animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Package className="w-6 h-6 text-amber-500" />
                        Controle de Estoque
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Gerencie seus produtos de venda e consumo interno.
                    </p>
                </div>
                <button
                    onClick={() => { setEditingProduct(null); setShowModal(true); }}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-transform active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Novo Produto
                </button>
            </div>

            {/* Warning Banner */}
            {lowStockCount > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span className="text-red-400 font-medium">
                        Atenção: {lowStockCount} produtos com estoque baixo!
                    </span>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-800 border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
            </div>

            {/* Products Grid */}
            {loading ? (
                <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Nenhum produto encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map(product => {
                        const isLowStock = product.quantity <= (product.minQuantity || 5);

                        return (
                            <div key={product.id} className={`bg-gray-800 rounded-xl p-4 border transition-colors ${isLowStock ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-gray-700 hover:border-gray-600'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white text-lg">{product.name}</h3>
                                            {isLowStock && (
                                                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">BAIXO</span>
                                            )}
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${product.category === 'resale' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {product.category === 'resale' ? 'Revenda' : 'Consumo'}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleEdit(product)}
                                            className="p-1.5 text-gray-400 hover:text-white bg-gray-700 rounded-lg transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-400 bg-gray-700 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4 bg-gray-900/50 p-3 rounded-lg">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500">Estoque</span>
                                        <span className={`text-xl font-bold ${isLowStock ? 'text-red-500' : 'text-white'}`}>
                                            {product.quantity}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleStockChange(product, -1)}
                                            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-full text-white transition-colors"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleStockChange(product, 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-full text-white transition-colors"
                                        >
                                            <PlusCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 text-right">
                                    <span className="text-xs text-gray-500">
                                        {product.category === 'resale' ? 'Preço' : 'Custo'}:
                                        <span className="text-gray-300 font-mono ml-1">
                                            R$ {parseFloat(product.price || 0).toFixed(2)}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ProductModal
                show={showModal}
                onClose={() => setShowModal(false)}
                productToEdit={editingProduct}
            />
        </div>
    );
}
