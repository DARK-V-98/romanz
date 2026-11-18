// Resize an uploaded photo in the browser before storing it (stands in for the storage bucket's image transforms).
export function resizeImage(file, max = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(Error(file.name + ': only JPG, PNG or WebP photos.'));
    if (file.size > 8 * 1024 * 1024) return reject(Error(file.name + ': photos must be 8 MB or smaller.'));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      const webp = c.toDataURL('image/webp', quality);
      resolve(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', quality));
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(Error(file.name + ': could not read this image.')); };
    im.src = url;
  });
}
