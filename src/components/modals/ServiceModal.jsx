import React from "react";
import { X, Plus, Trash2 } from "lucide-react";

export default function ServiceModal({ show, onClose, newService, setNewService, handleAddService, services, handleRemoveService }) {
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
                            <button
                                onClick={handleAddService}
                                className="bg-amber-600 hover:bg-amber-700 text-white p-2 rounded-lg flex-shrink-0"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
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
