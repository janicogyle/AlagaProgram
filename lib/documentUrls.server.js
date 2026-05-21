import { isCloudinaryUrl } from '@/lib/cloudinary.server';

/**
 * Keep only Cloudinary HTTPS URLs (drops legacy Supabase Storage paths).
 */
export function filterCloudinaryUrls(urls) {
  if (!urls) return [];
  const list = Array.isArray(urls) ? urls : [urls];
  return list.map((u) => String(u || '').trim()).filter((u) => u && isCloudinaryUrl(u));
}

/**
 * Reject non-Cloudinary document references before saving to the database.
 */
export function validateCloudinaryDocumentUrls(urls, { label = 'Document' } = {}) {
  const list = Array.isArray(urls) ? urls : urls ? [urls] : [];
  for (const raw of list) {
    const value = String(raw || '').trim();
    if (!value) continue;
    if (!isCloudinaryUrl(value)) {
      return {
        ok: false,
        error: `${label} must be uploaded to Cloudinary (https://res.cloudinary.com/...).`,
      };
    }
  }
  return { ok: true };
}
