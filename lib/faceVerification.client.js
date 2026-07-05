const FACE_API_PROVIDER = 'face-api.js';
const MODEL_URL = '/models';
let faceApiPromise = null;
let modelLoadPromise = null;
let detectionOptions = null;

function normalizeScore(value, fallback = null) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(1, score));
}

function getThreshold() {
  return 0.65;
}

function getMinFaceConfidence() {
  return 0.7;
}

async function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = import('@vladmandic/face-api/dist/face-api.esm.js');
  }
  const faceapi = await faceApiPromise;

  if (!modelLoadPromise) {
    modelLoadPromise = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => {
      detectionOptions = new faceapi.SsdMobilenetv1Options({
        minConfidence: Number(process.env.NEXT_PUBLIC_FACE_API_DETECTION_MIN_CONFIDENCE || 0.35),
        maxResults: 5,
      });
      return faceapi;
    });
  }

  return modelLoadPromise;
}

async function toImage(faceapi, source) {
  if (source instanceof File || source instanceof Blob) {
    return faceapi.bufferToImage(source);
  }

  const response = await fetch(String(source || ''));
  if (!response.ok) throw new Error('Unable to load image for face verification.');
  return faceapi.bufferToImage(await response.blob());
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
  if (confidence !== null && confidence < getMinFaceConfidence()) {
    return { ok: false, error: `The face in the ${label} is not clear enough for verification.` };
  }

  return { ok: true, face, confidence };
}

function logDiagnostics(result) {
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

export async function verifyFaceMatchWithFaceApi({ validIdFrontImage, selfieImage }) {
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
    if (!validIdFrontImage || !selfieImage) {
      throw new Error('Front valid ID image and live selfie are required for face verification.');
    }

    const faceapi = await loadFaceApi();
    const [idImage, liveSelfie] = await Promise.all([
      toImage(faceapi, validIdFrontImage),
      toImage(faceapi, selfieImage),
    ]);

    const [idFaces, selfieFaces] = await Promise.all([
      faceapi.detectAllFaces(idImage, detectionOptions).withFaceLandmarks().withFaceDescriptors(),
      faceapi.detectAllFaces(liveSelfie, detectionOptions).withFaceLandmarks().withFaceDescriptors(),
    ]);

    diagnostics.idFaceCount = idFaces.length;
    diagnostics.selfieFaceCount = selfieFaces.length;
    diagnostics.idFaceDetected = idFaces.length > 0;
    diagnostics.selfieFaceDetected = selfieFaces.length > 0;

    const idFace = selectSingleFace(idFaces, 'front valid ID image');
    const selfieFace = selectSingleFace(selfieFaces, 'live selfie');
    if (!idFace.ok || !selfieFace.ok) {
      const result = {
        status: 'failed',
        score: null,
        provider: FACE_API_PROVIDER,
        error: idFace.error || selfieFace.error,
        diagnostics,
      };
      logDiagnostics(result);
      return result;
    }

    diagnostics.idFaceConfidence = idFace.confidence;
    diagnostics.selfieFaceConfidence = selfieFace.confidence;
    diagnostics.idFaceBox = getBox(idFace.face);
    diagnostics.selfieFaceBox = getBox(selfieFace.face);

    const distance = faceapi.euclideanDistance(idFace.face.descriptor, selfieFace.face.descriptor);
    const similarity = normalizeScore(1 - distance, 0);
    diagnostics.distance = Number(distance.toFixed(6));
    diagnostics.similarityScore = Number(similarity.toFixed(6));

    const status = similarity >= threshold ? 'passed' : 'failed';
    const result = {
      status,
      score: diagnostics.similarityScore,
      provider: FACE_API_PROVIDER,
      error: status === 'passed'
        ? null
        : 'Face verification failed. Please make sure your selfie clearly matches the photo on your valid ID.',
      diagnostics,
    };
    logDiagnostics(result);
    return result;
  } catch (error) {
    const result = {
      status: 'failed',
      score: null,
      provider: FACE_API_PROVIDER,
      error: error?.message || 'face-api.js verification failed.',
      diagnostics,
    };
    logDiagnostics(result);
    return result;
  }
}
