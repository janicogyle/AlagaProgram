'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Button from '@/components/Button';
import FileUpload from '@/components/FileUpload';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';
import { assistanceTypeOptions, assistanceData } from '@/lib/assistanceData';
import { createOrUpdateResident } from '@/lib/residents';

const sexOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const civilStatusOptions = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
  { value: 'divorced', label: 'Divorced' },
];

const barangayOptions = [
  { value: 'sta-rita', label: 'Sta. Rita' },
];

const CONTROL_NUMBER_PAD = 3;

const formatYearSequenceControlNumber = (year, seq) => {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeSeq = Number(seq) || 1;
  return `${safeYear}-${String(Math.max(1, safeSeq)).padStart(CONTROL_NUMBER_PAD, '0')}`;
};

const getNextSequentialControlNumber = async (tableName) => {
  const year = new Date().getFullYear();
  const fallback = formatYearSequenceControlNumber(year, 1);

  if (!supabase) return fallback;

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('control_number')
      .like('control_number', `${year}-%`)
      .order('control_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const last = String(data?.control_number || '').trim();
    const match = last.match(new RegExp(`^${year}-(\\d{${CONTROL_NUMBER_PAD}})$`));
    const nextSeq = match ? Number(match[1]) + 1 : 1;

    if (!Number.isFinite(nextSeq) || nextSeq < 1) return fallback;

    return formatYearSequenceControlNumber(year, nextSeq);
  } catch (err) {
    console.warn('[controlNumber] Failed to compute next control number:', err);
    return fallback;
  }
};

