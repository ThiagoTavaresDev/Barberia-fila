// Utility function to compress and convert image to base64
export async function compressImage(file, maxSizeMB = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions (max 800px on longest side)
                const maxDimension = 800;
                if (width > height && width > maxDimension) {
                    height = (height / width) * maxDimension;
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = (width / height) * maxDimension;
                    height = maxDimension;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Start with quality 0.8 and reduce if needed
                let quality = 0.8;
                let base64 = canvas.toDataURL('image/jpeg', quality);

                // If still too large, reduce quality
                while (base64.length > maxSizeMB * 1024 * 1024 && quality > 0.1) {
                    quality -= 0.1;
                    base64 = canvas.toDataURL('image/jpeg', quality);
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
