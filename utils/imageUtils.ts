
/**
 * Compresses a base64 image string to be under a target size (default 800KB).
 */
export const compressImage = async (base64Str: string, targetSizeKB: number = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Initial scaling if too large
      const maxDimension = 1024;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.9;
      let compressedBase64 = canvas.toDataURL('image/jpeg', quality);

      // Iteratively reduce quality until size is acceptable
      while (compressedBase64.length * 0.75 > targetSizeKB * 1024 && quality > 0.1) {
        quality -= 0.1;
        compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(compressedBase64);
    };
    img.onerror = (e) => reject(e);
    img.src = base64Str;
  });
};