export default function RegistrationPage() {
  const router = useRouter();
  const [controlNumber, setControlNumber] = useState('');
  const [budgets, setBudgets] = useState({});
  const [formData, setFormData] = useState({
    // Personal Information
    lastName: '',
    firstName: '',
    middleName: '',
    houseNo: '',
    street: '',
    barangay: 'sta-rita',
    city: 'Olongapo',
    birthday: '',
    birthplace: '',
    sex: '',
    citizenship: 'Filipino',
    civilStatus: '',
    contactNumber: '',
    // Sector Classification
    sectors: {
      pwd: false,
      seniorCitizen: false,
      soloParent: false,
    },
    // Representative Information
    representativeName: '',
    representativeContact: '',
    // Assistance Request
    assistanceType: '',
    otherAssistanceType: '',
    assistanceAmount: '',
    beneficiaryName: '',
    beneficiaryContact: '',
    beneficiaryAddress: '',
    dateOfRequest: new Date().toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [validIdFiles, setValidIdFiles] = useState([]);
  const [status, setStatus] = useState(null);

  const refreshResidentControlNumber = async () => {
    const next = await getNextSequentialControlNumber('residents');
    setControlNumber(next);
  };

  // Generate control number on mount
  useEffect(() => {
    void refreshResidentControlNumber();
  }, []);

  useEffect(() => {
    const loadBudgets = async () => {
      try {
        if (!supabase) {
          console.error('Database client not available');
          return;
        }
        const { data, error } = await supabase
          .from('assistance_budgets')
          .select('assistance_type, ceiling');

        if (error) {
          console.error('Error loading assistance budgets', error.message);
          return;
        }

        if (data) {
          const map = {};
          data.forEach((row) => {
            if (row.assistance_type && typeof row.ceiling === 'number') {
              map[row.assistance_type] = row.ceiling;
            }
          });
          setBudgets(map);
        }
      } catch (err) {
        console.error('Unexpected error loading assistance budgets', err);
      }
    };

    loadBudgets();
  }, []);

  const getCeilingFor = (type) => {
    if (!type) return null;
    const override = budgets[type];
    if (typeof override === 'number') return override;
    const base = assistanceData[type]?.ceiling;
    return typeof base === 'number' ? base : null;
  };

  // Calculate age from date of birth
  const calculateAge = (dob) => {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    if (name === 'assistanceType') {
      const ceiling = getCeilingFor(value);
      setErrors((prev) => ({
        ...prev,
        assistanceAmount: '',
      }));
      setFormData((prev) => ({
        ...prev,
        assistanceType: value,
        assistanceAmount: ceiling != null ? String(ceiling) : '',
      }));
      return;
    }

    if (name === 'contactNumber' || name === 'representativeContact' || name === 'beneficiaryContact') {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length <= 11) {
        setFormData((prev) => ({
          ...prev,
          [name]: numericValue,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleAmountChange = (e) => {
    const { value } = e.target;
    const numericValue = Number(value);

    let message = '';
    if (formData.assistanceType) {
      const ceiling = getCeilingFor(formData.assistanceType);
      if (ceiling != null && Number.isFinite(numericValue) && numericValue > ceiling) {
        message = `Amount exceeds the ₱${ceiling.toLocaleString()} ceiling for this assistance type.`;
      }
    }

    setErrors((prev) => ({
      ...prev,
      assistanceAmount: message,
    }));

    setFormData((prev) => ({
      ...prev,
      assistanceAmount: value,
    }));
  };

  const handleSectorChange = (sector) => {
    // Clear sector error when user selects
    if (errors.sectors) {
      setErrors((prev) => ({ ...prev, sectors: '' }));
    }

    setFormData((prev) => {
      const cleared = { pwd: false, seniorCitizen: false, soloParent: false };
      const isSelected = !!prev?.sectors?.[sector];
      return {
        ...prev,
        sectors: isSelected ? cleared : { ...cleared, [sector]: true },
      };
    });
  };

  const handleAddDocument = () => {
    const trimmed = newDocument.trim();
    if (trimmed && !requiredDocuments.includes(trimmed)) {
      setRequiredDocuments((prev) => [...prev, trimmed]);
      setNewDocument('');
    }
  };

  const handleRemoveDocument = (index) => {
    setRequiredDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDocumentKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDocument();
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.houseNo.trim()) newErrors.houseNo = 'House number is required';
    if (!formData.street.trim()) newErrors.street = 'Street is required';
    if (!formData.birthday) newErrors.birthday = 'Birthday is required';
    if (!formData.birthplace.trim()) newErrors.birthplace = 'Birthplace is required';
    if (!formData.sex) newErrors.sex = 'Sex is required';
    if (!formData.citizenship.trim()) newErrors.citizenship = 'Citizenship is required';
    if (!formData.civilStatus) newErrors.civilStatus = 'Civil status is required';
    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    } else if (formData.contactNumber.length !== 11) {
      newErrors.contactNumber = 'Contact number must be exactly 11 digits';
    }

    // Validate assistance fields if a type is selected
    if (formData.assistanceType) {
      if (!formData.beneficiaryName.trim()) {
        newErrors.beneficiaryName = 'Beneficiary name is required for assistance';
      }
      if (!formData.beneficiaryContact.trim()) {
        newErrors.beneficiaryContact = 'Beneficiary contact number is required';
      } else if (formData.beneficiaryContact.replace(/\D/g, '').length !== 11) {
        newErrors.beneficiaryContact = 'Beneficiary contact number must be exactly 11 digits';
      }
      if (!formData.beneficiaryAddress.trim()) {
        newErrors.beneficiaryAddress = 'Beneficiary address is required';
      }
    }

    if (formData.assistanceType && !formData.assistanceAmount) {
      newErrors.assistanceAmount = 'Budget ceiling is not configured for this assistance type. Please update the assistance guidelines.';
    }

    if (validIdFiles.length === 0) {
      newErrors.validId = 'Please attach at least one requirement file';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setStatus(null);
    setIsSubmitting(true);

    try {
      const age = calculateAge(formData.birthday);

      // Ensure we have a sequential control number (YYYY-###)
      const residentControlNumber = controlNumber || (await getNextSequentialControlNumber('residents'));
      if (!controlNumber) {
        setControlNumber(residentControlNumber);
      }
      
      // 1. Insert or update resident record
      const residentData = await createOrUpdateResident({
        control_number: residentControlNumber,
        last_name: formData.lastName,
        first_name: formData.firstName,
        middle_name: formData.middleName || null,
        house_no: formData.houseNo,
        street: formData.street,
        barangay: formData.barangay,
        city: formData.city,
        birthday: formData.birthday,
        birthplace: formData.birthplace,
        age: age ? parseInt(age) : null,
        sex: formData.sex,
        citizenship: formData.citizenship,
        civil_status: formData.civilStatus,
        contact_number: formData.contactNumber,
        is_pwd: formData.sectors.pwd,
        is_senior_citizen: formData.sectors.seniorCitizen,
        is_solo_parent: formData.sectors.soloParent,
        representative_name: formData.representativeName,
        representative_contact: formData.representativeContact,
        status: 'Active',
      });

      // 2. Insert into assistance_requests table if an assistance type is selected
      if (formData.assistanceType && residentData) {
        if (!supabase) {
          throw new Error('Database client not available');
        }

        const assistanceControlNumber = await getNextSequentialControlNumber('assistance_requests');

        const buildAddress = () => {
          const barangayLabel = formData.barangay === 'sta-rita' ? 'Sta. Rita' : formData.barangay;
          return [formData.houseNo, formData.street, barangayLabel, formData.city]
            .map((s) => String(s || '').trim())
            .filter(Boolean)
            .join(', ');
        };

        // Upload requirement files via server (uses service role; avoids Storage policy issues)
        const requirementFiles = Array.isArray(validIdFiles) ? validIdFiles : [];
        let requirementPaths = [];

        if (requirementFiles.length) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (!token) throw new Error('Please sign in again.');

          for (const file of requirementFiles) {
            const form = new FormData();
            form.append('file', file);
            form.append('controlNumber', assistanceControlNumber);

            const uploadRes = await fetch('/api/admin/upload-valid-id', {
              method: 'POST',
              body: form,
              headers: { Authorization: `Bearer ${token}` },
            });

            const uploadJson = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok || uploadJson?.error) {
              throw new Error(
                uploadJson?.error ||
                  'ATTACH REQUIREMENTS upload failed. Ensure your Supabase Storage bucket is named "document" and SUPABASE_SERVICE_ROLE_KEY is configured.',
              );
            }

            const path = uploadJson?.data?.path || null;
            if (!path) {
              throw new Error('ATTACH REQUIREMENTS upload failed. Please try again.');
            }

            requirementPaths.push(path);
          }
        }

        const { error: assistanceError } = await supabase.from('assistance_requests').insert({
          control_number: assistanceControlNumber,
          resident_id: residentData.id, // Link to the newly created resident
          requester_name: `${formData.firstName} ${formData.lastName}`,
          requester_contact: formData.contactNumber,
          requester_address: buildAddress(),
          beneficiary_name: formData.beneficiaryName,
          beneficiary_contact: formData.beneficiaryContact,
          beneficiary_address: formData.beneficiaryAddress,
          assistance_type:
            formData.assistanceType === 'Others' ? formData.otherAssistanceType : formData.assistanceType,
          amount: formData.assistanceAmount || 0,
          status: 'Pending', // Default status
          request_date: formData.dateOfRequest,
          valid_id_url: requirementPaths[0] || null,
          requirements_urls: requirementPaths,
        });
        if (assistanceError) throw assistanceError;
      }

      // Reset form after successful submission
      setFormData({
        lastName: '',
        firstName: '',
        middleName: '',
        houseNo: '',
        street: '',
        barangay: 'sta-rita',
        city: 'Olongapo',
        birthday: '',
        birthplace: '',
        sex: '',
        citizenship: 'Filipino',
        civilStatus: '',
        contactNumber: '',
        sectors: {
          pwd: false,
          seniorCitizen: false,
          soloParent: false,
        },
        representativeName: '',
        representativeContact: '',
        assistanceType: '',
        otherAssistanceType: '',
        assistanceAmount: '',
        beneficiaryName: '',
        beneficiaryContact: '',
        beneficiaryAddress: '',
        dateOfRequest: new Date().toISOString().split('T')[0],
      });
      void refreshResidentControlNumber();
      setStatus({
        type: 'success',
        message: 'Registration saved successfully.',
      });

      // Navigate to assistance page with resident data
      if (residentData) {
        router.push(`/admin/assistance?residentId=${residentData.id}`);
      }
    } catch (error) {
      console.error('Error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to save registration: ' + error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      lastName: '',
      firstName: '',
      middleName: '',
      houseNo: '',
      street: '',
      barangay: 'sta-rita',
      city: 'Olongapo',
      birthday: '',
      birthplace: '',
      sex: '',
      citizenship: 'Filipino',
      civilStatus: '',
      contactNumber: '',
      sectors: {
        pwd: false,
        seniorCitizen: false,
        soloParent: false,
      },
      representativeName: '',
      representativeContact: '',
      assistanceType: '',
      otherAssistanceType: '',
      assistanceAmount: '',
      beneficiaryName: '',
      beneficiaryContact: '',
      beneficiaryAddress: '',
      dateOfRequest: new Date().toISOString().split('T')[0],
    });
    void refreshResidentControlNumber();
    setValidIdFiles([]);
  };

  const selectedAssistanceRequirements =
    formData.assistanceType ? assistanceData[formData.assistanceType]?.requirements || [] : [];
  const selectedAssistanceCeiling = formData.assistanceType ? getCeilingFor(formData.assistanceType) : null;

  return (
    <div className={styles.registrationPage}>
      {status && (
        <div
          className={`${styles.statusBanner} ${
            status.type === 'success'
              ? styles.statusBannerSuccess
              : styles.statusBannerError
          }`}
          role="alert"
        >
          {status.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className={styles.formGrid}>
        {/* Control Number */}
        <div className={styles.controlNumberBar}>
          <div className={styles.controlNumberLabel}>Control Number</div>
          <div className={styles.controlNumberValue}>{controlNumber}</div>
        </div>

        {/* Personal Information */}
        <Card title="Personal Information" subtitle="Enter the basic information of the resident" className={styles.mainCard}>
          <div className={styles.formFields}>
            <div className={styles.row3}>
              <Input
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter last name"
                error={errors.lastName}
                required
              />
              <Input
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter first name"
                error={errors.firstName}
                required
              />
              <Input
                label="Middle Name"
                name="middleName"
                value={formData.middleName}
                onChange={handleChange}
                placeholder="Enter middle name"
                optional
              />
            </div>

            <div className={styles.row}>
              <Input
                label="House No."
                name="houseNo"
                value={formData.houseNo}
                onChange={handleChange}
                placeholder="House number"
                error={errors.houseNo}
                required
              />
              <Input
                label="Street"
                name="street"
                value={formData.street}
                onChange={handleChange}
                placeholder="Street name"
                error={errors.street}
                required
              />
            </div>

            <div className={styles.row}>
              <Select
                label="Barangay"
                name="barangay"
                value={formData.barangay}
                onChange={handleChange}
                options={barangayOptions}
                placeholder="Select barangay"
                required
                disabled
              />
              <Input
                label="City/Municipality"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter city"
                disabled
              />
            </div>

            <div className={styles.row3}>
              <Input
                label="Birthday"
                type="date"
                name="birthday"
                value={formData.birthday}
                onChange={handleChange}
                error={errors.birthday}
                required
              />
              <div className={styles.ageField}>
                <label className={styles.label}>Age</label>
                <div className={styles.ageDisplay}>
                  {calculateAge(formData.birthday) || 'Auto'}
                </div>
              </div>
              <Input
                label="Birthplace"
                name="birthplace"
                value={formData.birthplace}
                onChange={handleChange}
                placeholder="Place of birth"
                error={errors.birthplace}
                required
              />
            </div>

            <div className={styles.row}>
              <Select
                label="Sex"
                name="sex"
                value={formData.sex}
                onChange={handleChange}
                options={sexOptions}
                placeholder="Select sex"
                error={errors.sex}
                required
              />
              <Input
                label="Citizenship"
                name="citizenship"
                value={formData.citizenship}
                onChange={handleChange}
                placeholder="Enter citizenship"
                error={errors.citizenship}
                required
              />
            </div>

            <div className={styles.row}>
              <Select
                label="Civil Status"
                name="civilStatus"
                value={formData.civilStatus}
                onChange={handleChange}
                options={civilStatusOptions}
                placeholder="Select civil status"
                error={errors.civilStatus}
                required
              />
              <Input
                label="Contact Number"
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
                error={errors.contactNumber}
                maxLength={11}
              />
            </div>
          </div>
        </Card>

        {/* Side Cards */}
        <div className={styles.sideCards}>
          {/* ATTACH REQUIREMENTS */}
            <Card
              title="ATTACH REQUIREMENTS"
              subtitle="Upload a clear photo or scan of the resident's requirements for verification"
            >
              <div className={styles.formFields}>
                {formData.assistanceType ? (
                  <div className={styles.assistanceRequirementsPanel}>
                    <div className={styles.assistanceRequirementsHeader}>
                      <span className={styles.assistanceRequirementsTitle}>
                        Requirements for {formData.assistanceType}
                      </span>
                      {typeof selectedAssistanceCeiling === 'number' && (
                        <span className={styles.assistanceRequirementsCeiling}>
                          Ceiling: ₱{Number(selectedAssistanceCeiling).toLocaleString('en-PH')}
                        </span>
                      )}
                    </div>
                    <ul className={styles.assistanceRequirementsList}>
                      {selectedAssistanceRequirements.length ? (
                        selectedAssistanceRequirements.map((req, idx) => (
                          <li key={idx} className={styles.assistanceRequirementItem}>
                            {req}
                          </li>
                        ))
                      ) : (
                        <li className={styles.assistanceRequirementItemEmpty}>
                          No checklist available for this assistance type.
                        </li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <p className={styles.assistanceRequirementsHint}>
                    Select a Type of Assistance to view the required documents.
                  </p>
                )}

                <FileUpload
                  label="Required"
                  documentType="validId"
                  multiple={true}
                  files={validIdFiles}
                  onChange={setValidIdFiles}
                  required
                />
                {errors.validId && (
                  <p className={styles.errorText}>{errors.validId}</p>
                )}
              </div>
            </Card>

          {/* Assistance Request Card */}
          <Card title="Initial Assistance Request" subtitle="Optional: log an assistance request upon registration">
            <div className={styles.formFields}>
              <Select
                label="Type of Assistance"
                name="assistanceType"
                value={formData.assistanceType}
                onChange={handleChange}
                options={[{ value: '', label: 'Select type (if any)' }, ...assistanceTypeOptions]}
                optional
              />
              {formData.assistanceType === 'Others' && (
                <Input
                  label="Please specify"
                  name="otherAssistanceType"
                  value={formData.otherAssistanceType}
                  onChange={handleChange}
                  placeholder="Specify other assistance"
                  required
                />
              )}
              <Input
                label="Representative Name"
                name="representativeName"
                value={formData.representativeName}
                onChange={handleChange}
                placeholder="Enter representative's full name"
                disabled={!formData.assistanceType}
                optional
              />
              <Input
                label="Representative Contact"
                name="representativeContact"
                value={formData.representativeContact}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
                maxLength={11}
                disabled={!formData.assistanceType}
                optional
              />

              <div>
                <span className={styles.label}>Sector Classification (choose one)</span>
                <div className={styles.sectorList}>
                  {errors.sectors && <span className={styles.sectorError}>{errors.sectors}</span>}
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.sectors.pwd}
                      onChange={() => handleSectorChange('pwd')}
                    />
                    <span className={styles.checkmark}></span>
                    <span>PWD (Person with Disability)</span>
                  </label>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.sectors.seniorCitizen}
                      onChange={() => handleSectorChange('seniorCitizen')}
                    />
                    <span className={styles.checkmark}></span>
                    <span>Senior Citizen (60 years old and above)</span>
                  </label>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.sectors.soloParent}
                      onChange={() => handleSectorChange('soloParent')}
                    />
                    <span className={styles.checkmark}></span>
                    <span>Solo Parent</span>
                  </label>
                </div>
              </div>

              <Input
                label="Beneficiary Name"
                name="beneficiaryName"
                value={formData.beneficiaryName}
                onChange={handleChange}
                placeholder="Enter beneficiary's full name"
                error={errors.beneficiaryName}
                disabled={!formData.assistanceType}
                optional
              />
              <Input
                label="Beneficiary Contact"
                name="beneficiaryContact"
                value={formData.beneficiaryContact}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
                maxLength={11}
                error={errors.beneficiaryContact}
                disabled={!formData.assistanceType}
                optional
              />
              <Input
                label="Beneficiary Address"
                name="beneficiaryAddress"
                value={formData.beneficiaryAddress}
                onChange={handleChange}
                placeholder="House No., Street, Barangay, City"
                error={errors.beneficiaryAddress}
                disabled={!formData.assistanceType}
                optional
              />
              <Input
                label="Budget Ceiling"
                name="assistanceAmount"
                type="number"
                value={formData.assistanceAmount}
                placeholder="Auto-filled from assistance type"
                error={errors.assistanceAmount}
                disabled={!formData.assistanceType}
                readOnly
                optional
              />
            </div>
          </Card>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {isSubmitting ? 'Saving...' : 'Save Registration'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
