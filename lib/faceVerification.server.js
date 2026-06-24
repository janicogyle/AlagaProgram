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

async function verifyWithMock({ idImageUrl, selfieUrl }) {
  const forced = normalizeStatus(process.env.FACE_VERIFICATION_MOCK_RESULT || 'passed');
  const combined = `${idImageUrl} ${selfieUrl}`.toLowerCase();
  let status = forced;
  if (!process.env.FACE_VERIFICATION_MOCK_RESULT) {
    if (combined.includes('manual')) status = 'manual_review';
    else if (combined.includes('fail') || combined.includes('mismatch')) status = 'failed';
  }

  return {
    status,
    score: normalizeScore(process.env.FACE_VERIFICATION_MOCK_SCORE, status === 'passed' ? 0.98 : 0.32),
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
