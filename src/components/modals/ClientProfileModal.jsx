import React, { useState, useEffect } from "react";
import { X, Calendar, History, Camera, Trash2, Plus, Image as ImageIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getClientProfile, addClientPhoto, getClientPhotos, deleteClientPhoto } from "../../services/queueService";
import { compressImage } from "../../utils/imageUtils";
import LoyaltyCard from "../LoyaltyCard";

export default function ClientProfileModal({ show, onClose, client }) {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [viewingPhoto, setViewingPhoto] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            if (!user?.uid || !client?.phone) return;

            setLoading(true);
            try {
                // Load Profile
                const profileData = await getClientProfile(user.uid, client.phone);
                setProfile(profileData || {
                    name: client.name,
                    phone: client.phone,
                    totalVisits: client.totalVisits || 1,
                    lastVisit: null
                });

                // Load Photos
                const photosData = await getClientPhotos(user.uid, client.phone);
                setPhotos(photosData);
            } catch (error) {
                console.error("Error loading client data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (show) {
            loadData();
        } else {
            setProfile(null);
            setPhotos([]);
        }
    }, [show, client, user]);

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !user?.uid) return;

        setUploading(true);
        try {
            const base64 = await compressImage(file);
            const photoData = {
                url: base64,
                serviceName: client.serviceName || "Serviço",
            };

            await addClientPhoto(user.uid, client.phone, photoData);

            // Refresh photos
            const updatedPhotos = await getClientPhotos(user.uid, client.phone);
            setPhotos(updatedPhotos);
        } catch (error) {
            console.error("Error uploading photo:", error);
            alert("Erro ao salvar foto.");
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePhoto = async (photoId) => {
        if (!window.confirm("Apagar esta foto?")) return;
        try {
            await deleteClientPhoto(user.uid, photoId);
            setPhotos(photos.filter(p => p.id !== photoId));
            if (viewingPhoto?.id === photoId) setViewingPhoto(null);
        } catch (error) {
            console.error("Error deleting photo:", error);
        }
    };

    if (!show || !client) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in text-white">
            <div className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gray-750 p-6 border-b border-gray-700 flex justify-between items-start shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-amber-500/20">
                            {client.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white leading-tight">{client.name}</h3>
                            <p className="text-sm text-gray-400 font-mono">{client.phone}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                        </div>
                    ) : (
                        <>
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-600/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <History className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs text-gray-400">Total de Visitas</span>
                                    </div>
                                    <p className="text-lg font-bold text-white">
                                        {profile?.totalVisits || (client.totalVisits ?? 1)}
                                    </p>
                                </div>
                                <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-600/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calendar className="w-4 h-4 text-green-400" />
                                        <span className="text-xs text-gray-400">Última Visita</span>
                                    </div>
                                    <p className="text-sm font-medium text-white truncate">
                                        {profile?.lastVisit
                                            ? new Date(profile.lastVisit).toLocaleDateString('pt-BR')
                                            : "Hoje"}
                                    </p>
                                </div>
                            </div>

                            {/* Loyalty Card Component */}
                            <div className="transform scale-[0.85] -my-4 origin-center">
                                <LoyaltyCard client={client} profile={profile} />
                            </div>

                            {/* Style Gallery */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-bold text-white flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-amber-500" />
                                        Galeria de Estilo
                                    </h4>
                                    <label className="bg-gray-700 hover:bg-gray-600 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1 text-white border border-gray-600">
                                        {uploading ? (
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <Plus className="w-3 h-3" />
                                        )}
                                        <span>Adicionar Foto</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handlePhotoUpload}
                                            disabled={uploading}
                                        />
                                    </label>
                                </div>

                                {photos.length === 0 ? (
                                    <div className="bg-gray-700/20 border border-gray-700 border-dashed rounded-lg p-6 text-center">
                                        <Camera className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">Nenhuma foto salva.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2">
                                        {photos.map((photo) => (
                                            <div
                                                key={photo.id}
                                                className="aspect-square bg-gray-700 rounded-lg overflow-hidden relative group cursor-pointer border border-gray-700"
                                                onClick={() => setViewingPhoto(photo)}
                                            >
                                                <img
                                                    src={photo.url}
                                                    alt="Estilo"
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                                                        className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {viewingPhoto && (
                <div
                    className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
                    onClick={() => setViewingPhoto(null)}
                >
                    <div className="relative max-w-2xl w-full">
                        <img
                            src={viewingPhoto.url}
                            alt="Visualização"
                            className="w-full h-auto rounded-lg shadow-2xl border border-gray-800"
                        />
                        <div className="mt-4 flex justify-between items-center text-gray-400 text-sm px-2">
                            <span>{new Date(viewingPhoto.createdAt).toLocaleDateString()}</span>
                            <span>{viewingPhoto.serviceName}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
