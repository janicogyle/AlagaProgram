import {
  getCloudinaryConfigError,
  isCloudinaryConfigured,
  uploadDocumentToCloudinary,
} from '@/lib/cloudinary.server';

export function validateDocumentFile(file) {
  if (!file || typeof file === 'string') {
    return { ok: false, error: 'Missing file.' };
  }

  const contentType = String(file.type || 'application/octet-stream');
  const allowed =
    /^image\/(png|jpe?g)$/i.test(contentType) || /^application\/pdf$/i.test(contentType);

  if (!allowed) {
    return { ok: false, error: 'Invalid file type. Allowed: PDF, JPG, JPEG, PNG.' };
  }

  return { ok: true, contentType };
}

export async function uploadDocumentFile({ file, folder }) {
  if (!isCloudinaryConfigured()) {
    return { ok: false, error: getCloudinaryConfigError() };
  }

  const validation = validateDocumentFile(file);
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
