export const FACE_VERIFICATION_STATUSES = new Set(['passed', 'failed', 'manual_review']);

export const FACE_VERIFICATION_MESSAGES = {
  failed: 'Face verification failed. Please make sure your selfie clearly matches the photo on your valid ID.',
  manual_review: 'Face verification requires manual review.',
};

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return FACE_VERIFICATION_STATUSES.has(status) ? status : 'manual_review';
}

function normalizeScore(value, fallback = null) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(1, score));
}

function assertInput({ idImageUrl, selfieUrl }) {
  if (!idImageUrl || !selfieUrl) {
    return { ok: false, error: 'Front valid ID image and selfie are required for face verification.' };
  }
  return { ok: true };
}

function getThreshold() {
  return normalizeScore(process.env.FACE_VERIFICATION_THRESHOLD, 0.8);
}

function getMockThreshold() {
  return normalizeScore(process.env.FACE_VERIFICATION_MOCK_THRESHOLD, getThreshold());
}

function getMockScore() {
  return normalizeScore(process.env.FACE_VERIFICATION_MOCK_SCORE, 0.32);
}

function getCompreFaceConfig() {
  const baseUrl = String(
    process.env.COMPREFACE_BASE_URL ||
      process.env.COMPREFACE_URL ||
      process.env.FACE_VERIFICATION_COMPREFACE_URL ||
      ''
  ).trim().replace(/\/+$/g, '');
  const apiKey = String(
    process.env.COMPREFACE_API_KEY ||
      process.env.FACE_VERIFICATION_COMPREFACE_API_KEY ||
      ''
  ).trim();
  const endpoint = String(
    process.env.COMPREFACE_VERIFY_ENDPOINT ||
      '/api/v1/verification/verify'
  ).trim();

  if (!baseUrl || !apiKey) {
    return {
      ok: false,
      error: 'CompreFace is not configured. Set COMPREFACE_BASE_URL and COMPREFACE_API_KEY.',
    };
  }

  return {
    ok: true,
    apiKey,
    url: `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`,
  };
}

async function imageUrlToBlob(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load ${label} image for face verification.`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!/^image\/(png|jpe?g|webp)$/i.test(contentType)) {
    throw new Error(`${label} must be an image file.`);
  }

  const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  return {
    blob: new Blob([await response.arrayBuffer()], { type: contentType }),
    fileName: `${label.toLowerCase().replace(/\s+/g, '-')}.${extension}`,
  };
}

function getCompreFaceSimilarity(payload) {
  const scores = [];
  const collect = (value) => {
    const score = normalizeScore(value, null);
    if (score !== null) scores.push(score);
  };

  collect(payload?.similarity);
  collect(payload?.score);

  const results = Array.isArray(payload?.result) ? payload.result : [];
  for (const item of results) {
    collect(item?.similarity);
    collect(item?.score);
    const matches = Array.isArray(item?.face_matches) ? item.face_matches : [];
    for (const match of matches) {
      collect(match?.similarity);
      collect(match?.score);
    }
  }

  return scores.length ? Math.max(...scores) : null;
}

async function verifyWithCompreFace({ idImageUrl, selfieUrl }) {
  const config = getCompreFaceConfig();
  if (!config.ok) {
    return {
      status: 'manual_review',
      score: null,
      provider: 'compreface',
      error: config.error,
    };
  }

  try {
    const [idImage, selfieImage] = await Promise.all([
      imageUrlToBlob(idImageUrl, 'Valid ID'),
      imageUrlToBlob(selfieUrl, 'Selfie'),
    ]);

    const form = new FormData();
    form.append('source_image', idImage.blob, idImage.fileName);
    form.append('target_image', selfieImage.blob, selfieImage.fileName);

    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'x-api-key': config.apiKey },
      body: form,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        status: 'manual_review',
        score: null,
        provider: 'compreface',
        error: payload?.message || payload?.error || 'CompreFace verification request failed.',
      };
    }

    const score = getCompreFaceSimilarity(payload);
    if (score === null) {
      return {
        status: 'failed',
        score: null,
        provider: 'compreface',
        error: 'CompreFace did not detect a comparable face in one or both images.',
      };
    }

    const status = score >= getThreshold() ? 'passed' : 'failed';
    return {
      status,
      score,
      provider: 'compreface',
      error: status === 'passed' ? null : FACE_VERIFICATION_MESSAGES.failed,
    };
  } catch (error) {
    return {
      status: 'manual_review',
      score: null,
      provider: 'compreface',
      error: error?.message || 'CompreFace verification failed.',
    };
  }
}

async function verifyWithMock({ idImageUrl, selfieUrl }) {
  const explicitResult = String(process.env.FACE_VERIFICATION_MOCK_RESULT || '').trim();
  const combined = `${idImageUrl} ${selfieUrl}`.toLowerCase();
  const threshold = getMockThreshold();
  let score = getMockScore();
  let status = score >= threshold ? 'passed' : 'failed';

  if (explicitResult) {
    status = normalizeStatus(explicitResult);
    score = normalizeScore(process.env.FACE_VERIFICATION_MOCK_SCORE, status === 'passed' ? 0.98 : 0.32);
  } else if (combined.includes('manual')) {
    status = 'manual_review';
  } else if (combined.includes('fail') || combined.includes('mismatch')) {
    score = normalizeScore(process.env.FACE_VERIFICATION_MOCK_SCORE, 0.32);
    status = 'failed';
  } else if (combined.includes('pass') || combined.includes('match')) {
    score = normalizeScore(process.env.FACE_VERIFICATION_MOCK_SCORE, 0.98);
    status = score >= threshold ? 'passed' : 'failed';
  }

  return {
    status,
    score,
    provider: 'mock',
    error: status === 'passed' ? null : FACE_VERIFICATION_MESSAGES[status],
  };
}

export async function verifyFaceMatch(input = {}) {
  const validation = assertInput(input);
  if (!validation.ok) {
    return {
      status: 'manual_review',
      score: null,
      provider: getFaceVerificationProvider(),
      error: validation.error,
    };
  }

  const provider = getFaceVerificationProvider();

  if (provider === 'compreface') {
    return verifyWithCompreFace(input);
  }

  if (provider === 'mock') {
    return verifyWithMock(input);
  }

  return {
    status: 'manual_review',
    score: null,
    provider,
    error: `Face verification provider "${provider}" is not implemented.`,
  };
}

export function getFaceVerificationProvider() {
  return String(process.env.FACE_VERIFICATION_PROVIDER || 'mock').trim().toLowerCase() || 'mock';
}

export function toFaceVerificationLabel(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'passed') return 'Face Match Passed';
  if (normalized === 'failed') return 'Face Match Failed';
  return 'Manual Review Required';
}