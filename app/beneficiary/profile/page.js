'use client';

import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Input from '../../../components/Input';
import { SectionHeader, HelperText, StatusChip, Button } from '@/components';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';

export default function ProfilePage() {
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idCard, setIdCard] = useState({ loading: true, token: null, qrUrl: null, card: null, error: null });

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
            'id, first_name, middle_name, last_name, birthday, age, birthplace, sex, citizenship, civil_status, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent',
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

  useEffect(() => {
    const loadCard = async () => {
      setIdCard({ loading: true, token: null, qrUrl: null, card: null, error: null });
      try {
        const response = await fetch('/api/beneficiary-cards/me', {
          method: 'GET',
          credentials: 'include',
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.error) {
          throw new Error(payload?.error || 'Unable to load your ID card.');
        }

        const token = payload?.data?.token;
        const card = payload?.data?.card;
        if (!token || !card) throw new Error('No ID card available.');

        const qrcodeMod = await import('qrcode');
        const QRCode = qrcodeMod.default ?? qrcodeMod;
        const qrUrl = await QRCode.toDataURL(token, { margin: 1, width: 220 });

        setIdCard({ loading: false, token, qrUrl, card, error: null });
      } catch (err) {
        const msg = String(err?.message || 'Unable to load ID card.');
        const isNotSetup =
          msg.toLowerCase().includes('beneficiary_cards') &&
          (msg.toLowerCase().includes('schema cache') || msg.toLowerCase().includes('could not find the table') || msg.toLowerCase().includes('does not exist'));

        setIdCard({
          loading: false,
          token: null,
          qrUrl: null,
          card: null,
          error: isNotSetup
            ? 'Beneficiary ID (QR) is not enabled yet. Please ask the barangay office/admin to run the database setup.'
            : msg,
        });
      }
    };

    loadCard();
  }, []);

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
  const addressLine = [resident?.house_no, resident?.purok, resident?.barangay, resident?.city]
    .filter(Boolean)
    .join(', ');

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
        {!loading && resident && (
          <div className={styles.profileSummary}>
            <div className={styles.profileIdentity}>
              <h2 className={styles.profileName}>{fullName || 'Beneficiary'}</h2>
              <p className={styles.profileMeta}>{resident?.contact_number || 'No contact number on file'}</p>
              <p className={styles.profileMeta}>{addressLine || 'No address on file'}</p>
            </div>
            <div className={styles.profileBadges}>
              {sectors.length ? sectors.map((s) => <StatusChip key={s} label={s} />) : <StatusChip label="General" />}
            </div>
          </div>
        )}

        <form className={styles.profileForm}>
            <section className={styles.sectionCard} aria-labelledby="id-card-heading">
              <SectionHeader
                id="id-card-heading"
                title="Beneficiary ID (QR)"
                subtitle="Show this QR code at the barangay office for quick identification."
              />

              {idCard.loading && <p className={styles.muted}>Loading your ID card…</p>}
              {!idCard.loading && idCard.error && (
                <p className={styles.muted}>{idCard.error}</p>
              )}
              {!idCard.loading && idCard.qrUrl && (
                <div className={styles.qrWrap}>
                  <div className={styles.qrImageBox}>
                    <img className={styles.qrImage} src={idCard.qrUrl} alt="Beneficiary ID QR Code" />
                  </div>
                  <div className={styles.qrMeta}>
                    <div className={styles.qrRow}>
                      <span className={styles.qrLabel}>Expires:</span>
                      <strong>{idCard.card?.expires_at ? new Date(idCard.card.expires_at).toLocaleDateString() : '-'}</strong>
                    </div>
                    <div className={styles.qrRow}>
                      <span className={styles.qrLabel}>Card Ref:</span>
                      <span className={styles.qrRef}>{String(idCard.card?.id || '-').slice(0, 8).toUpperCase()}</span>
                    </div>
                    <p className={styles.qrHint}>Keep this QR private. Share only with authorized barangay staff.</p>
                    <div className={styles.qrButtons}>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(idCard.token);
                          } catch (e) {
                            console.warn('Copy failed:', e);
                          }
                        }}
                      >
                        Copy Token
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = idCard.qrUrl;
                          a.download = 'beneficiary-id-qr.png';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                      >
                        Download QR
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className={styles.sectionCard} aria-labelledby="personal-info-heading">
              <SectionHeader
                id="personal-info-heading"
                title="Personal information"
                subtitle="Basic details you shared when signing up as a beneficiary."
              />
              <div className={styles.formGrid}>
                <Input
                  label="First Name"
                  type="text"
                  value={resident?.first_name || ''}
                  disabled
                />
                <Input
                  label="Middle Name"
                  type="text"
                  value={resident?.middle_name || ''}
                  disabled
                />
                <Input
                  label="Last Name"
                  type="text"
                  value={resident?.last_name || ''}
                  disabled
                />
                <Input
                  label="Birthday"
                  type="text"
                  value={formatDate(resident?.birthday)}
                  disabled
                />
                <Input
                  label="Age"
                  type="text"
                  value={
                    resident?.age != null && resident?.age !== ''
                      ? String(resident.age)
                      : String(calculateAge(resident?.birthday) || '')
                  }
                  disabled
                />
                <Input
                  label="Birthplace"
                  type="text"
                  value={resident?.birthplace || ''}
                  disabled
                />
                <Input
                  label="Sex"
                  type="text"
                  value={formatLabel(resident?.sex)}
                  disabled
                />
                <Input
                  label="Citizenship"
                  type="text"
                  value={resident?.citizenship || ''}
                  disabled
                />
                <Input
                  label="Civil Status"
                  type="text"
                  value={formatLabel(resident?.civil_status)}
                  disabled
                />
                <Input
                  label="Contact Number"
                  type="tel"
                  value={resident?.contact_number || ''}
                  placeholder="+63 XXX XXX XXXX"
                  mask="ph-contact"
                  disabled
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>Sectors</label>
                {sectors.length === 0 ? (
                  <p className={styles.muted}>No sector classification on record.</p>
                ) : (
                  <div className={styles.chipRow}>
                    {sectors.map((s) => (
                      <StatusChip key={s} label={s} />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={styles.sectionCard} aria-labelledby="address-info-heading">
              <SectionHeader
                id="address-info-heading"
                title="Address information"
                subtitle="Address details from your sign up form."
              />
              <div className={styles.formGrid}>
                <Input
                  label="House Number"
                  type="text"
                  value={resident?.house_no || ''}
                  disabled
                />
                <Input
                  label="Purok"
                  type="text"
                  value={resident?.purok || ''}
                  disabled
                />
                <Input
                  label="Barangay"
                  type="text"
                  value={resident?.barangay || ''}
                  disabled
                />
                <Input
                  label="City / Municipality"
                  type="text"
                  value={resident?.city || ''}
                  disabled
                />
              </div>
            </section>

            <HelperText className={styles.footerNote}>
              For any corrections to your information, please visit the barangay office so our social services team can
              update your records.
            </HelperText>
          </form>
      </Card>
    </div>
  );
}
