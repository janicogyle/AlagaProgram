'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Button from './Button';
import { analyzeImageQualityPixels, getImageQualityIssue } from '@/lib/imageQuality.mjs';
import styles from '../app/signup/page.module.css';

export default function FaceRecognitionCapture({ onCapture, onRetake, disabled = false, status, verifying = false, error = '' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewUrlRef = useRef('');
  const cameraRequestRef = useRef(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState('');

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
    setCapturedPreviewUrl('');
  }, []);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const openCamera = useCallback(async () => {
    stopCamera();
    const requestId = cameraRequestRef.current;
    setCameraError('');
    clearPreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      if (requestId !== cameraRequestRef.current) return;
      setCameraError('Camera access is required to capture a live face selfie.');
    }
  }, [clearPreview, stopCamera]);

  const attachVideo = useCallback((video) => {
    videoRef.current = video;
    if (video && streamRef.current) video.srcObject = streamRef.current;
  }, []);

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight || disabled || verifying) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const sampleScale = Math.min(1, 720 / Math.max(canvas.width, canvas.height));
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = Math.max(2, Math.round(canvas.width * sampleScale));
    sampleCanvas.height = Math.max(2, Math.round(canvas.height * sampleScale));
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    sampleContext.drawImage(canvas, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const imageData = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
    const quality = analyzeImageQualityPixels({
      data: imageData.data,
      width: sampleCanvas.width,
      height: sampleCanvas.height,
      step: 2,
    });
    const qualityIssue = getImageQualityIssue(quality, {
      label: 'Selfie camera',
      minSharpness: 28,
      minBrightness: 58,
      maxBrightness: 220,
      minContrast: 16,
    });
    if (qualityIssue) {
      setCameraError(qualityIssue);
      return;
    }
    setCameraError('');
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `live-selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
      clearPreview();
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setCapturedPreviewUrl(previewUrl);
      stopCamera();
      onCapture(file);
    }, 'image/jpeg', 0.92);
  };

  const retakeSelfie = () => {
    if (disabled || verifying) return;
    clearPreview();
    onRetake?.();
    openCamera();
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(openCamera, 0);
    return () => {
      window.clearTimeout(timeoutId);
      stopCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [openCamera, stopCamera]);

  const canRetake = !verifying && !!capturedPreviewUrl;

  return (
    <div className={styles.faceRecognitionPanel}>
      <div className={styles.faceRecognitionHeader}>
        <div>
          <h4 className={styles.faceRecognitionTitle}>Face Selfie</h4>
          <p className={styles.faceRecognitionHint}>Capture a live selfie to verify your identity.</p>
        </div>
          {verifying && <span className={styles.faceRecognitionLoading}>Verifying details...</span>}
      </div>

      <div className={styles.faceRecognitionBody}>
        <div className={styles.faceCameraFrame}>
          {capturedPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URLs cannot be optimized by next/image.
            <img src={capturedPreviewUrl} alt="Captured live selfie" className={styles.selfieVideo} />
          ) : (
            <video ref={attachVideo} onLoadedData={() => setCameraReady(true)} autoPlay playsInline muted className={styles.selfieVideo} />
          )}
          <span className={styles.faceFrameLabel}>{capturedPreviewUrl ? 'Selfie captured' : 'Frame your face'}</span>
          <span className={styles.faceFrameOval} aria-hidden="true" />
        </div>
        <div className={styles.faceRecognitionActions}>
          <div className={styles.faceActionButtons}>
            {cameraError && !capturedPreviewUrl && (
              <Button type="button" onClick={openCamera} disabled={disabled || verifying}>Retry Camera</Button>
            )}
            {!capturedPreviewUrl && (
              <Button type="button" onClick={captureSelfie} disabled={disabled || verifying || !cameraReady}>
                Capture Live Selfie
              </Button>
            )}
            {canRetake && (
              <Button type="button" variant="secondary" onClick={retakeSelfie} disabled={disabled || verifying}>
                Retake Selfie
              </Button>
            )}
          </div>
          {verifying && <span className={styles.faceStatusText}>Checking selfie...</span>}
          {status === 'passed' && <span className={styles.verifiedBadge}>Face Selfie Verified</span>}
          {status === 'manual_review' && !verifying && <span className={styles.faceStatusText}>Admin will review your ID and selfie</span>}
          {status === 'failed' && !verifying && <p className={styles.fieldError}>Please retake your selfie</p>}
          {(error || cameraError) && <p className={styles.fieldError}>{error || cameraError}</p>}
        </div>
      </div>
    </div>
  );
}

