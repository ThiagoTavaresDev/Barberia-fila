import React from "react";
import { X } from "lucide-react";

export default function AppointmentModal({ show, onClose, newAppointment, setNewAppointment, handleAddAppointment, services }) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Novo Agendamento</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-gray-300 mb-2">Nome do Cliente *</label>
                        <input
                            type="text"
                            value={newAppointment.name}
                            onChange={(e) => setNewAppointment({ ...newAppointment, name: e.target.value })}
                            placeholder="Nome completo"
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Telefone</label>
                        <input
                            type="tel"
                            value={newAppointment.phone}
                            onChange={(e) => setNewAppointment({ ...newAppointment, phone: e.target.value })}
                            placeholder="(00) 00000-0000"
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-300 mb-2">Data *</label>
                            <input
                                type="date"
                                value={newAppointment.date}
                                onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-300 mb-2">Horário *</label>
                            <input
                                type="time"
                                value={newAppointment.time}
                                onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Serviço (opcional)</label>
                        <select
                            value={newAppointment.serviceId}
                            onChange={(e) => setNewAppointment({ ...newAppointment, serviceId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="">A definir</option>
                            {services.map((service) => (
                                <option key={service.id} value={service.id}>
                                    {service.name} ({service.duration} min - R$ {service.price})
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleAddAppointment}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-colors"
                    >
                        Criar Agendamento
                    </button>
                </div>
            </div>
        </div>
    );
}
