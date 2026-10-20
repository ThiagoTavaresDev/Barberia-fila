import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Check, ZoomIn, ZoomOut } from "lucide-react";

const OUTPUT_SIZE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Janela de recorte quadrado (estilo foto de perfil do WhatsApp): o usuário arrasta e dá zoom
// na imagem; ao confirmar devolve um data URL OUTPUT_SIZE x OUTPUT_SIZE já pronto para salvar.
export default function ImageCropModal({ file, onCancel, onConfirm }) {
    const [img, setImg] = useState(null);
    const [error, setError] = useState("");
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 }); // centro da imagem em relação ao centro da janela
    const pointers = useRef(new Map());
    const pinchStart = useRef(null);

    const viewport = useMemo(() => Math.min(320, window.innerWidth - 64), []);

    useEffect(() => {
        // `cancelled` evita que o carregamento de uma execução antiga do efeito (ex.: StrictMode
        // em desenvolvimento, que monta duas vezes) sobrescreva o resultado da execução atual.
        let cancelled = false;
        const url = URL.createObjectURL(file);

        const load = (src, onFail) => {
            const image = new Image();
            image.onload = () => { if (!cancelled) setImg(image); };
            image.onerror = () => { if (!cancelled) onFail(); };
            image.src = src;
        };
        const fail = () => setError("Não foi possível abrir essa imagem. Tente outra foto.");

        setImg(null);
        setError("");
        load(url, () => {
            // Alternativa: lê o arquivo como data URL caso o blob não carregue
            const reader = new FileReader();
            reader.onload = () => { if (!cancelled) load(reader.result, fail); };
            reader.onerror = () => { if (!cancelled) fail(); };
            reader.readAsDataURL(file);
        });

        return () => {
            cancelled = true;
            URL.revokeObjectURL(url);
        };
    }, [file]);

    // Escala "cover": a imagem sempre preenche a janela inteira
    const baseScale = img ? viewport / Math.min(img.naturalWidth, img.naturalHeight) : 1;
    const scale = baseScale * zoom;

    const clampOffset = (o, s) => {
        if (!img) return o;
        const maxX = Math.max(0, (img.naturalWidth * s - viewport) / 2);
        const maxY = Math.max(0, (img.naturalHeight * s - viewport) / 2);
        return { x: clamp(o.x, -maxX, maxX), y: clamp(o.y, -maxY, maxY) };
    };

    const changeZoom = (nextZoom) => {
        const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        const ratio = z / zoom;
        setZoom(z);
        // Mantém o ponto central da janela no mesmo lugar ao dar zoom
        setOffset((o) => clampOffset({ x: o.x * ratio, y: o.y * ratio }, baseScale * z));
    };

    const pointerDistance = () => {
        const [a, b] = [...pointers.current.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const handlePointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) pinchStart.current = { distance: pointerDistance(), zoom };
    };

    const handlePointerMove = (e) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.current.size === 2 && pinchStart.current) {
            changeZoom(pinchStart.current.zoom * (pointerDistance() / pinchStart.current.distance));
        } else if (pointers.current.size === 1) {
            const dx = e.clientX - prev.x;
            const dy = e.clientY - prev.y;
            setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, scale));
        }
    };

    const handlePointerUp = (e) => {
        pointers.current.delete(e.pointerId);
        pinchStart.current = null;
    };

    const handleWheel = (e) => changeZoom(zoom - e.deltaY * 0.002);

    const handleConfirm = () => {
        if (!img) return;
        const canvas = document.createElement("canvas");
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext("2d");

        const isJpeg = file.type === "image/jpeg";
        if (isJpeg) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        }

        // Trecho da imagem original que está visível dentro da janela
        const sourceSize = viewport / scale;
        const sx = (img.naturalWidth * scale / 2 - viewport / 2 - offset.x) / scale;
        const sy = (img.naturalHeight * scale / 2 - viewport / 2 - offset.y) / scale;

        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

        onConfirm(isJpeg ? canvas.toDataURL("image/jpeg", 0.9) : canvas.toDataURL("image/png"));
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Ajustar logo</h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white" aria-label="Fechar">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {error ? (
                    <p className="text-red-400 text-sm">{error}</p>
                ) : (
                    <>
                        <p className="text-gray-400 text-sm">Arraste para enquadrar e use o zoom para ajustar.</p>

                        <div
                            className="relative mx-auto overflow-hidden rounded-2xl bg-gray-900 select-none cursor-grab active:cursor-grabbing"
                            style={{ width: viewport, height: viewport, touchAction: "none" }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onWheel={handleWheel}
                        >
                            {img && (
                                <img
                                    src={img.src}
                                    alt=""
                                    draggable={false}
                                    className="absolute max-w-none pointer-events-none"
                                    style={{
                                        width: img.naturalWidth * scale,
                                        height: img.naturalHeight * scale,
                                        left: viewport / 2 + offset.x - (img.naturalWidth * scale) / 2,
                                        top: viewport / 2 + offset.y - (img.naturalHeight * scale) / 2,
                                    }}
                                />
                            )}
                            <div className="absolute inset-0 rounded-2xl ring-2 ring-white/70 pointer-events-none" />
                        </div>

                        <div className="flex items-center gap-3">
                            <ZoomOut className="w-5 h-5 text-gray-400 shrink-0" />
                            <input
                                type="range"
                                min={MIN_ZOOM}
                                max={MAX_ZOOM}
                                step="0.01"
                                value={zoom}
                                onChange={(e) => changeZoom(parseFloat(e.target.value))}
                                className="w-full accent-amber-500"
                                aria-label="Zoom"
                            />
                            <ZoomIn className="w-5 h-5 text-gray-400 shrink-0" />
                        </div>
                    </>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!img}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                        <Check className="w-5 h-5" /> Usar foto
                    </button>
                </div>
            </div>
        </div>
    );
}
