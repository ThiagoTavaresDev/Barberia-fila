// Utility function to compress and convert image to base64 (JPEG)
//
//   maxSizeMB     limite aproximado do texto base64 gerado (1 MB = 1024*1024 caracteres)
//   maxDimension  maior lado da imagem final em pixels (padrão 800; comprovantes usam mais, para ficarem legíveis)
//
// O resultado é sempre uma imagem JPEG nova desenhada em canvas: remove metadados (EXIF/GPS)
// e qualquer conteúdo embutido no arquivo original.
export async function compressImage(file, maxSizeMB = 0.8, { maxDimension = 800 } = {}) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const limit = maxSizeMB * 1024 * 1024;

                // Calculate new dimensions (max `maxDimension` px on longest side)
                let width = img.width;
                let height = img.height;
                if (width > height && width > maxDimension) {
                    height = (height / width) * maxDimension;
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = (width / height) * maxDimension;
                    height = maxDimension;
                }

                const render = (w, h, quality) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(w));
                    canvas.height = Math.max(1, Math.round(h));
                    const ctx = canvas.getContext('2d');
                    // Fundo branco: PNG com transparência não pode virar preto no JPEG
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    return canvas.toDataURL('image/jpeg', quality);
                };

                // Start with quality 0.8 and reduce if needed
                let quality = 0.8;
                let base64 = render(width, height, quality);
                while (base64.length > limit && quality > 0.2) {
                    quality -= 0.1;
                    base64 = render(width, height, quality);
                }

                // Ainda grande: diminui as dimensões aos poucos
                let scale = 1;
                while (base64.length > limit && scale > 0.3) {
                    scale -= 0.15;
                    base64 = render(width * scale, height * scale, 0.7);
                }

                resolve(base64);
            };

            img.onerror = reject;
            img.src = e.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
