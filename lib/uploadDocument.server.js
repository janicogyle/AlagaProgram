import {
  getCloudinaryConfigError,
  isCloudinaryConfigured,
  uploadDocumentToCloudinary,
} from '@/lib/cloudinary.server';

const DEFAULT_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function getMaxDocumentBytes() {
  const configured = Number(process.env.MAX_DOCUMENT_UPLOAD_BYTES || DEFAULT_MAX_DOCUMENT_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_DOCUMENT_BYTES;
}

function hasExpectedSignature(buffer, contentType) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (contentType === 'application/pdf') {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (contentType === 'image/png') {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
  }
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

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

  const maxBytes = getMaxDocumentBytes();
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: 'The uploaded file is empty.' };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `File is too large. Maximum size is ${Math.ceil(maxBytes / (1024 * 1024))} MB.`,
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
  if (!hasExpectedSignature(bytes, validation.contentType)) {
    return { ok: false, error: 'The file contents do not match the declared file type.' };
  }
  const { url } = await uploadDocumentToCloudinary({
    buffer: bytes,
    folder,
    fileName: file.name,
    contentType: validation.contentType,
  });

  return { ok: true, path: url, url };
}
