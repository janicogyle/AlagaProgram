'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Button from '@/components/Button';
import styles from './page.module.css';

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

const generateControlNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `ALAGA-${year}-${random}`;
};

export default function RegistrationPage() {
  const [controlNumber, setControlNumber] = useState('');
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
  });
  const [documents, setDocuments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate control number on mount
  useEffect(() => {
    setControlNumber(generateControlNumber());
  }, []);

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

    if (name === 'contactNumber' || name === 'representativeContact') {
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

  const handleSectorChange = (sector) => {
    setFormData((prev) => ({
      ...prev,
      sectors: {
        ...prev.sectors,
        [sector]: !prev.sectors[sector],
      },
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setDocuments((prev) => [...prev, ...files]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setDocuments((prev) => [...prev, ...files]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removeDocument = (index) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.contactNumber && formData.contactNumber.length !== 11) {
      alert('Contact number must be exactly 11 digits.');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Implement Supabase submission
      const submissionData = {
        controlNumber,
        ...formData,
        age: calculateAge(formData.birthday),
      };
      console.log('Form Data:', submissionData);
      console.log('Documents:', documents);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

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
      });
      setDocuments([]);
      setControlNumber(generateControlNumber());

      alert('Registration saved successfully!');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save registration');
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
    });
    setDocuments([]);
    setControlNumber(generateControlNumber());
  };

  return (
    <div className={styles.registrationPage}>
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
                required
              />
              <Input
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter first name"
                required
              />
              <Input
                label="Middle Name"
                name="middleName"
                value={formData.middleName}
                onChange={handleChange}
                placeholder="Enter middle name"
              />
            </div>

            <div className={styles.row}>
              <Input
                label="House No."
                name="houseNo"
                value={formData.houseNo}
                onChange={handleChange}
                placeholder="House number"
              />
              <Input
                label="Street"
                name="street"
                value={formData.street}
                onChange={handleChange}
                placeholder="Street name"
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
              />
              <Input
                label="City/Municipality"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter city"
              />
            </div>

            <div className={styles.row3}>
              <Input
                label="Birthday"
                type="date"
                name="birthday"
                value={formData.birthday}
                onChange={handleChange}
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
                required
              />
              <Input
                label="Citizenship"
                name="citizenship"
                value={formData.citizenship}
                onChange={handleChange}
                placeholder="Enter citizenship"
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
                required
              />
              <Input
                label="Contact Number"
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
                maxLength={11}
              />
            </div>
          </div>
        </Card>

        {/* Side Cards */}
        <div className={styles.sideCards}>
          {/* Sector Classification */}
          <Card title="Sector Classification" subtitle="Select applicable sector(s)">
            <div className={styles.sectorList}>
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
          </Card>

          {/* Representative Information */}
          <Card title="Representative Information" subtitle="Fill only if applicable">
            <div className={styles.formFields}>
              <Input
                label="Representative Name"
                name="representativeName"
                value={formData.representativeName}
                onChange={handleChange}
                placeholder="Enter representative's full name"
              />
              <Input
                label="Contact Number"
                type="tel"
                name="representativeContact"
                value={formData.representativeContact}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
                maxLength={11}
              />
            </div>
          </Card>

          {/* Document Upload */}
          <Card title="Document Upload" subtitle="Upload ID or supporting documents">
            <div 
              className={styles.uploadArea}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                type="file"
                id="fileUpload"
                multiple
                onChange={handleFileChange}
                className={styles.fileInput}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <label htmlFor="fileUpload" className={styles.uploadLabel}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Drag and drop files here or</span>
                <span className={styles.browseLink}>Browse files</span>
              </label>
            </div>
            {documents.length > 0 && (
              <div className={styles.fileList}>
                {documents.map((file, index) => (
                  <div key={index} className={styles.fileItem}>
                    <div className={styles.fileInfo}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>{file.name}</span>
                    </div>
                    <button type="button" onClick={() => removeDocument(index)} className={styles.removeBtn}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={handleCancel}>
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
