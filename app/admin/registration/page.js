'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Button from '@/components/Button';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';
import { assistanceTypeOptions, assistanceData } from '@/lib/assistanceData';
import {
  buildRequirementsMap,
  getLocalBudgetsMap,
  getLocalRequirementsMap,
  getRequirementsForType,
  isMissingRequirementsColumn,
} from '@/lib/assistanceRequirements';
import { createOrUpdateResident } from '@/lib/residents';
import { getCooldownInfo } from '@/lib/requestCooldown';

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

const purokOptions = [
  { value: '1A', label: '1A' },
  { value: '1B', label: '1B' },
  { value: '2', label: '2' },
  { value: '3A', label: '3A' },
  { value: '3B', label: '3B' },
  { value: '3C', label: '3C' },
  { value: '3D', label: '3D' },
  { value: '3E', label: '3E' },
  { value: '3F', label: '3F' },
  { value: '4A', label: '4A' },
  { value: '4B', label: '4B' },
  { value: '4C', label: '4C' },
  { value: '4D', label: '4D' },
  { value: '4E', label: '4E' },
  { value: '5A', label: '5A' },
  { value: '5A1', label: '5A1' },
  { value: '5A2', label: '5A2' },
  { value: '5B', label: '5B' },
  { value: '5C', label: '5C' },
  { value: '5D', label: '5D' },
  { value: '5E', label: '5E' },
  { value: '5F', label: '5F' },
  { value: '6A', label: '6A' },
  { value: '6A EXT.', label: '6A EXT.' },
  { value: '6B1', label: '6B1' },
  { value: '6B2', label: '6B2' },
  { value: '6C1', label: '6C1' },
  { value: '6C2', label: '6C2' },
  { value: '6D', label: '6D' },
  { value: '6E', label: '6E' },
  { value: '7', label: '7' },
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
  const [requirementsByType, setRequirementsByType] = useState({});
  const [formData, setFormData] = useState({
    // Personal Information
    lastName: '',
    firstName: '',
    middleName: '',
    houseNo: '',
    purok: '',
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
    requirementsChecklist: {},
    requirementsCompleted: false, // fallback when no checklist is defined
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
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
          setBudgets(getLocalBudgetsMap());
          setRequirementsByType(getLocalRequirementsMap());
          return;
        }
        
        let usedFallback = false;
        let { data, error } = await supabase
          .from('assistance_budgets')
          .select('assistance_type, ceiling, requirements');

        if (error && isMissingRequirementsColumn(error)) {
          const fallback = await supabase
            .from('assistance_budgets')
            .select('assistance_type, ceiling');
          data = fallback.data;
          error = fallback.error;
          usedFallback = true;
        }

        if (error) {
          console.error('Error loading assistance budgets', error.message);
          setBudgets(getLocalBudgetsMap());
          setRequirementsByType(getLocalRequirementsMap());
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
          setRequirementsByType(
            usedFallback ? getLocalRequirementsMap() : buildRequirementsMap(data),
          );
        }
      } catch (err) {
        console.error('Unexpected error loading assistance budgets', err);
        setBudgets(getLocalBudgetsMap());
        setRequirementsByType(getLocalRequirementsMap());
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

  const getRequirementsFor = (type) => getRequirementsForType(type, requirementsByType);

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
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;

    // Clear error when user starts changing the field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    if (name === 'assistanceType') {
      const ceiling = getCeilingFor(value);
      const reqs = value ? getRequirementsFor(value) : [];

      setErrors((prev) => ({
        ...prev,
        assistanceAmount: '',
        requirementsChecklist: '',
        requirementsCompleted: '',
      }));

      setFormData((prev) => ({
        ...prev,
        assistanceType: value,
        assistanceAmount: ceiling != null ? String(ceiling) : '',
        requirementsChecklist: reqs.reduce((acc, _req, idx) => {
          acc[idx] = false;
          return acc;
        }, {}),
        // Fallback confirmation when no checklist exists (e.g., Others)
        requirementsCompleted: false,
      }));
      return;
    }

    if (name === 'contactNumber' || name === 'representativeContact' || name === 'beneficiaryContact') {
      const numericValue = String(value || '').replace(/\D/g, '');
      if (numericValue.length <= 11) {
        setFormData((prev) => ({
          ...prev,
          [name]: numericValue,
        }));
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
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

  const toggleRequirement = (index) => {
    if (errors.requirementsChecklist) {
      setErrors((prev) => ({ ...prev, requirementsChecklist: '' }));
    }

    setFormData((prev) => ({
      ...prev,
      requirementsChecklist: {
        ...(prev.requirementsChecklist || {}),
        [index]: !prev?.requirementsChecklist?.[index],
      },
    }));
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
    if (!String(formData.purok || '').trim()) newErrors.purok = 'Purok is required';
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

    if (!newErrors.birthday) {
      const ageValue = calculateAge(formData.birthday);
      if (ageValue === '' || Number.isNaN(ageValue) || ageValue < 0) {
        newErrors.birthday = 'Please provide a valid birthday.';
      } else if (ageValue < 18) {
        newErrors.birthday = 'Registrant must be at least 18 years old.';
      } else if (formData.sectors.seniorCitizen && ageValue < 60) {
        newErrors.sectors = 'Senior Citizen requires age 60 or above.';
      }
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

      // Representative must not match beneficiary when provided
      const norm = (v) => String(v || '').trim().toLowerCase();
      if (formData.representativeName && norm(formData.representativeName) === norm(formData.beneficiaryName)) {
        newErrors.representativeName = 'Representative must be different from beneficiary.';
      }
      if (formData.representativeContact) {
        if (String(formData.representativeContact).replace(/\D/g, '').length !== 11) {
          newErrors.representativeContact = 'Representative contact number must be exactly 11 digits.';
        } else if (
          String(formData.representativeContact || '').trim() === String(formData.beneficiaryContact || '').trim()
        ) {
          newErrors.representativeContact = 'Representative contact must be different from beneficiary contact.';
        }
      }
    }

    if (formData.assistanceType && !formData.assistanceAmount) {
      newErrors.assistanceAmount = 'Budget ceiling is not configured for this assistance type. Please update the assistance guidelines.';
    }

    if (formData.assistanceType) {
      if (selectedAssistanceRequirements.length) {
        const allChecked = selectedAssistanceRequirements.every(
          (_req, idx) => !!formData?.requirementsChecklist?.[idx],
        );

        if (!allChecked) {
          newErrors.requirementsChecklist = 'Please verify each requirement by checking all boxes.';
        }
      } else if (!formData.requirementsCompleted) {
        newErrors.requirementsCompleted = 'Please confirm that the requirements are complete.';
      }
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
        purok: formData.purok,
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

        const { data: lastRequest, error: lastRequestError } = await supabase
          .from('assistance_requests')
          .select('request_date, created_at')
          .eq('resident_id', residentData.id)
          .eq('status', 'Released')
          .order('request_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastRequestError) {
          throw lastRequestError;
        }

        const lastRequestDate = lastRequest?.request_date || lastRequest?.created_at || null;
        const cooldownInfo = getCooldownInfo(lastRequestDate);
        if (!cooldownInfo.isEligible) {
          setStatus({
            type: 'error',
            message: `Request blocked. Beneficiary can submit again on ${cooldownInfo.nextEligibleDate} (${cooldownInfo.daysRemaining} day(s) remaining).`,
          });
          return;
        }

        const assistanceControlNumber = await getNextSequentialControlNumber('assistance_requests');

        const buildAddress = () => {
          const barangayLabel = formData.barangay === 'sta-rita' ? 'Sta. Rita' : formData.barangay;
          const purokPart = formData.purok ? `Purok ${formData.purok}` : '';
          return [formData.houseNo, purokPart, barangayLabel, formData.city]
            .map((s) => String(s || '').trim())
            .filter(Boolean)
            .join(', ');
        };

        // Admin/Staff: requirements are verified via checklist (no file uploads).

        const requirementsChecklist = selectedAssistanceRequirements.map((label, idx) => ({
          label,
          checked: !!formData?.requirementsChecklist?.[idx],
        }));

        const requirementsCompleted = requirementsChecklist.length
          ? requirementsChecklist.every((row) => !!row?.checked)
          : !!formData.requirementsCompleted;

        const residentFullName = `${formData.firstName} ${formData.lastName}`.trim();

        const beneficiaryName = String(formData.beneficiaryName || '').trim() || residentFullName;
        const beneficiaryContact = String(formData.beneficiaryContact || '').trim() || String(formData.contactNumber || '').trim();
        const beneficiaryAddress = String(formData.beneficiaryAddress || '').trim() || buildAddress();

        const representativeName = String(formData.representativeName || '').trim();
        const representativeContact = String(formData.representativeContact || '').trim();

        const payload = {
          control_number: assistanceControlNumber,
          resident_id: residentData.id, // Link to the newly created resident

          // Representative = person requesting on behalf of the beneficiary.
          // If blank, treat this as a self-request by the beneficiary.
          requester_name: representativeName || beneficiaryName,
          requester_contact: representativeContact || beneficiaryContact,
          requester_address: beneficiaryAddress,

          beneficiary_name: beneficiaryName,
          beneficiary_contact: beneficiaryContact,
          beneficiary_address: beneficiaryAddress,

          assistance_type:
            formData.assistanceType === 'Others' ? formData.otherAssistanceType : formData.assistanceType,
          amount: formData.assistanceAmount || 0,
          status: 'Pending', // Default status
          request_date: formData.dateOfRequest,
          requirements_completed: requirementsCompleted,
          requirements_checklist: requirementsChecklist,
        };

        const stripMissingAssistanceColumn = (message, attemptPayload) => {
          const msg = String(message || '');

          let match = msg.match(/Could not find the '([^']+)' column of 'assistance_requests' in the schema cache/i);
          if (!match) {
            match = msg.match(/column\s+(?:public\.)?assistance_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
          }
          if (!match) {
            match = msg.match(
              /column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"(?:public\.)?assistance_requests"\s+does\s+not\s+exist/i,
            );
          }

          const col = match?.[1];
          if (!col || !attemptPayload || typeof attemptPayload !== 'object') {
            return { payload: attemptPayload, removed: null };
          }
          if (!(col in attemptPayload)) return { payload: attemptPayload, removed: null };

          const next = { ...attemptPayload };
          delete next[col];
          return { payload: next, removed: col };
        };

        let attemptPayload = payload;
        let savedAssistance = null;
        let assistanceError;

        for (let attempt = 0; attempt < 3; attempt++) {
          ;({ data: savedAssistance, error: assistanceError } = await supabase
            .from('assistance_requests')
            .insert(attemptPayload)
            .select('id, requirements_checklist, requirements_completed')
            .single());
          if (!assistanceError) break;

          const stripped = stripMissingAssistanceColumn(assistanceError.message, attemptPayload);
          if (!stripped.removed) break;
          if (['requirements_checklist', 'requirements_completed'].includes(stripped.removed)) {
            throw new Error(
              'Database is missing requirements verification columns. Run the Supabase migration before saving registrations.',
            );
          }

          attemptPayload = stripped.payload;
        }

        if (assistanceError) throw assistanceError;

        const savedChecklist = Array.isArray(savedAssistance?.requirements_checklist)
          ? savedAssistance.requirements_checklist
          : [];
        const savedCompleted = savedAssistance?.requirements_completed === true;
        const savedChecklistCompleted = savedChecklist.length
          ? savedChecklist.every((row) => row?.checked === true)
          : savedCompleted;

        if (
          savedChecklist.length !== requirementsChecklist.length ||
          savedChecklistCompleted !== requirementsCompleted ||
          savedCompleted !== requirementsCompleted
        ) {
          throw new Error(
            'Requirements verification was not saved correctly. Please refresh the page and try again.',
          );
        }
      }

      // Reset form after successful submission
      setFormData({
        lastName: '',
        firstName: '',
        middleName: '',
        houseNo: '',
        purok: '',
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
        requirementsChecklist: {},
        requirementsCompleted: false,
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
      purok: '',
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
      requirementsChecklist: {},
      requirementsCompleted: false,
    });
    void refreshResidentControlNumber();
  };

  const selectedAssistanceRequirements = formData.assistanceType
    ? getRequirementsFor(formData.assistanceType)
    : [];
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
              <Select
                label="Purok"
                name="purok"
                value={formData.purok}
                onChange={handleChange}
                options={purokOptions}
                placeholder="Select purok"
                error={errors.purok}
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
                placeholder="+63 XXX XXX XXXX"
                mask="ph-contact"
                error={errors.contactNumber}
              />
            </div>
          </div>
        </Card>

        {/* Side Cards */}
        <div className={styles.sideCards}>
          {/* ATTACH REQUIREMENTS */}
            <Card
              title="ATTACH REQUIREMENTS"
              subtitle="Confirm that the resident's requirements have been completed"
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
                            <label className={styles.checkbox}>
                              <input
                                type="checkbox"
                                checked={!!formData?.requirementsChecklist?.[idx]}
                                onChange={() => toggleRequirement(idx)}
                              />
                              <span className={styles.checkmark}></span>
                              <span>{req}</span>
                            </label>
                          </li>
                        ))
                      ) : (
                        <li className={styles.assistanceRequirementItemEmpty}>
                          No checklist available for this assistance type.
                        </li>
                      )}
                    </ul>

                    {!selectedAssistanceRequirements.length && (
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          name="requirementsCompleted"
                          checked={!!formData.requirementsCompleted}
                          onChange={handleChange}
                        />
                        <span className={styles.checkmark}></span>
                        <span>I confirm that the requirements are complete.</span>
                      </label>
                    )}

                    {errors.requirementsChecklist && (
                      <p className={styles.errorText}>{errors.requirementsChecklist}</p>
                    )}
                    {errors.requirementsCompleted && (
                      <p className={styles.errorText}>{errors.requirementsCompleted}</p>
                    )}
                  </div>
                ) : (
                  <p className={styles.assistanceRequirementsHint}>
                    Select a Type of Assistance to view the required documents.
                  </p>
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
                type="tel"
                name="representativeContact"
                value={formData.representativeContact}
                onChange={handleChange}
                placeholder="+63 XXX XXX XXXX"
                mask="ph-contact"
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
                type="tel"
                name="beneficiaryContact"
                value={formData.beneficiaryContact}
                onChange={handleChange}
                placeholder="+63 XXX XXX XXXX"
                mask="ph-contact"
                error={errors.beneficiaryContact}
                disabled={!formData.assistanceType}
                optional
              />
              <Input
                label="Beneficiary Address"
                name="beneficiaryAddress"
                value={formData.beneficiaryAddress}
                onChange={handleChange}
                placeholder="House No., Purok, Barangay, City"
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
