'use client';

import { useState, useEffect } from 'react';
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
import { supabase } from '@/lib/supabaseClient';
import {
  buildRequirementsMap,
  getLocalRequirementsMap,
  getRequirementsForType,
  isMissingRequirementsColumn,
} from '@/lib/assistanceRequirements';
import { getCooldownInfo, parseDateInput } from '@/lib/requestCooldown';

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'Medicine Assistance', label: 'Medicine Assistance' },
  { value: 'Confinement Assistance', label: 'Confinement Assistance' },
  { value: 'Burial Assistance', label: 'Burial Assistance' },
  { value: 'Others', label: 'Others' },
];

const sectorOptions = [
  { value: '', label: 'All Sectors' },
  { value: 'PWD', label: 'PWD' },
  { value: 'Senior Citizen', label: 'Senior Citizen' },
  { value: 'Solo Parent', label: 'Solo Parent' },
];



const serviceTypes = [
  { value: 'medicine', label: 'Medicine Assistance', ceiling: '₱500' },
  { value: 'confinement', label: 'Confinement Assistance', ceiling: '₱1,000' },
  { value: 'burial', label: 'Burial Assistance', ceiling: '₱1,000' },
  { value: 'others', label: 'Others', ceiling: 'Variable' },
];

const generateControlNumber = () => {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 999) + 1;
  return `${year}-${String(seq).padStart(3, '0')}`;
};

