// Client-side image shrinking so evidence and signatures fit in Firestore (1 MiB per document) on the free plan.
export const MAX_INLINE = 716800; // bytes of file data per evidence item (base64 adds about a third)
// Decode without blob: URLs (the Content Security Policy only allows data: and https: images).
const load = async (file) => {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall back below */
    }
  }
  const url = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('bad image'));
    i.src = url;
  });
};
/** Shrink an image to a JPEG of at most maxBytes. A white background keeps transparent PNGs readable. */
export async function shrink(file, { maxDim = 1600, maxBytes = MAX_INLINE } = {}) {
  const img = await load(file);
  let s = Math.min(1, maxDim / Math.max(img.width, img.height)),
    q = 0.85;
  for (let k = 0; k < 8; k++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * s));
    c.height = Math.max(1, Math.round(img.height * s));
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= maxBytes) return blob;
    q = Math.max(0.5, q - 0.1);
    s *= 0.8;
  }
  throw new Error('too large');
}
export const toDataUrl = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
export const dataUrlToBlob = (u) => {
  const [h, b] = u.split(','),
    bin = atob(b),
    a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: /data:([^;]+)/.exec(h)[1] });
};
