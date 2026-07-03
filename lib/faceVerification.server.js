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
  return normalizeScore(process.env.FACE_VERIFICATION_THRESHOLD, 0.65);
}

function getMinFaceConfidence() {
  return normalizeScore(process.env.FACE_VERIFICATION_MIN_FACE_CONFIDENCE, 0.7);
}

function assertInput({ idImageUrl, selfieUrl }) {
  if (!idImageUrl || !selfieUrl) {
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

    const modelPath = process.env.FACE_API_MODEL_PATH || './node_modules/@vladmandic/face-api/model';
    await Promise.all([
      faceapiModule.nets.ssdMobilenetv1.loadFromDisk(modelPath),
      faceapiModule.nets.faceLandmark68Net.loadFromDisk(modelPath),
      faceapiModule.nets.faceRecognitionNet.loadFromDisk(modelPath),
    ]);

    detectionOptions = new faceapiModule.SsdMobilenetv1Options({
      minConfidence: Number(process.env.FACE_API_DETECTION_MIN_CONFIDENCE || 0.35),
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

function selectSingleFace(faces, label) {
  if (!Array.isArray(faces) || faces.length === 0) {
    return { ok: false, error: `No face detected in the ${label}.` };
  }

  if (faces.length > 1) {
    return { ok: false, error: `Multiple faces detected in the ${label}. Please use an image with one clear face.` };
  }

  const face = faces[0];
  const confidence = getDetectionConfidence(face);
  const minConfidence = getMinFaceConfidence();
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

async function verifyWithFaceApi({ idImageUrl, selfieUrl }) {
  const threshold = getThreshold();
  const diagnostics = {
    selectedIdImageField: 'validIdFrontUrl',
    threshold,
    minFaceConfidence: getMinFaceConfidence(),
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
    const [idImage, selfieImage] = await Promise.all([
      imageUrlToImage(idImageUrl, 'front valid ID'),
      imageUrlToImage(selfieUrl, 'live selfie'),
    ]);

    const [idFaces, selfieFaces] = await Promise.all([
      detectFaces(faceapi, idImage),
      detectFaces(faceapi, selfieImage),
    ]);

    diagnostics.idFaceCount = idFaces.length;
    diagnostics.selfieFaceCount = selfieFaces.length;
    diagnostics.idFaceDetected = idFaces.length > 0;
    diagnostics.selfieFaceDetected = selfieFaces.length > 0;

    const idFaceResult = selectSingleFace(idFaces, 'front valid ID image');
    const selfieFaceResult = selectSingleFace(selfieFaces, 'live selfie');

    if (!idFaceResult.ok || !selfieFaceResult.ok) {
      return {
        status: 'failed',
        score: null,
        provider: FACE_API_PROVIDER,
        error: idFaceResult.error || selfieFaceResult.error,
        diagnostics,
      };
    }

    diagnostics.idFaceConfidence = idFaceResult.confidence;
    diagnostics.selfieFaceConfidence = selfieFaceResult.confidence;
    diagnostics.idFaceBox = getBox(idFaceResult.face);
    diagnostics.selfieFaceBox = getBox(selfieFaceResult.face);

    const distance = faceapi.euclideanDistance(idFaceResult.face.descriptor, selfieFaceResult.face.descriptor);
    const similarity = normalizeScore(1 - distance, 0);
    diagnostics.distance = Number(distance.toFixed(6));
    diagnostics.similarityScore = Number(similarity.toFixed(6));

    const status = similarity >= threshold ? 'passed' : 'failed';
    return {
      status,
      score: diagnostics.similarityScore,
      provider: FACE_API_PROVIDER,
      error: status === 'passed' ? null : FACE_VERIFICATION_MESSAGES.failed,
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