export default function AssistancePage() {
const statusOptions = [{ value: 'Released', label: 'Released' }];

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Released');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [requirementsByType, setRequirementsByType] = useState({});
  
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

  useEffect(() => {
    const loadAssistance = async () => {
      try {
        if (!supabase) {
          throw new Error('Database client not available');
        }
        const { data, error } = await supabase
          .from('assistance_requests')
          .select(
            'id, control_number, resident_id, requester_name, beneficiary_name, assistance_type, amount, status, request_date, created_at',
          )
          .eq('status', 'Released')
          .order('request_date', { ascending: false });

        if (error) throw error;

        const rows = Array.isArray(data) ? data : [];
        const residentIds = Array.from(
          new Set(rows.map((row) => row?.resident_id).filter(Boolean)),
        );

        let residentSectorsById = new Map();
        if (residentIds.length > 0) {
          const { data: residentRows, error: residentsError } = await supabase
            .from('residents')
            .select('id, is_pwd, is_senior_citizen, is_solo_parent')
            .in('id', residentIds);

          if (!residentsError && Array.isArray(residentRows)) {
            residentSectorsById = new Map(
              residentRows.map((resident) => {
                const sectors = [
                  resident?.is_pwd ? 'PWD' : null,
                  resident?.is_senior_citizen ? 'Senior Citizen' : null,
                  resident?.is_solo_parent ? 'Solo Parent' : null,
                ].filter(Boolean);
                return [resident.id, sectors];
              }),
            );
          }
        }

        const latestByResident = new Map();

        rows.forEach((row) => {
          const residentId = row?.resident_id;
          if (!residentId) return;
          const candidate = parseDateInput(row?.request_date || row?.created_at);
          if (!candidate) return;
          const existing = latestByResident.get(residentId);
          if (!existing || candidate > existing) {
            latestByResident.set(residentId, candidate);
          }
        });

        const mapped = rows.map((r) => ({
          id: r.id,
          controlNo: r.control_number,
          requester: r.requester_name,
          beneficiary: r.beneficiary_name,
          type: r.assistance_type,
          amount: r.amount,
          status: r.status || 'Released',
          date: r.request_date ? new Date(r.request_date).toLocaleDateString() : '',
          cooldownInfo: getCooldownInfo(latestByResident.get(r.resident_id) || null),
          sectors: residentSectorsById.get(r.resident_id) || [],
        }));

        setRecords(mapped);
      } catch (err) {
        console.error('Failed to load assistance records:', err);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    loadAssistance();
  }, []);

  useEffect(() => {
    const loadRequirements = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('assistance_budgets')
          .select('assistance_type, requirements');

        if (error) {
          if (isMissingRequirementsColumn(error)) {
            setRequirementsByType(getLocalRequirementsMap());
            return;
          }
          console.warn('Error loading assistance requirements', error.message);
          setRequirementsByType(getLocalRequirementsMap());
          return;
        }
        setRequirementsByType(buildRequirementsMap(data || []));
      } catch (err) {
        console.warn('Unexpected error loading assistance requirements', err);
        setRequirementsByType(getLocalRequirementsMap());
      }
    };

    loadRequirements();
  }, []);

  const serviceTypeToAssistance = {
    medicine: 'Medicine Assistance',
    confinement: 'Confinement Assistance',
    burial: 'Burial Assistance',
    others: 'Others',
  };

  const getRequirementsForServiceType = (serviceType) => {
    const assistanceType = serviceTypeToAssistance[serviceType];
    return getRequirementsForType(assistanceType, requirementsByType);
  };

  // Filter assistance records
  const filteredAssistance = records.filter((record) => {
    const matchesSearch = 
      record.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.beneficiary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.controlNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || record.type === typeFilter;
    const matchesSector = !sectorFilter || (record.sectors || []).includes(sectorFilter);
    const matchesStatus = !statusFilter || record.status === statusFilter;
    return matchesSearch && matchesType && matchesSector && matchesStatus;
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

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
    if (errors.serviceType) {
      setErrors(prev => ({ ...prev, serviceType: '' }));
    }
    setFormData(prev => ({ ...prev, serviceType: type }));
  };

  const validateAssistanceForm = () => {
    const newErrors = {};

    if (!formData.requesterName.trim()) newErrors.requesterName = 'Requester name is required';
    if (!formData.requesterContact.trim()) {
      newErrors.requesterContact = 'Contact number is required';
    } else if (formData.requesterContact.length !== 11) {
      newErrors.requesterContact = 'Contact number must be exactly 11 digits';
    }
    if (!formData.requesterAddress.trim()) newErrors.requesterAddress = 'Address is required';
    if (!formData.serviceType) newErrors.serviceType = 'Please select a service type';
    if (formData.serviceType === 'others' && !formData.otherService.trim()) {
      newErrors.otherService = 'Please specify the type of assistance';
    }
    if (!formData.beneficiaryName.trim()) newErrors.beneficiaryName = 'Beneficiary name is required';
    if (!formData.beneficiaryAddress.trim()) newErrors.beneficiaryAddress = 'Beneficiary address is required';
    if (formData.beneficiaryContact && formData.beneficiaryContact.length !== 11) {
      newErrors.beneficiaryContact = 'Contact number must be exactly 11 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
    if (!validateAssistanceForm()) {
      return;
    }

    setStatus(null);
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
      setStatus({
        type: 'success',
        message: 'Assistance request submitted successfully.',
      });
    } catch (error) {
      console.error('Error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to submit assistance request. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      Pending: 'warning',
      Approved: 'primary',
      Released: 'success',
      Rejected: 'danger',
    };
    const label = status === 'Rejected' ? 'Incomplete' : status;
    return <Badge variant={variants[status]}>{label}</Badge>;
  };

  const getEligibilityBadge = (info) => {
    if (!info) return <Badge variant="secondary">—</Badge>;
    const variant =
      info.status === 'Eligible'
        ? 'success'
        : info.status === 'Almost Eligible'
          ? 'warning'
          : 'danger';
    const daysSuffix = info.isEligible
      ? ''
      : ` • ${info.daysRemaining} day${info.daysRemaining === 1 ? '' : 's'}`;
    const dateSuffix = info.nextEligibleDate
      ? ` • ${new Date(info.nextEligibleDate).toLocaleDateString()}`
      : '';

    // Show both days remaining (if any) and the specific date when eligibility occurs
    const content = `${info.status}${daysSuffix}${dateSuffix}`;
    return <Badge variant={variant}>{content}</Badge>;
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
    {
      key: 'eligibility',
      label: 'Eligibility',
      render: (_, row) => getEligibilityBadge(row.cooldownInfo),
    },
    { key: 'amount', label: 'Amount' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => getStatusBadge(status),
    },
  ];

  const modalFooter = (
    <>
      <Button variant="secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>Cancel</Button>
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
          <Link href="/admin/assistance/guidelines" className={styles.guidelinesLink}>
            <Button variant="secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Guidelines
            </Button>
          </Link>
          {/* <Button onClick={() => setShowModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Request
          </Button> */}
        </PageHeader>

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
            name="sector"
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            options={sectorOptions}
            placeholder="All Sectors"
          />
        </FilterBar>

        {/* Desktop Table View */}
        <div className={styles.tableView}>
          {loading ? (
            <div className={styles.emptyCard}>Loading records...</div>
          ) : (
            <Table columns={columns} data={filteredAssistance} />
          )}
        </div>

        {/* Mobile Card View */}
        <div className={styles.mobileCardView}>
          {loading ? (
            <div className={styles.emptyCard}>Loading records...</div>
          ) : filteredAssistance.length === 0 ? (
            <div className={styles.emptyCard}>No records found</div>
          ) : (
            filteredAssistance.map((record) => (
              <div key={record.id} className={styles.recordCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.controlNo}>{record.controlNo}</span>
                  {getStatusBadge(record.status)}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Requester</span>
                    <span className={styles.cardValue}>{record.requester}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Beneficiary</span>
                    <span className={styles.cardValue}>{record.beneficiary}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Type</span>
                    <Badge>{record.type}</Badge>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Amount</span>
                    <span className={styles.cardValue}>{record.amount}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Date</span>
                    <span className={styles.cardValue}>{record.date}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Eligibility</span>
                    <span className={styles.cardValue}>
                      {getEligibilityBadge(record.cooldownInfo)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DataTableFooter
          showing={filteredAssistance.length}
          total={records.length}
          itemName="records"
        />
      </Card>

      {/* <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="ALAGA Assistance Request Form"
        footer={modalFooter}
        size="large"
      >
        <div className={styles.assistanceForm}>
          
          <section className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Requester Information</h4>
            <div className={styles.formGrid}>
              <Input
                label="Requester Name"
                name="requesterName"
                value={formData.requesterName}
                onChange={handleChange}
                placeholder="Enter full name"
                error={errors.requesterName}
                required
              />
              <Input
                label="Contact Number"
                type="tel"
                name="requesterContact"
                value={formData.requesterContact}
                onChange={handleChange}
                placeholder="+63 XXX XXX XXXX"
                mask="ph-contact"
                error={errors.requesterContact}
                required
              />
              <div className={styles.fullWidth}>
                <Input
                  label="Address"
                  name="requesterAddress"
                  value={formData.requesterAddress}
                  onChange={handleChange}
                  placeholder="Complete address"
                  error={errors.requesterAddress}
                  required
                />
              </div>
            </div>
          </section>

          
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
            {errors.serviceType && <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 500, marginTop: '8px', display: 'block' }}>{errors.serviceType}</span>}
            {formData.serviceType === 'others' && (
              <div className={styles.otherInput}>
                <Input
                  label="Please specify"
                  name="otherService"
                  value={formData.otherService}
                  onChange={handleChange}
                  placeholder="Describe the type of assistance needed"
                  error={errors.otherService}
                />
              </div>
            )}
          </section>

          
          <section className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Beneficiary Information</h4>
            <div className={styles.formGrid}>
              <Input
                label="Beneficiary Name"
                name="beneficiaryName"
                value={formData.beneficiaryName}
                onChange={handleChange}
                placeholder="Enter full name"
                error={errors.beneficiaryName}
                required
              />
              <Input
                label="Contact Number"
                type="tel"
                name="beneficiaryContact"
                value={formData.beneficiaryContact}
                onChange={handleChange}
                placeholder="+63 XXX XXX XXXX"
                mask="ph-contact"
                error={errors.beneficiaryContact}
                optional
              />
              <div className={styles.fullWidth}>
                <Input
                  label="Address"
                  name="beneficiaryAddress"
                  value={formData.beneficiaryAddress}
                  onChange={handleChange}
                  placeholder="Complete address"
                  error={errors.beneficiaryAddress}
                  required
                />
              </div>
            </div>
          </section>

          
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
                    ATTACH REQUIREMENTS (Government-issued ID)
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
                    {getRequirementsForServiceType('medicine').length ? (
                      getRequirementsForServiceType('medicine').map((req, idx) => (
                        <li key={idx}>
                          <span className={styles.docCheck}>✓</span>
                          {req}
                        </li>
                      ))
                    ) : (
                      <li className={styles.emptyRequirement}>No requirements set.</li>
                    )}
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
                    {getRequirementsForServiceType('confinement').length ? (
                      getRequirementsForServiceType('confinement').map((req, idx) => (
                        <li key={idx}>
                          <span className={styles.docCheck}>✓</span>
                          {req}
                        </li>
                      ))
                    ) : (
                      <li className={styles.emptyRequirement}>No requirements set.</li>
                    )}
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
                    {getRequirementsForServiceType('burial').length ? (
                      getRequirementsForServiceType('burial').map((req, idx) => (
                        <li key={idx}>
                          <span className={styles.docCheck}>✓</span>
                          {req}
                        </li>
                      ))
                    ) : (
                      <li className={styles.emptyRequirement}>No requirements set.</li>
                    )}
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
                    {getRequirementsForServiceType('others').length ? (
                      getRequirementsForServiceType('others').map((req, idx) => (
                        <li key={idx}>
                          <span className={styles.docCheck}>✓</span>
                          {req}
                        </li>
                      ))
                    ) : (
                      <li className={styles.emptyRequirement}>No requirements set.</li>
                    )}
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
      </Modal> */}
    </div>
  );
}
