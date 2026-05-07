'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Button, PageHeader, Modal } from '@/components';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';

function buildName(resident) {
  if (!resident) return '';
  return [resident.first_name, resident.middle_name, resident.last_name].filter(Boolean).join(' ');
}

export default function BeneficiaryIdVerifyPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const [scanOpen, setScanOpen] = useState(false);

  const openAlert = ({ title, message }) => setAlertState({ open: true, title, message });
  const closeAlert = () => setAlertState((prev) => ({ ...prev, open: false }));

  const getAuthHeaders = async () => {
    if (!supabase) throw new Error('Supabase client not initialized.');

    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    if (error || !session) throw new Error('Not authenticated. Please log in again.');

    return { Authorization: `Bearer ${session.access_token}` };
  };

  const handleScanDetected = async (text) => {
    const scanned = String(text || '').trim();
    if (!scanned) return;

    setToken(scanned);
    setScanOpen(false);

    // Auto-verify after scan for a faster workflow
    try {
      await handleVerify(scanned);
    } catch {
      // handleVerify already surfaces errors via modal
    }
  };

  const handleVerify = async (overrideToken) => {
    const toVerify = String(overrideToken ?? token).trim();
    if (!toVerify || loading) return;

    setLoading(true);
    setResult(null);
    try {
      const headers = await getAuthHeaders();

      const response = await fetch('/api/beneficiary-cards/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ token: toVerify }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        openAlert({ title: 'Verification failed', message: String(payload?.error || 'Verification failed.') });
        return;
      }

      setResult(payload?.data || null);
    } catch (err) {
      const msg = String(err?.message || err || 'Unknown error');
      console.warn('Verify card failed:', msg);
      openAlert({ title: 'Verification failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const badge = result?.valid ? styles.badgeValid : styles.badgeInvalid;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Verify Beneficiary ID (QR)"
        subtitle="Paste or scan the QR token to confirm if the beneficiary ID is valid and not expired/revoked."
      />

      <Card>
        <label className={styles.label} htmlFor="qrToken">QR Token</label>
        <textarea
          id="qrToken"
          className={styles.textarea}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste the scanned QR token here…"
          rows={4}
        />

        <div className={styles.actions}>
          <Button onClick={() => setScanOpen(true)} disabled={loading}>
            Scan QR
          </Button>
          <Button onClick={() => handleVerify()} disabled={loading || !token.trim()}>
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setToken('');
              setResult(null);
            }}
            disabled={loading}
          >
            Clear
          </Button>
        </div>

        {result && (
          <div className={styles.resultBox}>
            <div className={styles.resultHeader}>
              <span className={`${styles.badge} ${badge}`}>{result.valid ? 'VALID' : 'INVALID'}</span>
              {!result.valid && result.reason && (
                <span className={styles.reason}>
                Reason: {result.reason === 'not_setup' ? 'QR ID not enabled (setup required)' : String(result.reason).replace(/_/g, ' ')}
              </span>
              )}
            </div>

            {result.resident && (
              <div className={styles.grid}>
                <div>
                  <div className={styles.k}>Name</div>
                  <div className={styles.v}>{buildName(result.resident) || '-'}</div>
                </div>
                <div>
                  <div className={styles.k}>Control No.</div>
                  <div className={styles.v}>{result.resident.control_number || '-'}</div>
                </div>
                <div>
                  <div className={styles.k}>Contact</div>
                  <div className={styles.v}>{result.resident.contact_number || '-'}</div>
                </div>
                <div>
                  <div className={styles.k}>Resident Status</div>
                  <div className={styles.v}>{result.resident.status || '-'}</div>
                </div>
              </div>
            )}

            {result.card && (
              <div className={styles.grid} style={{ marginTop: 12 }}>
                <div>
                  <div className={styles.k}>Issued</div>
                  <div className={styles.v}>{result.card.issued_at ? new Date(result.card.issued_at).toLocaleString() : '-'}</div>
                </div>
                <div>
                  <div className={styles.k}>Expires</div>
                  <div className={styles.v}>{result.card.expires_at ? new Date(result.card.expires_at).toLocaleString() : '-'}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Modal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan QR"
        footer={
          <>
            <Button variant="secondary" onClick={() => setScanOpen(false)}>
              Close
            </Button>
          </>
        }
      >
        {scanOpen ? (
          <QrScanner
            onDetected={handleScanDetected}
            onError={(m) => openAlert({ title: 'Scanner error', message: m })}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={!!alertState.open}
        onClose={closeAlert}
        title={alertState.title || 'Message'}
        footer={<Button onClick={closeAlert}>OK</Button>}
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{alertState.message}</p>
      </Modal>
    </div>
  );
}

function QrScanner({ onDetected, onError }) {
  const [starting, setStarting] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    let reader;
    let controls;
    let active = true;

    const stop = () => {
      try {
        controls?.stop?.();
      } catch {
        // ignore
      }
      try {
        reader?.reset?.();
      } catch {
        // ignore
      }
      try {
        const video = videoRef.current;
        const stream = video?.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              // ignore
            }
          });
        }
        if (video) video.srcObject = null;
      } catch {
        // ignore
      }
    };

    const start = async () => {
      try {
        const mod = await import('@zxing/browser');
        const { BrowserQRCodeReader } = mod;

        reader = new BrowserQRCodeReader();

        const devices = await BrowserQRCodeReader.listVideoInputDevices();

        // Prefer back camera if available (mobile)
        const preferred =
          devices?.find((d) => /back|rear|environment/i.test(d.label || '')) ||
          devices?.[devices.length - 1] ||
          devices?.[0];

        const deviceId = preferred?.deviceId;

        setStarting(false);

        // decodeFromVideoDevice may return controls in newer versions
        controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
          if (!active) return;
          if (result) {
            stop();
            onDetected?.(result.getText());
          }
        });
      } catch (e) {
        setStarting(false);
        stop();

        const name = String(e?.name || '');
        const rawMsg = String(e?.message || e || 'Failed to start scanner.');

        const msg =
          name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser.'
            : rawMsg.toLowerCase().includes('video source')
              ? 'Could not start video source. Close other apps using the camera, then refresh the page and try again.'
              : rawMsg;

        onError?.(msg);
      }
    };

    start();

    return () => {
      active = false;
      stop();
    };
  }, [onDetected, onError]);

  return (
    <div className={styles.scannerWrap}>
      <video ref={videoRef} className={styles.video} />
      <div className={styles.scanHint}>
        {starting
          ? 'Starting camera…'
          : 'Point the camera at the QR code. The token will be filled automatically.'}
      </div>
    </div>
  );
}

