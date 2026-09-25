export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const LOGO_MAX_BYTES = 512 * 1024;
export const LOGO_MAX_SIZE = 512;

const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export type LogoError = 'invalid-type' | 'unreadable' | 'too-large';

export class LogoImageError extends Error {
  constructor(readonly code: LogoError) {
    super(code);
  }
}

const encode = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));

export async function prepareLogo(file: File): Promise<Blob> {
  if (!LOGO_TYPES.includes(file.type) || file.size > MAX_INPUT_BYTES) {
    throw new LogoImageError('invalid-type');
  }
  if (file.type === 'image/gif') {
    if (file.size > LOGO_MAX_BYTES) throw new LogoImageError('too-large');
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new LogoImageError('unreadable');
  }

  const scale = Math.min(1, LOGO_MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= LOGO_MAX_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new LogoImageError('unreadable');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const png = await encode(canvas, 'image/png');
  if (png && png.size <= LOGO_MAX_BYTES) return png;
  const webp = await encode(canvas, 'image/webp', 0.9);
  if (webp && webp.type === 'image/webp' && webp.size <= LOGO_MAX_BYTES) return webp;
  throw new LogoImageError('too-large');
}
