'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Select from '../../components/Select';
import SectionHeader from '@/components/SectionHeader';
import HelperText from '@/components/HelperText';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';
import { createOrUpdateResident } from '@/lib/residents';

const streetOptions = [
  { value: '25th Street', label: '25th Street' },
  { value: '26th Street', label: '26th Street' },
  { value: 'E 27th Street', label: 'E 27th Street' },
  { value: 'Alejo', label: 'Alejo' },
  { value: 'Apitong Extension', label: 'Apitong Extension' },
  { value: 'Ardoin Street', label: 'Ardoin Street' },
  { value: 'Argonaut Highway', label: 'Argonaut Highway' },
  { value: 'Aries Street', label: 'Aries Street' },
  { value: 'Bennet Street', label: 'Bennet Street' },
  { value: 'Canda Street', label: 'Canda Street' },
  { value: 'Clark Street', label: 'Clark Street' },
  { value: 'Corpuz', label: 'Corpuz' },
  { value: 'Del Rosario', label: 'Del Rosario' },
  { value: 'Elicaño Street', label: 'Elicaño Street' },
  { value: 'Filtration Road', label: 'Filtration Road' },
  { value: 'Hawkbill Street', label: 'Hawkbill Street' },
  { value: 'Juana', label: 'Juana' },
  { value: 'Mabini Street', label: 'Mabini Street' },
  { value: 'Mount Balimpuyo Trail', label: 'Mount Balimpuyo Trail' },
  { value: 'Sampaguita Street', label: 'Sampaguita Street' },
  { value: 'Santa Rita Road', label: 'Santa Rita Road' },
  { value: 'Soriano', label: 'Soriano' },
  { value: 'Tabacuhan', label: 'Tabacuhan' },
  { value: 'Taurus Street', label: 'Taurus Street' },
  { value: 'Tulio Street', label: 'Tulio Street' },
];

export default function BeneficiarySignupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    birthday: '',
    contactNumber: '',
    isPwd: false,
    isSeniorCitizen: false,
    isSoloParent: false,
    houseNo: '',
    purok: '',
    street: '',
    barangay: 'Sta. Rita',
    city: 'Olongapo City',
  });

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setForm((prev) => ({ ...prev, [name]: newValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setStatus(null);
    setIsSubmitting(true);

    try {
      const residentData = await createOrUpdateResident({
        first_name: form.firstName,
        middle_name: form.middleName || null,
        last_name: form.lastName,
        birthday: form.birthday,
        contact_number: form.contactNumber,
        house_no: form.houseNo,
        purok: form.purok,
        street: form.street,
        barangay: form.barangay,
        city: form.city,
        is_pwd: form.isPwd,
        is_senior_citizen: form.isSeniorCitizen,
        is_solo_parent: form.isSoloParent,
        status: 'Active',
      });

      // Persist identity locally so beneficiary views (profile, dashboard, history) can load this resident
      if (typeof window !== 'undefined' && residentData) {
        try {
          window.localStorage.setItem('beneficiaryResidentId', String(residentData.id));
          window.localStorage.setItem('beneficiaryContactNumber', form.contactNumber);
          window.localStorage.setItem('beneficiaryName', `${form.firstName} ${form.lastName}`);
        } catch (storageError) {
          console.warn('Unable to persist beneficiary identity in localStorage:', storageError);
        }
      }

      setStatus({
        type: 'success',
        message:
          'Your sign-up request has been recorded. Please visit the barangay office for verification.',
      });
      router.push('/login');
    } catch (err) {
      console.error('Failed to submit beneficiary sign-up:', err);
      setStatus({
        type: 'error',
        message: 'Something went wrong while submitting your sign-up. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleCancel = () => {
    router.back();
  };

  return (
    <div className={styles.signupPage}>
      <PageHeader
        title="ALAGA Program – Beneficiary Sign Up"
        subtitle="Submit your information to request assistance under the Barangay Sta. Rita ALAGA Program."
      />

      <Card className={styles.formCard}>
        <p className={styles.intro}>
          This sign up form is exclusively for the <strong>ALAGA Program</strong> of
          Barangay Sta. Rita. Provide accurate information so our social services team can review your eligibility and
          contact you for verification if needed.
        </p>

        {status && (
          <div
            role="alert"
            className={`${styles.statusBanner} ${
              status.type === 'success' ? styles.statusBannerSuccess : styles.statusBannerError
            }`}
          >
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <section className={styles.section} aria-labelledby="personal-info-heading">
            <SectionHeader
              id="personal-info-heading"
              title="Personal information"
              subtitle="We use these details to correctly identify you as a beneficiary."
            />
            <div className={styles.formGrid}>
              <Input
                label="First Name"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
              />
              <Input
                label="Middle Name"
                name="middleName"
                value={form.middleName}
                onChange={handleChange}
                optional
              />
              <Input
                label="Last Name"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
              />
              <Input
                label="Birthday"
                type="date"
                name="birthday"
                value={form.birthday}
                onChange={handleChange}
                required
              />
              <Input
                label="Contact Number"
                name="contactNumber"
                value={form.contactNumber}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
                required
              />
            </div>

            <div className={styles.sectorRow}>
              <span className={styles.sectorLabel}>Sector classification (if applicable)</span>
              <div className={styles.sectorChips}>
                <label className={styles.sectorChip}>
                  <input
                    type="checkbox"
                    name="isPwd"
                    checked={form.isPwd}
                    onChange={handleChange}
                  />
                  <span>PWD</span>
                </label>
                <label className={styles.sectorChip}>
                  <input
                    type="checkbox"
                    name="isSeniorCitizen"
                    checked={form.isSeniorCitizen}
                    onChange={handleChange}
                  />
                  <span>Senior Citizen</span>
                </label>
                <label className={styles.sectorChip}>
                  <input
                    type="checkbox"
                    name="isSoloParent"
                    checked={form.isSoloParent}
                    onChange={handleChange}
                  />
                  <span>Solo Parent</span>
                </label>
              </div>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="address-info-heading">
            <SectionHeader
              id="address-info-heading"
              title="Address information"
              subtitle="Your address helps us verify your eligibility within the barangay."
            />
            <div className={styles.formGrid}>
              <Input
                label="House Number"
                name="houseNo"
                value={form.houseNo}
                onChange={handleChange}
                required
              />
              <Input
                label="Purok"
                name="purok"
                value={form.purok}
                onChange={handleChange}
                required
              />
              <Select
                label="Street / Sitio"
                name="street"
                value={form.street}
                onChange={handleChange}
                options={streetOptions}
                placeholder="Select street"
                required
              />
              <Input
                label="Barangay"
                name="barangay"
                value={form.barangay}
                readOnly
                disabled
                required
              />
              <Input
                label="City / Municipality"
                name="city"
                value={form.city}
                readOnly
                disabled
                required
              />
            </div>
          </section>

          <HelperText>
            By submitting this form, you confirm that the information you provided is true and correct to the best of
            your knowledge.
          </HelperText>

          <div className={styles.actionsRow}>
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit Sign Up'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
