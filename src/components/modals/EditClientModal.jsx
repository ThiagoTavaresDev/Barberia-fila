import React from "react";
import { X, Camera } from "lucide-react";
import { compressImage } from "../../utils/imageUtils";

export default function EditClientModal({
    client,
    setClient,
    onClose,
    handleSave,
    services,
    setViewingPhoto
}) {
    if (!client) return null;

    const handlePhotoUpload = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const base64 = await compressImage(file);
                setClient({ ...client, photoUrl: base64 });
            } catch (error) {
                console.error('Error uploading photo:', error);
                alert('Erro ao salvar foto. Tente novamente.');
            }
        };
        input.click();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Editar Cliente</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-gray-300 mb-2">Nome</label>
                        <input
                            type="text"
                            value={client.name}
                            onChange={(e) => setClient({ ...client, name: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Telefone</label>
                        <input
                            type="tel"
                            value={client.phone}
                            disabled={client.noPhone}
                            onChange={(e) => setClient({ ...client, phone: e.target.value })}
                            className={`w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${client.noPhone ? 'opacity-50' : ''}`}
                        />
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Serviço</label>
                        <select
                            value={client.serviceId}
                            onChange={(e) => setClient({ ...client, serviceId: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            {services.map((service) => (
                                <option key={service.id} value={service.id}>
                                    {service.name} ({service.duration} min)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Observações / Preferências</label>
                        <textarea
                            value={client.notes || ""}
                            onChange={(e) => setClient({ ...client, notes: e.target.value })}
                            placeholder="Ex: Usa máquina 2 nas laterais, não gosta de gel..."
                            rows={3}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2">Foto do Corte</label>
                        {client.photoUrl ? (
                            <div className="space-y-2">
                                <div className="relative">
                                    <img
                                        src={client.photoUrl}
                                        alt="Foto atual"
                                        className="w-full h-40 object-cover rounded-lg cursor-pointer"
                                        onClick={() => setViewingPhoto(client.photoUrl)}
                                    />
                                    <button
                                        onClick={() => setClient({ ...client, photoUrl: "" })}
                                        className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                                        title="Remover foto"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    onClick={handlePhotoUpload}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    <Camera className="w-4 h-4" />
                                    Substituir Foto
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handlePhotoUpload}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                <Camera className="w-4 h-4" />
                                Adicionar Foto
                            </button>
                        )}
                    </div>

                    <button
                        onClick={handleSave}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
}
