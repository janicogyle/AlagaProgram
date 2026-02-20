'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  Select,
  Table,
  Badge,
  Button,
  Input,
  PageHeader,
  SearchInput,
  FilterBar,
  DataTableFooter,
  Modal,
} from '@/components';
import styles from './page.module.css';

// Sample data - Replace with actual data from Supabase
const sampleAssistance = [
  { id: 1, controlNo: 'AST-2024-00001', requester: 'Maria Santos Cruz', beneficiary: 'Maria Santos Cruz', type: 'Medicine Assistance', date: '2024-01-20', amount: '₱500', status: 'Released' },
  { id: 2, controlNo: 'AST-2024-00002', requester: 'Juan Dela Cruz', beneficiary: 'Elena Dela Cruz', type: 'Confinement Assistance', date: '2024-01-25', amount: '₱1,000', status: 'Approved' },
  { id: 3, controlNo: 'AST-2024-00003', requester: 'Ana Reyes Garcia', beneficiary: 'Pedro Garcia Sr.', type: 'Burial Assistance', date: '2024-02-01', amount: '₱1,000', status: 'Pending' },
  { id: 4, controlNo: 'AST-2024-00004', requester: 'Rosa Mendoza Tan', beneficiary: 'Rosa Mendoza Tan', type: 'Medicine Assistance', date: '2024-02-05', amount: '₱500', status: 'Released' },
  { id: 5, controlNo: 'AST-2024-00005', requester: 'Pedro Lim Torres', beneficiary: 'Pedro Lim Torres', type: 'Others', date: '2024-02-10', amount: '₱300', status: 'Rejected' },
];

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'Medicine Assistance', label: 'Medicine Assistance' },
  { value: 'Confinement Assistance', label: 'Confinement Assistance' },
  { value: 'Burial Assistance', label: 'Burial Assistance' },
  { value: 'Others', label: 'Others' },
];

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Released', label: 'Released' },
  { value: 'Rejected', label: 'Rejected' },
];

const serviceTypes = [
  { value: 'medicine', label: 'Medicine Assistance', ceiling: '₱500' },
  { value: 'confinement', label: 'Confinement Assistance', ceiling: '₱1,000' },
  { value: 'burial', label: 'Burial Assistance', ceiling: '₱1,000' },
  { value: 'others', label: 'Others', ceiling: 'Variable' },
];

const generateControlNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `AST-${year}-${random}`;
};

