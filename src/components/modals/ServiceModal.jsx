
import React from "react";
import { X, Plus, Trash2, ChevronDown, Package } from "lucide-react";

export default function ServiceModal({ show, onClose, newService, setNewService, handleAddService, services, handleRemoveService, products }) {
    const [selectedMaterial, setSelectedMaterial] = React.useState("");
    const [quantity, setQuantity] = React.useState("1");

    const addMaterial = () => {
        if (!selectedMaterial || !quantity) return;
        const product = products.find(p => p.id === selectedMaterial);
        if (!product) return;

        const currentMaterials = newService.materials || [];
        setNewService({
            ...newService,
            materials: [...currentMaterials, { productId: selectedMaterial, name: product.name, quantity: parseInt(quantity) }]
        });
        setSelectedMaterial("");
        setQuantity("1");
    };

    const removeMaterial = (index) => {
        const currentMaterials = newService.materials || [];
        const updated = currentMaterials.filter((_, i) => i !== index);
        setNewService({ ...newService, materials: updated });
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <input
                            type="text"
                            value={newService.name}
                            onChange={(e) =>
                                setNewService({ ...newService, name: e.target.value })
                            }
                            placeholder="Nome do serviço"
                            className="flex-1 min-w-[150px] px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={newService.duration}
                                onChange={(e) =>
                                    setNewService({ ...newService, duration: e.target.value })
                                }
                                placeholder="Min"
                                className="w-20 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <input
                                type="number"
                                value={newService.price}
                                onChange={(e) =>
                                    setNewService({ ...newService, price: e.target.value })
                                }
                                placeholder="R$"
                                className="w-20 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    {/* Material Selection */}
                    {products && products.length > 0 && (
                        <div className="bg-gray-700/30 border border-gray-600 p-4 rounded-xl space-y-4">
                            <label className="text-sm text-gray-300 font-medium flex items-center gap-2">
                                <Package className="w-4 h-4 text-amber-500" />
                                Consumo de Estoque (Opcional)
                            </label>

                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <select
                                        value={selectedMaterial}
                                        onChange={(e) => setSelectedMaterial(e.target.value)}
                                        className="w-full appearance-none bg-gray-800 text-white border border-gray-600 rounded-lg pl-4 pr-10 py-3 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
                                    >
                                        <option value="">Selecione um material...</option>
                                        {products.filter(p => p.category === 'consumable').map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.measurement})</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    </div>
                                </div>

                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="Qtd"
                                    className="w-24 bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500 text-center"
                                />
                            </div>

                            <button
                                onClick={addMaterial}
                                disabled={!selectedMaterial || !quantity}
                                className="w-full bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Adicionar Material
                            </button>

                            {/* Added Materials List */}
                            {newService.materials && newService.materials.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {newService.materials.map((mat, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full text-sm text-gray-300">
                                            <span className="text-amber-500 font-bold">{mat.quantity}x</span>
                                            <span>{mat.name}</span>
                                            <button
                                                onClick={() => removeMaterial(idx)}
                                                className="p-1 hover:bg-gray-700 rounded-full text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleAddService}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white p-2 rounded-lg flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Cadastrar Serviço
                    </button>

                    <div className="space-y-2 max-h-60 overflow-y-auto pt-4 border-t border-gray-700">
                        {services.map((service) => (
                            <div
                                key={service.id}
                                className="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
                            >
                                <div>
                                    <p className="text-white font-medium">{service.name}</p>
                                    <p className="text-sm text-gray-400">
                                        {service.duration} min • R$ {service.price}
                                    </p>
                                    {service.materials && service.materials.length > 0 && (
                                        <p className="text-xs text-amber-500/80 mt-1">
                                            Deduz: {service.materials.map(m => `${m.quantity}x ${m.name} `).join(', ')}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleRemoveService(service.id)}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

