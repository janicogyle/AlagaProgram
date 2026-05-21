import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

let configured = false;

function parseCloudinaryUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/i);
  if (!match) return null;
  return {
    api_key: decodeURIComponent(match[1]),
    api_secret: decodeURIComponent(match[2]),
    cloud_name: match[3],
  };
}

function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

export function isCloudinaryConfigured() {
  if (configured) return true;

  const cloudinaryUrl = String(process.env.CLOUDINARY_URL || '').trim();
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

  if (cloudinaryUrl) {
    const parsed = parseCloudinaryUrl(cloudinaryUrl);
    if (parsed) {
      cloudinary.config({ ...parsed, secure: true });
      configured = true;
      return true;
    }
  }

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
    return true;
  }

  return false;
}

export function getCloudinaryConfigError() {
  return 'Server configuration error. Missing CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).';
}

function safeFileName(name) {
  return String(name || 'document')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}

/**
 * Upload a document buffer to Cloudinary.
 * @returns {{ url: string, publicId: string }}
 */
export async function uploadDocumentToCloudinary({ buffer, folder, fileName, contentType }) {
  if (!isCloudinaryConfigured()) {
    throw new Error(getCloudinaryConfigError());
  }

  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const publicId = `${rand}-${safeFileName(fileName)}`;
  const normalizedFolder = String(folder || 'alaga')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '_');

  const isPdf = /^application\/pdf$/i.test(String(contentType || ''));
  const resourceType = isPdf ? 'raw' : 'auto';

  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: normalizedFolder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
      },
      (error, uploadResult) => {
        if (error) reject(error);
        else resolve(uploadResult);
      },
    );

    bufferToStream(buffer).pipe(uploadStream);
  });

  const url = result?.secure_url || result?.url;
  if (!url) {
    throw new Error('Cloudinary upload succeeded but returned no URL.');
  }

  return {
    url,
    publicId: result.public_id,
  };
}

export function isStoredDocumentUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export function isCloudinaryUrl(value) {
  const raw = String(value || '').trim();
  return /res\.cloudinary\.com/i.test(raw);
}
