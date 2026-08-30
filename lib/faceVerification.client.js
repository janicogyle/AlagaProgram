import { analyzeImageQualityPixels, getImageQualityIssue } from '@/lib/imageQuality.mjs';

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

function getMinSelfieSharpness() {
  return 28;
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

function analyzeHtmlImageQuality(image, label) {
  const longEdge = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sampleScale = Math.min(1, 720 / longEdge);
  const width = Math.max(2, Math.round((image.naturalWidth || image.width) * sampleScale));
  const height = Math.max(2, Math.round((image.naturalHeight || image.height) * sampleScale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const metrics = analyzeImageQualityPixels({ data: imageData.data, width, height, step: 2 });
  return {
    metrics,
    issue: getImageQualityIssue(metrics, {
      label,
      minSharpness: getMinSelfieSharpness(),
      minBrightness: 58,
      maxBrightness: 220,
      minContrast: 16,
    }),
  };
}

function getLandmarkPositions(face) {
  const positions = face?.landmarks?.positions || face?.landmarks?._positions || [];
  return positions.map((point) => ({
    x: Number(point.x ?? point._x ?? 0),
    y: Number(point.y ?? point._y ?? 0),
  })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function detectGlassesInSelfie(image, face) {
  const positions = getLandmarkPositions(face);
  const box = getBox(face);
  if (!box || positions.length < 48) return { detected: false, confidence: 0 };

  const eyePoints = positions.slice(36, 48);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const minX = Math.max(0, Math.floor(Math.min(...eyePoints.map((point) => point.x)) - box.width * 0.16));
  const maxX = Math.min(sourceWidth, Math.ceil(Math.max(...eyePoints.map((point) => point.x)) + box.width * 0.16));
  const minY = Math.max(0, Math.floor(Math.min(...eyePoints.map((point) => point.y)) - box.height * 0.08));
  const maxY = Math.min(sourceHeight, Math.ceil(Math.max(...eyePoints.map((point) => point.y)) + box.height * 0.12));
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 20 || height < 10) return { detected: false, confidence: 0 };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, minX, minY, width, height, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  let dark = 0;
  let bright = 0;
  let samples = 0;

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const value = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    gray[pixel] = value;
    if (value < 55) dark += 1;
    if (value > 238) bright += 1;
    samples += 1;
  }

  let strongHorizontalEdges = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const horizontal = Math.abs(gray[y * width + x - 1] - gray[y * width + x + 1]);
      const vertical = Math.abs(gray[(y - 1) * width + x] - gray[(y + 1) * width + x]);
      if (horizontal > 42 && horizontal > vertical * 1.15) strongHorizontalEdges += 1;
    }
  }

  const darkRatio = dark / Math.max(1, samples);
  const glareRatio = bright / Math.max(1, samples);
  const edgeRatio = strongHorizontalEdges / Math.max(1, (width - 2) * (height - 2));
  const confidence = Math.min(1, darkRatio * 2.2 + glareRatio * 1.4 + edgeRatio * 5);
  return {
    detected: confidence >= 0.42 && (darkRatio >= 0.08 || glareRatio >= 0.025) && edgeRatio >= 0.035,
    confidence: Number(confidence.toFixed(4)),
    darkRatio: Number(darkRatio.toFixed(4)),
    glareRatio: Number(glareRatio.toFixed(4)),
    edgeRatio: Number(edgeRatio.toFixed(4)),
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
    selfieQuality: diagnostics.selfieQuality ?? null,
    selfieGlasses: diagnostics.selfieGlasses ?? null,
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
    selfieQuality: null,
    selfieGlasses: null,
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

    const selfieQuality = analyzeHtmlImageQuality(liveSelfie, 'Selfie');
    diagnostics.selfieQuality = selfieQuality.metrics;
    if (selfieQuality.issue) {
      const result = {
        status: 'failed',
        score: null,
        provider: FACE_API_PROVIDER,
        error: selfieQuality.issue,
        diagnostics,
      };
      logDiagnostics(result);
      return result;
    }

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

    const selfieGlasses = detectGlassesInSelfie(liveSelfie, selfieFace.face);
    diagnostics.selfieGlasses = selfieGlasses;
    if (selfieGlasses.detected) {
      const result = {
        status: 'failed',
        score: null,
        provider: FACE_API_PROVIDER,
        error: 'Glasses detected in the selfie. Please remove glasses and retake a clear selfie.',
        diagnostics,
      };
      logDiagnostics(result);
      return result;
    }

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
      error: error?.message || 'We could not complete selfie verification. Please try again.',
      diagnostics,
    };
    logDiagnostics(result);
    return result;
  }
}
