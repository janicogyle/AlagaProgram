'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Button, PageHeader, Modal, Badge, Table } from '@/components';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';

function buildName(resident) {
  if (!resident) return '';
  return [resident.first_name, resident.middle_name, resident.last_name].filter(Boolean).join(' ');
}

function displayValue(value) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatAddress(resident) {
  if (!resident) return '-';
  const parts = [];
  if (resident.house_no) parts.push(resident.house_no);
  if (resident.purok) parts.push(`Purok ${resident.purok}`);
  if (resident.barangay) parts.push(resident.barangay);
  if (resident.city) parts.push(resident.city);
  return parts.length ? parts.join(', ') : '-';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(value) {
  return (Number(value) || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function computeAge(birthday, storedAge) {
  const parsed = Number(storedAge);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  if (!birthday) return null;
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function getSectors(resident) {
  if (!resident) return [];
  const sectors = [];
  if (resident.is_pwd) sectors.push('PWD');
  if (resident.is_senior_citizen) sectors.push('Senior Citizen');
  if (resident.is_solo_parent) sectors.push('Solo Parent');
  return sectors;
}

function getAssistanceTypeLabel(row) {
  return String(row?.assistance_type || row?.service_type || '').trim() || 'Assistance';
}

function normalizeCardReferenceInput(value) {
  const text = String(value || '');
  return text.includes('.') ? text.trim() : text.trim().toUpperCase();
}

function InfoRow({ label, value }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.k}>{label}</span>
      <span className={styles.v}>{value}</span>
    </div>
  );
}

export default function BeneficiaryIdVerifyPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const [scanOpen, setScanOpen] = useState(false);
  const [scanSession, setScanSession] = useState(0);

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
  const resident = result?.resident;
  const releasedHistory = Array.isArray(result?.releasedHistory) ? result.releasedHistory : [];
  const sectors = getSectors(resident);

  const historyColumns = [
    {
      key: 'control_number',
      label: 'Control No.',
      render: (value) => <span className={styles.historyControlNo}>{value || '-'}</span>,
    },
    {
      key: 'assistance_type',
      label: 'Type',
      render: (_, row) => getAssistanceTypeLabel(row),
    },
    { key: 'requester_name', label: 'Requester' },
    { key: 'beneficiary_name', label: 'Beneficiary' },
    {
      key: 'request_date',
      label: 'Date',
      render: (_, row) => formatDate(row.request_date || row.created_at),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (value) => <span className={styles.historyAmount}>₱{formatAmount(value)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: () => <Badge variant="success">Released</Badge>,
    },
  ];

  const historyRows = releasedHistory.map((row) => ({
    id: row.id,
    control_number: row.control_number,
    assistance_type: getAssistanceTypeLabel(row),
    requester_name: row.requester_name || '-',
    beneficiary_name: row.beneficiary_name || '-',
    request_date: row.request_date || row.created_at,
    amount: row.amount,
    status: row.status,
  }));

  return (
    <div className={styles.page}>
      <PageHeader
        title="Verify Beneficiary ID (QR)"
        subtitle="Scan the QR or enter the card reference number to verify if the beneficiary ID is valid and not expired/revoked."
      />

      <Card>
        <label className={styles.label} htmlFor="cardRef">
          Card Reference
        </label>
        <input
          id="cardRef"
          className={styles.input}
          type="text"
          value={token}
          onChange={(e) => setToken(normalizeCardReferenceInput(e.target.value))}
          placeholder="Enter card reference"
        />

        <div className={styles.actions}>
          <Button
            onClick={() => {
              setScanSession((value) => value + 1);
              setScanOpen(true);
            }}
            disabled={loading}
          >
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
                  Reason:{' '}
                  {result.reason === 'not_setup'
                    ? 'QR ID not enabled (setup required)'
                    : result.reason === 'card_not_found'
                    ? 'Card reference not found'
                    : String(result.reason).replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {result.profileWarning ? (
              <p className={styles.profileWarning}>{result.profileWarning}</p>
            ) : null}

            {result.card && (
              <div className={styles.grid} style={{ marginBottom: 12 }}>
                <div>
                  <div className={styles.k}>Issued</div>
                  <div className={styles.v}>{formatDateTime(result.card.issued_at)}</div>
                </div>
                <div>
                  <div className={styles.k}>Expires</div>
                  <div className={styles.v}>{formatDateTime(result.card.expires_at)}</div>
                </div>
              </div>
            )}

            {resident ? (
              <>
                <div className={styles.profileHeader}>
                  <div>
                    <h2 className={styles.profileName}>{buildName(resident)}</h2>
                    <p className={styles.profileMeta}>
                      Control No. {displayValue(resident.control_number)} · Contact{' '}
                      {displayValue(resident.contact_number)}
                    </p>
                  </div>
                  <Badge variant={resident.status === 'Active' ? 'success' : 'secondary'}>
                    {displayValue(resident.status)}
                  </Badge>
                </div>

                <div className={styles.infoSections}>
                  <section className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>Address</h3>
                    <div className={styles.infoGrid}>
                      <InfoRow label="Complete Address" value={formatAddress(resident)} />
                      <InfoRow label="House No." value={displayValue(resident.house_no)} />
                      <InfoRow label="Purok" value={displayValue(resident.purok)} />
                      <InfoRow label="Barangay" value={displayValue(resident.barangay)} />
                      <InfoRow label="City/Municipality" value={displayValue(resident.city)} />
                    </div>
                  </section>

                  <section className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>Personal Information</h3>
                    <div className={styles.infoGrid}>
                      <InfoRow label="Birthday" value={formatDate(resident.birthday)} />
                      <InfoRow label="Birthplace" value={displayValue(resident.birthplace)} />
                      <InfoRow label="Sex" value={displayValue(resident.sex)} />
                      <InfoRow label="Citizenship" value={displayValue(resident.citizenship)} />
                      <InfoRow label="Civil Status" value={displayValue(resident.civil_status)} />
                      <InfoRow
                        label="Age"
                        value={(() => {
                          const age = computeAge(resident.birthday, resident.age);
                          return age == null ? '-' : String(age);
                        })()}
                      />
                      <InfoRow label="Registered" value={formatDate(resident.created_at)} />
                    </div>
                  </section>

                  <section className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>Sector Classification</h3>
                    {sectors.length ? (
                      <div className={styles.sectorBadges}>
                        {sectors.map((sector) => (
                          <Badge key={sector} variant="secondary">
                            {sector}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.emptyHint}>General</p>
                    )}
                  </section>

                  {(resident.representative_name || resident.representative_contact) && (
                    <section className={styles.infoSection}>
                      <h3 className={styles.sectionTitle}>Representative</h3>
                      <div className={styles.infoGrid}>
                        <InfoRow label="Name" value={displayValue(resident.representative_name)} />
                        <InfoRow label="Contact" value={displayValue(resident.representative_contact)} />
                      </div>
                    </section>
                  )}
                </div>

                <section className={styles.historySection}>
                  <div className={styles.historyHeader}>
                    <h3 className={styles.sectionTitle}>Released Assistance History</h3>
                    <span className={styles.historyCount}>
                      {releasedHistory.length} record{releasedHistory.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {releasedHistory.length ? (
                    <div className={styles.historyTableWrap}>
                      <Table columns={historyColumns} data={historyRows} />
                    </div>
                  ) : (
                    <p className={styles.emptyHint}>No released assistance requests on record.</p>
                  )}
                </section>
              </>
            ) : null}
          </div>
        )}
      </Card>

      <Modal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan QR"
        footer={
          <Button variant="secondary" onClick={() => setScanOpen(false)}>
            Close
          </Button>
        }
      >
        {scanOpen ? (
          <QrScanner
            key={`scan-${scanSession}`}
            onDetected={handleScanDetected}
            onClose={() => setScanOpen(false)}
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

function QrScanner({ onDetected, onClose }) {
  const [starting, setStarting] = useState(true);
  const [scannerError, setScannerError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    let active = true;

    const stop = (resetReader = true) => {
      try {
        controlsRef.current?.stop?.();
      } catch {
        // ignore
      }
      controlsRef.current = null;
      try {
        if (resetReader) readerRef.current?.reset?.();
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

    const choosePreferredCamera = (devices) => {
      if (!devices?.length) return '';
      const preferred =
        devices.find((d) => /back|rear|environment/i.test(String(d.label || ''))) ||
        devices[devices.length - 1] ||
        devices[0];
      return preferred?.deviceId || '';
    };

    const startWithDevice = async (deviceId) => {
      const reader = readerRef.current;
      if (!reader || !videoRef.current) return;

      stop(false);

      controlsRef.current = await reader.decodeFromVideoDevice(deviceId || undefined, videoRef.current, (scanResult) => {
        if (!active) return;
        if (scanResult) {
          stop();
          onDetected?.(scanResult.getText());
        }
      });
    };

    const getFallbackVideoDevices = async () => {
      if (!navigator?.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput');
    };

    const formatScannerError = (e) => {
      const name = String(e?.name || '');
      const rawMsg = String(e?.message || e || 'Failed to start scanner.');

      if (name === 'NotAllowedError') {
        return 'Camera permission denied. Allow camera access in your browser settings, then try again.';
      }
      if (name === 'NotFoundError') {
        return 'No camera found on this device.';
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        return 'Your camera is busy. Close other apps or browser tabs using the camera (Zoom, Teams, Camera, another Chrome tab), wait a few seconds, then tap Retry.';
      }
      if (!window.isSecureContext) {
        return 'Camera requires HTTPS or localhost.';
      }
      if (rawMsg.toLowerCase().includes('video source')) {
        return 'Could not start the camera. Close other apps using it, wait a few seconds, then tap Retry.';
      }
      if (rawMsg.toLowerCase().includes('no camera devices')) {
        return 'No camera found on this device.';
      }
      return rawMsg;
    };

    const start = async () => {
      setScannerError('');
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('This browser does not support camera access.');
        }

        const mod = await import('@zxing/browser');
        const { BrowserQRCodeReader } = mod;

        readerRef.current = new BrowserQRCodeReader();

        let devices = await BrowserQRCodeReader.listVideoInputDevices();
        if (!devices?.length) {
          devices = await getFallbackVideoDevices();
        }
        const preferredId = choosePreferredCamera(devices);

        setCameras(devices || []);
        setSelectedDeviceId(preferredId || '');
        await startWithDevice(preferredId);
        if (active) setStarting(false);
      } catch (e) {
        if (!active) return;
        setStarting(false);
        stop();
        setScannerError(formatScannerError(e));
      }
    };

    start();

    return () => {
      active = false;
      stop();
    };
  }, [onDetected, retryKey]);

  const switchCamera = async (deviceId) => {
    const nextId = String(deviceId || '');
    if (!nextId || nextId === selectedDeviceId || !readerRef.current || !videoRef.current) return;

    setStarting(true);
    setSelectedDeviceId(nextId);
    try {
      try {
        controlsRef.current?.stop?.();
      } catch {
        // ignore
      }
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(nextId, videoRef.current, (scanResult) => {
        if (scanResult) {
          try {
            controlsRef.current?.stop?.();
          } catch {
            // ignore
          }
          try {
            readerRef.current?.reset?.();
          } catch {
            // ignore
          }
          onDetected?.(scanResult.getText());
        }
      });
    } catch (e) {
      setScannerError(String(e?.message || e || 'Failed to switch camera.'));
    } finally {
      setStarting(false);
    }
  };

  const handleFlip = async () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex((c) => c.deviceId === selectedDeviceId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % cameras.length : 0;
    await switchCamera(cameras[nextIndex]?.deviceId);
  };

  if (scannerError) {
    return (
      <div className={styles.scannerWrap}>
        <p className={styles.scannerError}>{scannerError}</p>
        <div className={styles.scannerErrorActions}>
          <Button
            type="button"
            onClick={() => {
              setScannerError('');
              setStarting(true);
              setRetryKey((value) => value + 1);
            }}
          >
            Retry
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scannerWrap}>
      <div className={styles.scannerControls}>
        <select
          className={styles.cameraSelect}
          value={selectedDeviceId}
          onChange={(e) => switchCamera(e.target.value)}
          disabled={starting || cameras.length === 0}
        >
          {cameras.length === 0 ? (
            <option value="">No camera detected</option>
          ) : (
            cameras.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))
          )}
        </select>
        <Button
          type="button"
          variant="secondary"
          onClick={handleFlip}
          disabled={starting || cameras.length < 2}
        >
          Flip Camera
        </Button>
      </div>
      <video ref={videoRef} className={styles.video} />
      <div className={styles.scanHint}>
        {starting
          ? 'Starting camera…'
          : 'Point the camera at the QR code. Verification will start automatically.'}
      </div>
    </div>
  );
}
