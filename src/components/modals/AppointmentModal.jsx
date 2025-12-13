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

                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                        <label className="flex items-center cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={newAppointment.recurrenceCount > 1}
                                    onChange={(e) => setNewAppointment({ ...newAppointment, recurrenceCount: e.target.checked ? 4 : 1 })}
                                />
                                <div className="w-10 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                            </div>
                            <span className="ml-3 text-white font-medium group-hover:text-amber-500 transition-colors">Repetir semanalmente?</span>
                        </label>

                        {newAppointment.recurrenceCount > 1 && (
                            <div className="mt-3 animate-fade-in">
                                <label className="block text-gray-400 text-sm mb-1">Por quantas semanas?</label>
                                <select
                                    value={newAppointment.recurrenceCount}
                                    onChange={(e) => setNewAppointment({ ...newAppointment, recurrenceCount: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="2">2 semanas</option>
                                    <option value="4">4 semanas (1 mês)</option>
                                    <option value="8">8 semanas (2 meses)</option>
                                    <option value="12">12 semanas (3 meses)</option>
                                </select>
                                <p className="text-xs text-gray-400 mt-2">
                                    Serão criados agendamentos para o mesmo dia e horário nas próximas semanas.
                                </p>
                            </div>
                        )}
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