export default function AssistancePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    requesterName: '',
    requesterContact: '',
    requesterAddress: '',
    serviceType: '',
    otherService: '',
    beneficiaryName: '',
    beneficiaryAddress: '',
    beneficiaryContact: '',
    amount: '',
    approverName: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Filter assistance records
  const filteredAssistance = sampleAssistance.filter((record) => {
    const matchesSearch = 
      record.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.beneficiary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.controlNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || record.type === typeFilter;
    const matchesStatus = !statusFilter || record.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'requesterContact' || name === 'beneficiaryContact') {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length <= 11) {
        setFormData(prev => ({ ...prev, [name]: numericValue }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleServiceTypeChange = (type) => {
    setFormData(prev => ({ ...prev, serviceType: type }));
  };

  const resetForm = () => {
    setFormData({
      requesterName: '',
      requesterContact: '',
      requesterAddress: '',
      serviceType: '',
      otherService: '',
      beneficiaryName: '',
      beneficiaryAddress: '',
      beneficiaryContact: '',
      amount: '',
      approverName: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const submission = {
        controlNumber: generateControlNumber(),
        ...formData,
        status: 'Pending',
      };
      console.log('Assistance Request:', submission);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      resetForm();
      setShowModal(false);
      alert('Assistance request submitted successfully!');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Pending': 'warning',
      'Approved': 'primary',
      'Released': 'success',
      'Rejected': 'danger',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const columns = [
    { key: 'controlNo', label: 'Control No.' },
    { key: 'requester', label: 'Requester' },
    { key: 'beneficiary', label: 'Beneficiary' },
    {
      key: 'type',
      label: 'Type',
      render: (type) => <Badge>{type}</Badge>,
    },
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => getStatusBadge(status),
    },
  ];

  const modalFooter = (
    <>
      <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
      <Button onClick={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit Request'}
      </Button>
    </>
  );

  return (
    <div className={styles.assistancePage}>
      <Card padding={false}>
        <PageHeader
          title="Assistance Records"
          subtitle="Track and manage ALAGA Program assistance requests"
        >
          <Link href="/dashboard/assistance/guidelines" className={styles.guidelinesLink}>
            <Button variant="secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Guidelines
            </Button>
          </Link>
          <Link href="/dashboard/assistance/requests" className={styles.guidelinesLink}>
            <Button variant="secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Manage Requests
            </Button>
          </Link>
          <Button onClick={() => setShowModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Request
          </Button>
        </PageHeader>

        <FilterBar>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name or control number..."
          />
          <Select
            name="type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={typeOptions}
            placeholder="All Types"
          />
          <Select
            name="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            placeholder="All Status"
          />
        </FilterBar>

        <Table columns={columns} data={filteredAssistance} />

        <DataTableFooter
          showing={filteredAssistance.length}
          total={sampleAssistance.length}
          itemName="records"
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="ALAGA Assistance Request Form"
        footer={modalFooter}
        size="large"
      >
        <div className={styles.assistanceForm}>
          {/* Requester Information */}
          <section className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Requester Information</h4>
            <div className={styles.formGrid}>
              <Input
                label="Requester Name"
                name="requesterName"
                value={formData.requesterName}
                onChange={handleChange}
                placeholder="Enter full name"
                required
              />
              <Input
                label="Contact Number"
                name="requesterContact"
                value={formData.requesterContact}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
                maxLength={11}
              />
              <div className={styles.fullWidth}>
                <Input
                  label="Address"
                  name="requesterAddress"
                  value={formData.requesterAddress}
                  onChange={handleChange}
                  placeholder="Complete address"
                />
              </div>
            </div>
          </section>

          {/* Type of Social Service */}
          <section className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Type of Social Service</h4>
            <div className={styles.serviceTypeGrid}>
              {serviceTypes.map((service) => (
                <label key={service.value} className={styles.radioCard}>
                  <input
                    type="radio"
                    name="serviceType"
                    value={service.value}
                    checked={formData.serviceType === service.value}
                    onChange={() => handleServiceTypeChange(service.value)}
                  />
                  <span className={styles.radioCardContent}>
                    <span className={styles.radioMark}></span>
                    <span className={styles.radioLabel}>{service.label}</span>
                    <span className={styles.radioCeiling}>Budget: {service.ceiling}</span>
                  </span>
                </label>
              ))}
            </div>
            {formData.serviceType === 'others' && (
              <div className={styles.otherInput}>
                <Input
                  label="Please specify"
                  name="otherService"
                  value={formData.otherService}
                  onChange={handleChange}
                  placeholder="Describe the type of assistance needed"
                />
              </div>
            )}
          </section>

          {/* Beneficiary Information */}
          <section className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Beneficiary Information</h4>
            <div className={styles.formGrid}>
              <Input
                label="Beneficiary Name"
                name="beneficiaryName"
                value={formData.beneficiaryName}
                onChange={handleChange}
                placeholder="Enter full name"
                required
              />
              <Input
                label="Contact Number"
                name="beneficiaryContact"
                value={formData.beneficiaryContact}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
                maxLength={11}
              />
              <div className={styles.fullWidth}>
                <Input
                  label="Address"
                  name="beneficiaryAddress"
                  value={formData.beneficiaryAddress}
                  onChange={handleChange}
                  placeholder="Complete address"
                />
              </div>
            </div>
          </section>

          {/* Document Requirements */}
          <section className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Document Requirements</h4>
            <p className={styles.sectionHint}>Please ensure the applicant has the following documents</p>
            
            <div className={styles.documentsList}>
              <div className={styles.documentsCategory}>
                <h5 className={styles.categoryTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  General Requirements
                </h5>
                <ul className={styles.docList}>
                  <li>
                    <span className={styles.docCheck}>✓</span>
                    Valid ID (Government-issued)
                  </li>
                  <li>
                    <span className={styles.docCheck}>✓</span>
                    Barangay Certificate of Residency
                  </li>
                </ul>
              </div>

              {formData.serviceType === 'medicine' && (
                <div className={styles.documentsCategory}>
                  <h5 className={styles.categoryTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                    Medicine Assistance Requirements
                  </h5>
                  <ul className={styles.docList}>
                    <li>
                      <span className={styles.docCheck}>✓</span>
                      Doctor's Prescription
                    </li>
                    <li>
                      <span className={styles.docCheck}>✓</span>
                      Official Receipt from Pharmacy
                    </li>
                  </ul>
                </div>
              )}

              {formData.serviceType === 'confinement' && (
                <div className={styles.documentsCategory}>
                  <h5 className={styles.categoryTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    Confinement Assistance Requirements
                  </h5>
                  <ul className={styles.docList}>
                    <li>
                      <span className={styles.docCheck}>✓</span>
                      Certificate of Confinement / Medical Abstract
                    </li>
                    <li>
                      <span className={styles.docCheck}>✓</span>
                      Hospital Statement of Account / Official Receipt
                    </li>
                  </ul>
                </div>
              )}

              {formData.serviceType === 'burial' && (
                <div className={styles.documentsCategory}>
                  <h5 className={styles.categoryTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    Burial Assistance Requirements
                  </h5>
                  <ul className={styles.docList}>
                    <li>
                      <span className={styles.docCheck}>✓</span>
                      Death Certificate
                    </li>
                    <li>
                      <span className={styles.docCheck}>✓</span>
                      Funeral Contract / Official Receipt
                    </li>
                  </ul>
                </div>
              )}

              {formData.serviceType === 'others' && (
                <div className={styles.documentsCategory}>
                  <h5 className={styles.categoryTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    Other Assistance Requirements
                  </h5>
                  <ul className={styles.docList}>
                    <li>
                      <span className={styles.docCheck}>✓</span>
                      Supporting documents related to the request
                    </li>
                    <li>
                      <span className={styles.docCheck}>✓</span>
                      Official Receipt (if applicable)
                    </li>
                  </ul>
                </div>
              )}

              {!formData.serviceType && (
                <div className={styles.selectServiceHint}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  Select a service type above to see specific document requirements
                </div>
              )}
            </div>
          </section>

          {/* Acknowledgement Section */}
          <section className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Acknowledgement</h4>
            <div className={styles.acknowledgementBox}>
              <div className={styles.ackRow}>
                <div className={styles.ackLabel}>Type of Assistance:</div>
                <div className={styles.ackValue}>
                  {serviceTypes.find(s => s.value === formData.serviceType)?.label || '—'}
                </div>
              </div>
              <div className={styles.ackRow}>
                <div className={styles.ackLabel}>Amount:</div>
                <div className={styles.ackValue}>
                  <Input
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="₱0.00"
                    className={styles.amountInput}
                  />
                </div>
              </div>
              <div className={styles.ackRow}>
                <div className={styles.ackLabel}>Date:</div>
                <div className={styles.ackValue}>{formData.date}</div>
              </div>
              <div className={styles.ackRow}>
                <div className={styles.ackLabel}>Processed by:</div>
                <div className={styles.ackValue}>
                  <Input
                    name="approverName"
                    value={formData.approverName}
                    onChange={handleChange}
                    placeholder="Enter approver/encoder name"
                    className={styles.approverInput}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
