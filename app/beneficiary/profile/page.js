'use client';

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import { Badge, FileUpload, Modal, SectionHeader, HelperText, Button } from '@/components';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';
import {
  ID_CARD_HEIGHT_MM,
  ID_CARD_WIDTH_MM,
  formatCardDate,
  openBeneficiaryIdPrintWindow,
  renderBeneficiaryIdCard,
} from '@/lib/beneficiaryIdCard.client';

function getIdStatusVariant(status) {
  if (status === 'Active') return 'success';
  if (status === 'Expiring Soon') return 'warning';
  if (status === 'Expired') return 'danger';
  if (status === 'Renewal Pending') return 'warning';
  return 'secondary';
}

function ProfileDetailRow({ label, value }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value || '—'}</span>
    </div>
  );
}

function formatContactForDisplay(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+63 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return value || '';
}

export default function ProfilePage() {
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idCard, setIdCard] = useState({
    loading: true,
    token: null,
    qrUrl: null,
    cardImageUrl: null,
    cardImageLoading: false,
    card: null,
    idStatus: null,
    canRenew: false,
    error: null,
  });
  const [renewalRequest, setRenewalRequest] = useState(null);
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [renewalFiles, setRenewalFiles] = useState([]);
  const [renewalRemarks, setRenewalRemarks] = useState('');
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [renewalError, setRenewalError] = useState('');
  const [renewalNotice, setRenewalNotice] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        let residentId = null;
        if (typeof window !== 'undefined') {
          residentId = window.localStorage.getItem('beneficiaryResidentId');
        }

        if (!residentId) {
          setResident(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('residents')
          .select(
            'id, first_name, middle_name, last_name, birthday, age, birthplace, sex, citizenship, civil_status, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent, status',
          )
          .eq('id', residentId)
          .single();

        if (error) throw error;
        setResident(data);
      } catch (err) {
        console.error('Failed to load beneficiary profile:', err);
        setResident(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const loadRenewalRequest = useCallback(async () => {
    try {
      const response = await fetch('/api/beneficiary/id-renewal', {
        method: 'GET',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) throw new Error(payload?.error || 'Unable to load renewal request.');
      setRenewalRequest(payload?.data?.latestRequest || null);
    } catch (err) {
      console.warn('Failed to load ID renewal request:', err);
      setRenewalRequest(null);
    }
  }, []);

  const loadCard = useCallback(async () => {
    setIdCard({
      loading: true,
      token: null,
      qrUrl: null,
      cardImageUrl: null,
      cardImageLoading: false,
      card: null,
      idStatus: null,
      canRenew: false,
      error: null,
    });
    try {
      const response = await fetch('/api/beneficiary-cards/me', {
        method: 'GET',
        credentials: 'include',
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Unable to load your ID card.');
      }

      const token = payload?.data?.token || null;
      const card = payload?.data?.card;
      if (!card) throw new Error('No ID card available.');

      const cardReference = String(card.id || '').slice(0, 8).toUpperCase();
      const qrcodeMod = await import('qrcode');
      const QRCode = qrcodeMod.default ?? qrcodeMod;
      const qrUrl = await QRCode.toDataURL(cardReference, { margin: 1, width: 420 });

      setIdCard({
        loading: false,
        token,
        qrUrl,
        cardImageUrl: null,
        cardImageLoading: true,
        card,
        cardReference,
        idStatus: payload?.data?.idStatus || card.status || null,
        canRenew: !!payload?.data?.canRenew,
        daysUntilExpiration: payload?.data?.daysUntilExpiration ?? null,
        renewalWindowDays: payload?.data?.renewalWindowDays ?? null,
        error: null,
      });
    } catch (err) {
      const msg = String(err?.message || 'Unable to load ID card.');
      const isNotSetup =
        msg.toLowerCase().includes('beneficiary_cards') &&
        (msg.toLowerCase().includes('schema cache') || msg.toLowerCase().includes('could not find the table') || msg.toLowerCase().includes('does not exist'));

      setIdCard({
        loading: false,
        token: null,
        qrUrl: null,
        cardImageUrl: null,
        cardImageLoading: false,
        card: null,
        idStatus: null,
        canRenew: false,
        error: isNotSetup
          ? 'Beneficiary ID card is not enabled yet. Please ask the barangay office/admin to run the database setup.'
          : msg,
      });
    }
  }, []);

  useEffect(() => {
    void loadCard();
    void loadRenewalRequest();
  }, [loadCard, loadRenewalRequest]);

  const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString();
  };

  const formatLabel = (value) => {
    if (!value) return '';
    return String(value).replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const sectors = [];
  if (resident?.is_pwd) sectors.push('PWD');
  if (resident?.is_senior_citizen) sectors.push('Senior Citizen');
  if (resident?.is_solo_parent) sectors.push('Solo Parent');
  const fullName = [resident?.first_name, resident?.middle_name, resident?.last_name].filter(Boolean).join(' ');
  const sectorLabel = sectors.length ? sectors.join(' / ') : 'General';
  const addressParts = [
    resident?.house_no,
    resident?.purok,
    formatLabel(resident?.barangay),
    resident?.city,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  const fullAddress = addressParts.length ? addressParts.join(', ') : '-';
  const effectiveIdStatus = idCard.idStatus || resident?.status || 'Active';
  const canOpenRenewal = renewalRequest?.status === 'Incomplete' || (!!idCard.canRenew && renewalRequest?.status !== 'Pending');
  const renewalDisabledHint = renewalRequest?.status === 'Pending'
    ? 'Renewal request is under review.'
    : !canOpenRenewal
      ? 'Renewal opens 7 days before expiration.'
      : '';
  const profileDetailRows = [
    { label: 'Beneficiary Name', value: fullName },
    { label: 'Sector / Category', value: sectorLabel },
    { label: 'Card Number', value: idCard.cardReference },
    { label: 'Phone Number', value: formatContactForDisplay(resident?.contact_number) },
    { label: 'Address', value: fullAddress },
    { label: 'Date Issued', value: formatCardDate(idCard.card?.issued_at) },
    { label: 'Expiry Date', value: formatCardDate(idCard.card?.expires_at) },
    {
      label: 'Status',
      value: <Badge variant={getIdStatusVariant(effectiveIdStatus)}>{effectiveIdStatus}</Badge>,
    },
    { label: 'Birthday', value: formatDate(resident?.birthday) },
    {
      label: 'Age',
      value:
        resident?.age != null && resident?.age !== ''
          ? String(resident.age)
          : String(calculateAge(resident?.birthday) || ''),
    },
    { label: 'Birthplace', value: resident?.birthplace },
    { label: 'Sex', value: formatLabel(resident?.sex) },
    { label: 'Citizenship', value: resident?.citizenship },
    { label: 'Civil Status', value: formatLabel(resident?.civil_status) },
  ];

  useEffect(() => {
    if (loading || !idCard.qrUrl || !idCard.card || idCard.error) return;

    let cancelled = false;

    const renderCard = async () => {
      setIdCard((prev) => ({ ...prev, cardImageLoading: true, cardImageUrl: null }));

      try {
        const cardImageUrl = await renderBeneficiaryIdCard({
          qrUrl: idCard.qrUrl,
          fullName: fullName || 'Beneficiary',
          sectorLabel,
          cardReference: idCard.cardReference,
          contactNumber: resident?.contact_number || '-',
          address: fullAddress,
          issuedAt: idCard.card?.issued_at,
          expiresAt: idCard.card?.expires_at,
        });

        if (!cancelled) {
          setIdCard((prev) => ({ ...prev, cardImageUrl, cardImageLoading: false }));
        }
      } catch (err) {
        console.error('Failed to render beneficiary ID card:', err);
        if (!cancelled) {
          setIdCard((prev) => ({
            ...prev,
            cardImageLoading: false,
            cardImageUrl: null,
            error: 'Unable to render your ID card preview.',
          }));
        }
      }
    };

    renderCard();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    idCard.qrUrl,
    idCard.card,
    idCard.cardReference,
    idCard.error,
    resident?.contact_number,
    fullName,
    sectorLabel,
    fullAddress,
  ]);

  const downloadIdPdf = async () => {
    if (!idCard.cardImageUrl) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM],
    });
    doc.addImage(idCard.cardImageUrl, 'PNG', 0, 0, ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM);
    doc.save(`alaga-beneficiary-id-${idCard.cardReference || 'card'}.pdf`);
  };

  const printIdCard = () => {
    if (!idCard.cardImageUrl) return;
    openBeneficiaryIdPrintWindow(idCard.cardImageUrl);
  };

  const openRenewalModal = () => {
    setRenewalFiles([]);
    setRenewalRemarks('');
    setRenewalError('');
    setRenewalNotice('');
    setRenewalModalOpen(true);
  };

  const closeRenewalModal = () => {
    if (renewalSubmitting) return;
    setRenewalModalOpen(false);
  };

  const submitRenewal = async () => {
    setRenewalError('');
    setRenewalNotice('');

    if (!renewalFiles.length) {
      setRenewalError('Please upload your updated valid ID.');
      return;
    }

    setRenewalSubmitting(true);
    try {
      const form = new FormData();
      form.append('validId', renewalFiles[0]);
      form.append('remarks', renewalRemarks);

      const response = await fetch('/api/beneficiary/id-renewal', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) throw new Error(payload?.error || 'Failed to submit renewal request.');

      setRenewalRequest(payload?.data || null);
      setRenewalNotice('Renewal request submitted for admin review.');
      setResident((prev) => (prev ? { ...prev, status: 'Renewal Pending' } : prev));
      await loadCard();
      await loadRenewalRequest();
      setRenewalModalOpen(false);
    } catch (err) {
      setRenewalError(err?.message || 'Failed to submit renewal request.');
    } finally {
      setRenewalSubmitting(false);
    }
  };

  return (
    <div className={styles.profilePage}>
      <PageHeader
        title="My Profile"
        subtitle="These are the details you provided during beneficiary sign up."
      />
      <Card>
        {loading && (
          <p className={styles.muted}>Loading your profile…</p>
        )}
        {!loading && !resident && (
          <p className={styles.muted}>
            We couldn&apos;t find your beneficiary profile yet. The layout below shows what will be stored once you sign up.
          </p>
        )}

        <form className={styles.profileForm}>
            <section className={styles.sectionCard} aria-labelledby="id-card-heading">
              <SectionHeader
                id="id-card-heading"
                title="Beneficiary ID Card Preview"
                subtitle="Your printable ALAGA Program beneficiary identification card."
              />

              {idCard.loading && <p className={styles.muted}>Loading your ID card…</p>}
              {!idCard.loading && idCard.error && (
                <p className={styles.muted}>{idCard.error}</p>
              )}
              {!idCard.loading && !idCard.error && idCard.qrUrl && (
                <div className={styles.idCardWrap}>
                  <div className={styles.idCardPreviewFrame}>
                    {idCard.cardImageUrl ? (
                      <img
                        className={styles.idCardPreviewImage}
                        src={idCard.cardImageUrl}
                        alt="ALAGA Beneficiary ID Card"
                      />
                    ) : (
                      <div className={styles.idCardPreviewLoading}>
                        {idCard.cardImageLoading ? 'Rendering ID card...' : 'Preparing ID card...'}
                      </div>
                    )}
                  </div>
                  <div className={styles.idDetailsPanel}>
                    <h3 className={styles.idDetailsTitle}>Card Details</h3>
                    <div className={styles.idDetailsRows}>
                      {profileDetailRows.map((row) => (
                        <ProfileDetailRow key={row.label} label={row.label} value={row.value} />
                      ))}
                    </div>
                    <p className={styles.idCardHint}>Keep this ID private. Share only with authorized barangay staff.</p>
                    {renewalNotice && <p className={styles.renewalSuccess}>{renewalNotice}</p>}
                    {renewalRequest?.status && (
                      <div className={styles.renewalStatusBox}>
                        <span className={styles.idCardLabel}>Latest renewal</span>
                        <Badge
                          variant={
                            renewalRequest.status === 'Approved'
                              ? 'success'
                              : renewalRequest.status === 'Incomplete'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {renewalRequest.status}
                        </Badge>
                        {renewalRequest.admin_remarks && (
                          <p className={styles.idCardHint}>{renewalRequest.admin_remarks}</p>
                        )}
                      </div>
                    )}
                    <div className={styles.idCardButtons}>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={downloadIdPdf}
                        disabled={!idCard.cardImageUrl}
                      >
                        Download ID (PDF)
                      </Button>
                      <Button
                        size="small"
                        onClick={printIdCard}
                        disabled={!idCard.cardImageUrl}
                      >
                        Print ID
                      </Button>
                      <Button
                        size="small"
                        onClick={openRenewalModal}
                        disabled={!canOpenRenewal}
                      >
                        Renew ID
                      </Button>
                    </div>
                    {renewalDisabledHint && (
                      <p className={styles.idCardHint}>{renewalDisabledHint}</p>
                    )}
                  </div>
                </div>
              )}
            </section>

            <HelperText className={styles.footerNote}>
              For any corrections to your information, please visit the barangay office so our social services team can
              update your records.
            </HelperText>
          </form>
      </Card>
      <Modal
        isOpen={renewalModalOpen}
        onClose={closeRenewalModal}
        title="Renew Beneficiary ID"
        size="medium"
        footer={
          <div className={styles.renewalModalFooter}>
            <Button variant="secondary" onClick={closeRenewalModal} disabled={renewalSubmitting}>
              Cancel
            </Button>
            <Button onClick={submitRenewal} disabled={renewalSubmitting || !renewalFiles.length}>
              {renewalSubmitting ? 'Submitting...' : 'Submit Renewal Request'}
            </Button>
          </div>
        }
      >
        <div className={styles.renewalModalBody}>
          <div className={styles.renewalDateBox}>
            <span className={styles.idCardLabel}>Current Expiration Date</span>
            <strong>{formatCardDate(idCard.card?.expires_at)}</strong>
          </div>
          <FileUpload
            label="Upload Updated Valid ID"
            documentType="validId"
            multiple={false}
            files={renewalFiles}
            onChange={setRenewalFiles}
            required
          />
          <label className={styles.remarksLabel}>
            Optional Remarks
            <textarea
              className={styles.remarksInput}
              value={renewalRemarks}
              onChange={(event) => setRenewalRemarks(event.target.value)}
              placeholder="Add notes for the barangay office"
            />
          </label>
          {renewalError && <p className={styles.renewalError}>{renewalError}</p>}
        </div>
      </Modal>
    </div>
  );
}
