const addHttpsProtocol = (url) => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `https://${url}`;
};

export const normalizeSupabaseUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return null;
  }

  return addHttpsProtocol(trimmedUrl).replace(/\/+$/, '');
};
