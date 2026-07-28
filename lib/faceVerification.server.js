import path from 'node:path';

export const FACE_VERIFICATION_STATUSES = new Set(['passed', 'failed', 'manual_review']);

export const FACE_VERIFICATION_MESSAGES = {
  failed: 'Face verification failed. Please make sure your selfie clearly matches the photo on your valid ID.',
  manual_review: 'Face verification requires manual review.',
};

const FACE_API_PROVIDER = 'face-api.js';
let modelLoadPromise = null;
let faceapiModule = null;
let detectionOptions = null;

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return FACE_VERIFICATION_STATUSES.has(status) ? status : 'manual_review';
}

function normalizeScore(value, fallback = null) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(1, score));
}

function getThreshold() {
  // For face-api.js, lower distance = better match
  // Typical threshold for good matches: 0.3-0.5
  return 0.5;
}

function getManualReviewThreshold() {
  return 0.82;
}

function getIdMinFaceConfidence() {
  return Number(process.env.FACE_API_ID_DETECTION_MIN_CONFIDENCE || 0.2);
}

function getSelfieMinFaceConfidence() {
  return 0.5;
}

function assertInput({ idImageUrl, alternateIdImageUrl, selfieUrl }) {
  if ((!idImageUrl && !alternateIdImageUrl) || !selfieUrl) {
    return { ok: false, error: 'Front valid ID image and selfie are required for face verification.' };
  }
  return { ok: true };
}

