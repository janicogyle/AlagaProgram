const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i;
const PDF_EXT = /\.pdf$/i;

export function getUrlPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return new URL(raw).pathname;
  } catch {
    return raw.split('?')[0].split('#')[0];
  }
}

export function isLikelyImage(...sources) {
  return sources
    .filter(Boolean)
    .some((source) => IMAGE_EXT.test(getUrlPath(source)));
}

export function isLikelyPdf(...sources) {
  return sources
    .filter(Boolean)
    .some((source) => PDF_EXT.test(getUrlPath(source)));
}
