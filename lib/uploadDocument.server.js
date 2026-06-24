import {
  getCloudinaryConfigError,
  isCloudinaryConfigured,
  uploadDocumentToCloudinary,
} from '@/lib/cloudinary.server';

export function validateDocumentFile(file, { imageOnly = false } = {}) {
  if (!file || typeof file === 'string') {
    return { ok: false, error: 'Missing file.' };
  }

  const contentType = String(file.type || 'application/octet-stream');
  const isImage = /^image\/(png|jpe?g)$/i.test(contentType);
  const allowed = imageOnly ? isImage : isImage || /^application\/pdf$/i.test(contentType);

  if (!allowed) {
    return {
      ok: false,
      error: imageOnly
        ? 'Invalid file type. Allowed: JPG, JPEG, PNG.'
        : 'Invalid file type. Allowed: PDF, JPG, JPEG, PNG.',
    };
  }

  return { ok: true, contentType };
}

export async function uploadDocumentFile({ file, folder, imageOnly = false }) {
  if (!isCloudinaryConfigured()) {
    return { ok: false, error: getCloudinaryConfigError() };
  }

  const validation = validateDocumentFile(file, { imageOnly });
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { url } = await uploadDocumentToCloudinary({
    buffer: bytes,
    folder,
    fileName: file.name,
    contentType: validation.contentType,
  });

  return { ok: true, path: url, url };
}
