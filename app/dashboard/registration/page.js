'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Button from '@/components/Button';
import styles from './page.module.css';

const sexOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const purokOptions = [
  { value: 'purok1', label: 'Purok 1' },
  { value: 'purok2', label: 'Purok 2' },
  { value: 'purok3', label: 'Purok 3' },
  { value: 'purok4', label: 'Purok 4' },
  { value: 'purok5', label: 'Purok 5' },
];

export default function RegistrationPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    sex: '',
    contactNumber: '',
    address: '',
    purok: '',
    sectors: {
      pwd: false,
      seniorCitizen: false,
      soloParent: false,
    },
  });
  const [documents, setDocuments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

  const removeDocument = (index) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Implement Supabase submission
      console.log('Form Data:', formData);
      console.log('Documents:', documents);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reset form after successful submission
      setFormData({
        fullName: '',
        dateOfBirth: '',
        sex: '',
        contactNumber: '',
        address: '',
        purok: '',
        sectors: {
          pwd: false,
          seniorCitizen: false,
          soloParent: false,
        },
      });
      setDocuments([]);

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
      fullName: '',
      dateOfBirth: '',
      sex: '',
      contactNumber: '',
      address: '',
      purok: '',
      sectors: {
        pwd: false,
        seniorCitizen: false,
        soloParent: false,
      },
    });
    setDocuments([]);
  };

  return (
    <div className={styles.registrationPage}>
      <form onSubmit={handleSubmit} className={styles.formGrid}>
        {/* Personal Information */}
        <Card title="Personal Information" subtitle="Enter the basic information of the resident" className={styles.mainCard}>
          <div className={styles.formFields}>
            <Input
              label="Full Name"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter full name"
              required
            />

            <div className={styles.row}>
              <Input
                label="Date of Birth"
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                required
              />
              <div className={styles.ageField}>
                <label className={styles.label}>Age (Auto-calculated)</label>
                <div className={styles.ageDisplay}>
                  {calculateAge(formData.dateOfBirth) || 'Auto-calculated'}
                </div>
              </div>
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
                label="Contact Number"
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
              />
            </div>

            <div className={styles.row}>
              <Input
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Street address"
              />
              <Select
                label="Purok"
                name="purok"
                value={formData.purok}
                onChange={handleChange}
                options={purokOptions}
                placeholder="Select purok"
                required
              />
            </div>
          </div>
        </Card>

        {/* Sector Classification */}
        <div className={styles.sideCards}>
          <Card title="Sector Classification" subtitle="Select applicable sector(s)">
            <div className={styles.sectorList}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={formData.sectors.pwd}
                  onChange={() => handleSectorChange('pwd')}
                />
                <span className={styles.checkmark}></span>
                <span>PWD</span>
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={formData.sectors.seniorCitizen}
                  onChange={() => handleSectorChange('seniorCitizen')}
                />
                <span className={styles.checkmark}></span>
                <span>Senior Citizen</span>
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

          {/* Document Upload */}
          <Card title="Document Upload" subtitle="Upload ID or supporting documents">
            <div className={styles.uploadArea}>
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
                    <span>{file.name}</span>
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
