import crypto from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { signHmacToken, verifyHmacToken } from '@/lib/hmacTokens.server';
import { analyzeImageQualityPixels, getImageQualityIssue } from '@/lib/imageQuality.mjs';
import {
  identityTextContainsBirthDate,
  identityTextMatchesProfileName,
  maskIdNumber,
  namesMatch,
  normalizeIdentityName,
  parsePhilippineIdentityText,
} from '@/lib/identityOcrParsing.mjs';

const OCR_ENDPOINT = 'https://api.ocr.space/Parse/Image';
const TOKEN_TYPE = 'account-request-id-ocr';
const TOKEN_MAX_AGE_SECONDS = 30 * 60;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIN_SHORT_EDGE = 400;
const MIN_LONG_EDGE = 640;
const MIN_SHARPNESS = 35;

function getSecret() {
  return String(process.env.OCR_SPACE_API_KEY || '').trim();
}

function errorMessage(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ');
  return String(value || '').trim();
}

export async function fileToIdentityImage(file, label = 'ID image') {
  if (!(file instanceof Blob) || file.size <= 0) {
    throw Object.assign(new Error(`${label} is required.`), { code: 'INVALID_FILE', status: 400 });
  }
  if (!/^image\/(?:jpeg|png)$/i.test(file.type || '')) {
    throw Object.assign(new Error(`${label} must be a JPG or PNG image.`), { code: 'INVALID_FILE', status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    throw Object.assign(new Error(`${label} must not exceed 5 MB.`), { code: 'INVALID_FILE', status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let image;
  try {
    image = await loadImage(bytes);
  } catch {
    throw Object.assign(new Error(`${label} could not be read. Upload a valid JPG or PNG image.`), {
      code: 'INVALID_FILE',
      status: 400,
    });
  }

  const shortEdge = Math.min(image.width, image.height);
  const longEdge = Math.max(image.width, image.height);
  if (shortEdge < MIN_SHORT_EDGE || longEdge < MIN_LONG_EDGE) {
    throw Object.assign(
      new Error(`${label} is too small. Retake it closer to the ID with the text in focus.`),
      { code: 'LOW_RESOLUTION', status: 422 },
    );
  }

  const sampleScale = Math.min(1, 600 / longEdge);
  const width = Math.max(2, Math.round(image.width * sampleScale));
  const height = Math.max(2, Math.round(image.height * sampleScale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const quality = analyzeImageQualityPixels({ data: pixels, width, height, step: 2 });
  const qualityIssue = getImageQualityIssue(quality, {
    label,
    minSharpness: MIN_SHARPNESS,
    minBrightness: 50,
    minContrast: 16,
  });
  if (qualityIssue) {
    throw Object.assign(
      new Error(qualityIssue),
      { code: quality.sharpness < MIN_SHARPNESS ? 'BLURRY_IMAGE' : 'POOR_LIGHTING', status: 422 },
    );
  }

  return {
    file,
    bytes,
    hash: crypto.createHash('sha256').update(bytes).digest('hex'),
    width: image.width,
    height: image.height,
    sharpness: quality.sharpness,
    quality,
  };
}

async function callOcrSpace(image) {
  const apiKey = getSecret();
  if (!apiKey) {
    throw Object.assign(new Error('ID verification is temporarily unavailable. Please try again later.'), { code: 'OCR_NOT_CONFIGURED', status: 503 });
  }
  const form = new FormData();
  form.append('file', new Blob([image.bytes], { type: image.file.type }), image.file.name || 'valid-id.jpg');
  form.append('language', 'eng');
  form.append('isOverlayRequired', 'false');
  form.append('detectOrientation', 'true');
  form.append('scale', 'true');
  form.append('OCREngine', '2');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await fetch(OCR_ENDPOINT, {
      method: 'POST',
      headers: { apikey: apiKey },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'ID verification timed out. Please try again.'
      : 'ID verification is temporarily unavailable. Please try again.';
    throw Object.assign(new Error(message), { code: 'OCR_UNAVAILABLE', status: 503 });
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.IsErroredOnProcessing || !Array.isArray(payload.ParsedResults)) {
    const message = errorMessage(payload?.ErrorMessage) || 'We could not read this ID. Retake a clearer image.';
    throw Object.assign(new Error(message), {
      code: response.status === 429 ? 'OCR_RATE_LIMITED' : 'OCR_FAILED',
      status: response.status === 429 ? 429 : 422,
    });
  }
  const parsedText = payload.ParsedResults
    .filter((result) => Number(result?.FileParseExitCode) === 1)
    .map((result) => String(result?.ParsedText || '').trim())
    .filter(Boolean)
    .join('\n');
  if (parsedText.replace(/\s/g, '').length < 30) {
    throw Object.assign(new Error('We could not read enough details from the ID. Retake a clearer, closer image.'), {
      code: 'INCOMPLETE_OCR',
      status: 422,
    });
  }
  return parsedText;
}

function normalizeBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

export async function verifyIdentityWithOcr({ primaryFile, reverseFile, profile = {} }) {
  const primary = await fileToIdentityImage(primaryFile, 'Primary ID image');
  const reverse = await fileToIdentityImage(reverseFile, 'Reverse ID image');
  const texts = await Promise.all([callOcrSpace(primary), callOcrSpace(reverse)]);
  const combinedOcrText = texts.filter(Boolean).join('\n');
  const parsed = parsePhilippineIdentityText(combinedOcrText);
  const expectedBirthDate = normalizeBirthDate(profile.birthDate);
  const expectedFullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

  if (!parsed.supported) {
    const message = parsed.unsupportedLabel
      ? `${parsed.unsupportedLabel} is not supported. Upload one of the accepted IDs listed below.`
      : 'The ID type could not be detected. Retake a clear photo of a supported Philippine ID.';
    throw Object.assign(new Error(message), { code: parsed.unsupportedLabel ? 'UNSUPPORTED_ID' : 'ID_TYPE_UNDETECTED', status: 422 });
  }

  if (
    (!parsed.fields.fullName || !namesMatch(parsed.fields.fullName, profile)) &&
    identityTextMatchesProfileName(combinedOcrText, profile)
  ) {
    parsed.fields.fullName = expectedFullName;
  }
  if (
    (!parsed.fields.birthDate || parsed.fields.birthDate !== expectedBirthDate) &&
    identityTextContainsBirthDate(combinedOcrText, expectedBirthDate)
  ) {
    parsed.fields.birthDate = expectedBirthDate;
  }
  parsed.missingFields = [
    !parsed.fields.fullName && 'fullName',
    !parsed.fields.idNumber && 'idNumber',
    !parsed.fields.birthDate && 'birthDate',
  ].filter(Boolean);

  if (parsed.missingFields.length) {
    throw Object.assign(
      new Error(`We could not read the required ${parsed.missingFields.join(', ')} from the ID. Retake clearer ID images.`),
      { code: 'INCOMPLETE_OCR', status: 422 },
    );
  }

  if (!namesMatch(parsed.fields.fullName, profile)) {
    throw Object.assign(
      new Error('The name on the ID does not match the beneficiary name entered in Step 2.'),
      { code: 'IDENTITY_MISMATCH', status: 422 },
    );
  }
  if (!expectedBirthDate || parsed.fields.birthDate !== expectedBirthDate) {
    throw Object.assign(
      new Error('The birth date on the ID does not match the birth date entered in Step 2.'),
      { code: 'IDENTITY_MISMATCH', status: 422 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    typ: TOKEN_TYPE,
    iat: now,
    exp: now + TOKEN_MAX_AGE_SECONDS,
    imageHashes: [primary.hash, reverse?.hash].filter(Boolean),
    idType: parsed.idType,
    idTypeLabel: parsed.idTypeLabel,
    maskedIdNumber: maskIdNumber(parsed.fields.idNumber),
    fullName: parsed.fields.fullName,
    birthDate: parsed.fields.birthDate,
    profileName: normalizeIdentityName(`${profile.firstName || ''} ${profile.lastName || ''}`),
    profileBirthDate: expectedBirthDate,
  };

  return {
    ok: true,
    code: 'OCR_VERIFIED',
    data: {
      status: 'passed',
      provider: 'ocr.space',
      idType: parsed.idType,
      idTypeLabel: parsed.idTypeLabel,
      fields: parsed.fields,
      maskedIdNumber: tokenPayload.maskedIdNumber,
      verifiedAt: new Date(now * 1000).toISOString(),
      token: signHmacToken(tokenPayload, getSecret()),
    },
  };
}
export function verifyIdentityOcrToken(token, profile = {}) {
  let verified;
  try {
    verified = verifyHmacToken(token, getSecret());
  } catch {
    return { ok: false, error: 'ID verification is temporarily unavailable. Please try again later.' };
  }
  if (!verified.ok || verified.payload?.typ !== TOKEN_TYPE) {
    return { ok: false, error: 'ID verification is invalid. Please verify the ID again.' };
  }
  const payload = verified.payload;
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp < now) {
    return { ok: false, error: 'ID verification expired. Please verify the ID again.' };
  }
  const expectedName = normalizeIdentityName(`${profile.firstName || ''} ${profile.lastName || ''}`);
  if (payload.profileName !== expectedName || payload.profileBirthDate !== normalizeBirthDate(profile.birthDate)) {
    return { ok: false, error: 'Beneficiary details changed after ID verification. Please verify the ID again.' };
  }
  return { ok: true, payload, error: null };
}

export async function hashRemoteIdentityImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load the verified ID image.');
  const contentType = response.headers.get('content-type') || '';
  if (!/^image\/(?:jpeg|png)$/i.test(contentType)) throw new Error('Verified ID must be a JPG or PNG image.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_FILE_SIZE) throw new Error('Verified ID image exceeds 5 MB.');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
