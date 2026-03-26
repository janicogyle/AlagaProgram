'use client';

import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Input from '../../../components/Input';
import { SectionHeader, HelperText, StatusChip } from '@/components';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';

export default function ProfilePage() {
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);

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
          .select('*')
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

  const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString();
  };

  const sectors = [];
  if (resident?.is_pwd) sectors.push('PWD');
  if (resident?.is_senior_citizen) sectors.push('Senior Citizen');
  if (resident?.is_solo_parent) sectors.push('Solo Parent');

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
            We couldn't find your beneficiary profile yet. The layout below shows what will be stored once you sign up.
          </p>
        )}

        <form className={styles.profileForm}>
            <section className={styles.section} aria-labelledby="personal-info-heading">
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
                  label="Contact Number"
                  type="tel"
                  value={resident?.contact_number || ''}
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

            <section className={styles.section} aria-labelledby="address-info-heading">
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
                  label="Street / Sitio"
                  type="text"
                  value={resident?.street || ''}
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

            <HelperText>
              For any corrections to your information, please visit the barangay office so our social services team can
              update your records.
            </HelperText>
          </form>
      </Card>
    </div>
  );
}
