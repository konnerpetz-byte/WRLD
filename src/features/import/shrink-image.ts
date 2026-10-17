/**
 * Runs in the browser before upload. Phone screenshots and photos are often
 * 2–5 MB and the server takes 4.5 MB per request, so images are redrawn as
 * JPEG at reading size. This also applies the photo's rotation, converts iPhone
 * HEIC photos wherever the browser can open them (Safari), and trims the status
 * bar off phone screenshots so its clock ("9:41") isn't read as a flight time.
 */
const IMAGE = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i;

export const isImageFile = (f: File) => f.type.startsWith("image/") || IMAGE.test(f.name);

export async function shrinkImage(file: File): Promise<File> {
  if (!isImageFile(file)) return file;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // e.g. HEIC outside Safari: the server explains what to do
  }
  try {
    // Taller than ~19:10 is a phone screen, not a photo; its status bar is about an eighth of the width tall.
    const top = bmp.height / bmp.width > 1.9 ? Math.round(bmp.width * 0.13) : 0;
    const scale = Math.min(1, 1600 / bmp.width, 8000 / (bmp.height - top));
    const w = Math.round(bmp.width * scale);
    const h = Math.round((bmp.height - top) * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    if (!g) return file;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.drawImage(bmp, 0, top, bmp.width, bmp.height - top, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.9));
    if (!blob) return file;
    // Nothing trimmed and the original was already smaller (and readable on the server): keep it.
    if (!top && blob.size >= file.size && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    bmp.close();
  }
}