async function imageUrlToImage(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load ${label} image for face verification.`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!/^image\/(png|jpe?g|webp)$/i.test(contentType)) {
    throw new Error(`${label} must be an image file.`);
  }

  const { loadImage } = await import('@napi-rs/canvas');
  return loadImage(Buffer.from(await response.arrayBuffer()));
}

async function loadFaceApi() {
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    const [faceapiImport, canvas] = await Promise.all([
      import('@vladmandic/face-api/dist/face-api.node-wasm.js'),
      import('@napi-rs/canvas'),
    ]);
    faceapiModule = faceapiImport.default || faceapiImport;

    faceapiModule.env.monkeyPatch({
      Canvas: canvas.Canvas,
      Image: canvas.Image,
      ImageData: canvas.ImageData,
      createCanvasElement: () => canvas.createCanvas(1, 1),
    });

    await faceapiModule.tf.setBackend('wasm');
    await faceapiModule.tf.ready();

    // Use an absolute path. face-api resolves relative model paths from the
    // runtime root, which can incorrectly turn "./node_modules" into
    // "/node_modules" under Next.js.
    const configuredModelPath = process.env.FACE_API_MODEL_PATH;
    const modelPath = configuredModelPath
      ? path.resolve(process.cwd(), configuredModelPath)
      : path.join(process.cwd(), 'public', 'models');
    await Promise.all([
      faceapiModule.nets.ssdMobilenetv1.loadFromDisk(modelPath),
      faceapiModule.nets.faceLandmark68Net.loadFromDisk(modelPath),
      faceapiModule.nets.faceRecognitionNet.loadFromDisk(modelPath),
    ]);

    detectionOptions = new faceapiModule.SsdMobilenetv1Options({
      minConfidence: Number(process.env.FACE_API_DETECTION_MIN_CONFIDENCE || getIdMinFaceConfidence()),
      maxResults: 5,
    });

    return faceapiModule;
  })();

  return modelLoadPromise;
}

function getDetectionConfidence(face) {
  return normalizeScore(face?.detection?.score ?? face?.detection?._score, null);
}

function getBox(face) {
  const box = face?.detection?.box || face?.detection?._box || face?.alignedRect?.box || face?.alignedRect?._box;
  if (!box) return null;
  return {
    x: Math.round(box.x ?? box._x ?? 0),
    y: Math.round(box.y ?? box._y ?? 0),
    width: Math.round(box.width ?? box._width ?? 0),
    height: Math.round(box.height ?? box._height ?? 0),
  };
}

function selectSingleFace(faces, label, minConfidence = getSelfieMinFaceConfidence()) {
  if (!Array.isArray(faces) || faces.length === 0) {
    return { ok: false, error: `No face detected in the ${label}.` };
  }

  if (faces.length > 1) {
    return { ok: false, error: `Multiple faces detected in the ${label}. Please use an image with one clear face.` };
  }

  const face = faces[0];
  const confidence = getDetectionConfidence(face);
  if (confidence !== null && confidence < minConfidence) {
    return { ok: false, error: `The face in the ${label} is not clear enough for verification.` };
  }

  return { ok: true, face, confidence };
}

async function detectFaces(faceapi, image) {
  return faceapi
    .detectAllFaces(image, detectionOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();
}
async function rotateImage(image, rotation) {
  if (rotation === 0) return image;
  const { createCanvas } = await import('@napi-rs/canvas');
  const swapSides = rotation === 90 || rotation === 270;
  const canvas = createCanvas(swapSides ? image.height : image.width, swapSides ? image.width : image.height);
  const context = canvas.getContext('2d');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(image, -image.width / 2, -image.height / 2);
  return canvas;
}
async function enhanceSelectedIdFace(faceapi, candidate) {
  const source = candidate?.orientedImage;
  const box = candidate?.box;
  if (!source || !box) return candidate;

  const marginX = box.width * 0.65;
  const marginY = box.height * 0.55;
  const sourceX = Math.max(0, Math.floor(box.x - marginX));
  const sourceY = Math.max(0, Math.floor(box.y - marginY));
  const sourceWidth = Math.min(source.width - sourceX, Math.ceil(box.width + marginX * 2));
  const sourceHeight = Math.min(source.height - sourceY, Math.ceil(box.height + marginY * 2));
  if (sourceWidth <= 0 || sourceHeight <= 0) return candidate;

  const { createCanvas } = await import('@napi-rs/canvas');
  const outputWidth = 640;
  const outputHeight = Math.max(480, Math.round((sourceHeight / sourceWidth) * outputWidth));
  const canvas = createCanvas(outputWidth, outputHeight);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.filter = 'contrast(1.15)';
  context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

  const enhancedFaces = await detectFaces(faceapi, canvas);
  if (!enhancedFaces.length) return candidate;
  const enhancedFace = enhancedFaces
    .filter((face) => {
      const confidence = getDetectionConfidence(face);
      return confidence === null || confidence >= getIdMinFaceConfidence();
    })
    .sort((left, right) => {
      const leftBox = getBox(left);
      const rightBox = getBox(right);
      return (rightBox?.width || 0) * (rightBox?.height || 0) - (leftBox?.width || 0) * (leftBox?.height || 0);
    })[0];
  if (!enhancedFace) return candidate;

  return {
    ...candidate,
    face: enhancedFace,
    confidence: getDetectionConfidence(enhancedFace),
    enhanced: true,
  };
}

async function detectBestIdFace(faceapi, sources) {
  let best = null;
  let detectedCount = 0;

  for (const source of sources) {
    if (!source?.image) continue;
    for (const rotation of [0, 90, 180, 270]) {
      const orientedImage = await rotateImage(source.image, rotation);
      const faces = await detectFaces(faceapi, orientedImage);
      detectedCount += faces.length;

      for (const face of faces) {
        const confidence = getDetectionConfidence(face);
        if (confidence !== null && confidence < getIdMinFaceConfidence()) continue;
        const box = getBox(face);
        if (!box) continue;
        const areaRatio = (box.width * box.height) / (orientedImage.width * orientedImage.height);
        const rank = areaRatio + (confidence || 0) * 0.001;
        if (!best || rank > best.rank) {
          best = { face, confidence, box, rotation, field: source.field, rank, orientedImage };
        }
      }
    }
  }

  if (!best) {
    return {
      ok: false,
      detectedCount,
      error: 'No face detected in either side of the valid ID. Retake the portrait side closer and upright.',
    };
  }
  best = await enhanceSelectedIdFace(faceapi, best);
  return { ok: true, detectedCount, ...best, orientedImage: undefined };
}

function logFaceVerificationDiagnostics(result) {
  const diagnostics = result?.diagnostics || {};
  console.info('Face verification diagnostics', {
    provider: FACE_API_PROVIDER,
    status: result?.status || 'unknown',
    selectedIdImageField: diagnostics.selectedIdImageField || 'validIdFrontUrl',
    similarityScore: diagnostics.similarityScore ?? result?.score ?? null,
    distance: diagnostics.distance ?? null,
    threshold: diagnostics.threshold ?? getThreshold(),
    idFaceDetected: Boolean(diagnostics.idFaceDetected),
    selfieFaceDetected: Boolean(diagnostics.selfieFaceDetected),
    idFaceCount: diagnostics.idFaceCount ?? null,
    selfieFaceCount: diagnostics.selfieFaceCount ?? null,
    idFaceConfidence: diagnostics.idFaceConfidence ?? null,
    selfieFaceConfidence: diagnostics.selfieFaceConfidence ?? null,
    idFaceBox: diagnostics.idFaceBox ?? null,
    selfieFaceBox: diagnostics.selfieFaceBox ?? null,
    error: result?.error || null,
  });
}

async function verifyWithFaceApi({ idImageUrl, alternateIdImageUrl = '', selfieUrl }) {
  const threshold = getThreshold();
  const diagnostics = {
    selectedIdImageField: 'validIdFrontUrl',
    threshold,
    minFaceConfidence: getIdMinFaceConfidence(),
    idImageRotation: 0,
    idFaceCount: 0,
    selfieFaceCount: 0,
    idFaceDetected: false,
    selfieFaceDetected: false,
    idFaceConfidence: null,
    selfieFaceConfidence: null,
    idFaceBox: null,
    selfieFaceBox: null,
    distance: null,
    similarityScore: null,
  };

  try {
    const faceapi = await loadFaceApi();
    const [primaryIdImage, alternateIdImage, selfieImage] = await Promise.all([
      idImageUrl ? imageUrlToImage(idImageUrl, 'primary valid ID') : Promise.resolve(null),
      alternateIdImageUrl ? imageUrlToImage(alternateIdImageUrl, 'reverse valid ID') : Promise.resolve(null),
      imageUrlToImage(selfieUrl, 'live selfie'),
    ]);

    const [idFaceResult, selfieFaces] = await Promise.all([
      detectBestIdFace(faceapi, [
        { image: primaryIdImage, field: 'validIdFrontUrl' },
        { image: alternateIdImage, field: 'validIdBackUrl' },
      ]),
      detectFaces(faceapi, selfieImage),
    ]);

    diagnostics.idFaceCount = idFaceResult.detectedCount;
    diagnostics.selfieFaceCount = selfieFaces.length;
    diagnostics.idFaceDetected = idFaceResult.ok;
    diagnostics.selfieFaceDetected = selfieFaces.length > 0;

    const selfieFaceResult = selectSingleFace(selfieFaces, 'live selfie');

    if (idFaceResult.ok) {
      diagnostics.idFaceConfidence = idFaceResult.confidence;
      diagnostics.idFaceBox = idFaceResult.box;
      diagnostics.selectedIdImageField = idFaceResult.field;
      diagnostics.idImageRotation = idFaceResult.rotation;
    }
    if (selfieFaceResult.ok) {
      diagnostics.selfieFaceConfidence = selfieFaceResult.confidence;
      diagnostics.selfieFaceBox = getBox(selfieFaceResult.face);
    }

    if (!idFaceResult.ok || !selfieFaceResult.ok) {
      return {
        status: 'failed',
        score: null,
        provider: FACE_API_PROVIDER,
        error: idFaceResult.error || selfieFaceResult.error,
        diagnostics,
      };
    }


    const distance = faceapi.euclideanDistance(idFaceResult.face.descriptor, selfieFaceResult.face.descriptor);
    // Convert distance to similarity score for display (but use distance for actual comparison)
    // Distance: 0 = identical, ~0.3-0.5 = good match, >0.6 = poor match
    const similarity = normalizeScore(1 - Math.min(distance, 1), 0);
    diagnostics.distance = Number(distance.toFixed(6));
    diagnostics.similarityScore = Number(similarity.toFixed(6));

    // Use distance for pass/fail: lower is better
    const status = distance <= threshold
      ? 'passed'
      : distance <= getManualReviewThreshold() ? 'manual_review' : 'failed';
    return {
      status,
      score: diagnostics.similarityScore,
      provider: FACE_API_PROVIDER,
      error: status === 'passed'
        ? null
        : FACE_VERIFICATION_MESSAGES[status],
      diagnostics,
    };
  } catch (error) {
    return {
      status: 'manual_review',
      score: null,
      provider: FACE_API_PROVIDER,
      error: error?.message || 'face-api.js verification failed.',
      diagnostics,
    };
  }
}

export async function verifyFaceMatch(input = {}) {
  const validation = assertInput(input);
  if (!validation.ok) {
    const result = {
      status: 'manual_review',
      score: null,
      provider: FACE_API_PROVIDER,
      error: validation.error,
      diagnostics: {
        selectedIdImageField: 'validIdFrontUrl',
        threshold: getThreshold(),
        idFaceDetected: false,
        selfieFaceDetected: false,
      },
    };
    logFaceVerificationDiagnostics(result);
    return result;
  }

  const result = await verifyWithFaceApi(input);
  logFaceVerificationDiagnostics(result);
  return result;
}

export function getFaceVerificationProvider() {
  return FACE_API_PROVIDER;
}

export function toFaceVerificationLabel(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'passed') return 'Face Match Passed';
  if (normalized === 'failed') return 'Face Match Failed';
  return 'Manual Review Required';
}
