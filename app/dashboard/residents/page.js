'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  Select,
  Table,
  Badge,
  Button,
  PageHeader,
  SearchInput,
  FilterBar,
  DataTableFooter,
  ActionMenu,
  Modal,
} from '@/components';
import styles from './page.module.css';

// Sample data - Replace with actual data from Supabase
const sampleResidents = [
  { id: 1, name: 'Maria Santos Cruz', sector: ['Senior Citizen'], purok: 'Purok 1', age: 70, status: 'Active', controlNo: 'ALAGA-2024-00001' },
  { id: 2, name: 'Juan Dela Cruz', sector: ['PWD'], purok: 'Purok 2', age: 45, status: 'Active', controlNo: 'ALAGA-2024-00002' },
  { id: 3, name: 'Ana Reyes Garcia', sector: ['Solo Parent'], purok: 'Purok 3', age: 35, status: 'Active', controlNo: 'ALAGA-2024-00003' },
  { id: 4, name: 'Rosa Mendoza Tan', sector: ['Senior Citizen', 'PWD'], purok: 'Purok 2', age: 77, status: 'Active', controlNo: 'ALAGA-2024-00004' },
  { id: 5, name: 'Carlos Ramos Villanueva', sector: ['Senior Citizen'], purok: 'Purok 4', age: 65, status: 'Inactive', controlNo: 'ALAGA-2024-00005' },
  { id: 6, name: 'Elena Bautista Lopez', sector: ['Solo Parent', 'PWD'], purok: 'Purok 3', age: 40, status: 'Active', controlNo: 'ALAGA-2024-00006' },
];

const sectorOptions = [
  { value: '', label: 'All Sectors' },
  { value: 'PWD', label: 'PWD' },
  { value: 'Senior Citizen', label: 'Senior Citizen' },
  { value: 'Solo Parent', label: 'Solo Parent' },
];

const purokOptions = [
  { value: '', label: 'All Purok' },
  { value: 'Purok 1', label: 'Purok 1' },
  { value: 'Purok 2', label: 'Purok 2' },
  { value: 'Purok 3', label: 'Purok 3' },
  { value: 'Purok 4', label: 'Purok 4' },
  { value: 'Purok 5', label: 'Purok 5' },
];

export default function ResidentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [purokFilter, setPurokFilter] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);

  // Filter residents based on search and filters
  const filteredResidents = sampleResidents.filter((resident) => {
    const matchesSearch = resident.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = !sectorFilter || resident.sector.includes(sectorFilter);
    const matchesPurok = !purokFilter || resident.purok === purokFilter;
    return matchesSearch && matchesSector && matchesPurok;
  });

  const handleGenerateQR = (resident) => {
    setSelectedResident(resident);
    setShowQRModal(true);
  };

  const handleDownloadQR = () => {
    // TODO: Implement actual QR download
    alert('QR Code download will be implemented with backend integration.');
  };

  const getResidentActions = (resident) => [
    { label: 'View Details', onClick: () => console.log('View', resident.id) },
    { label: 'Edit', onClick: () => console.log('Edit', resident.id) },
    { type: 'divider' },
    { label: 'Generate QR ID', onClick: () => handleGenerateQR(resident) },
    { label: 'Print ID', onClick: () => console.log('Print ID', resident.id) },
    { type: 'divider' },
    { label: 'Deactivate', onClick: () => console.log('Deactivate', resident.id), variant: 'danger' },
  ];

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'sector',
      label: 'Sector',
      render: (sectors) => (
        <div className={styles.badges}>
          {sectors.map((s, i) => (
            <Badge key={i}>{s}</Badge>
          ))}
        </div>
      ),
    },
    { key: 'purok', label: 'Purok' },
    { key: 'age', label: 'Age' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <Badge variant={status === 'Active' ? 'success' : 'danger'}>{status}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => <ActionMenu actions={getResidentActions(row)} />,
    },
  ];

  const qrModalFooter = (
    <>
      <Button variant="secondary" onClick={() => setShowQRModal(false)}>Close</Button>
      <Button onClick={handleDownloadQR}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download QR
      </Button>
    </>
  );

  return (
    <div className={styles.residentsPage}>
      <Card padding={false}>
        <PageHeader title=" Alaga Program List">
          <Link href="/dashboard/registration">
            <Button>Add New Resident</Button>
          </Link>
        </PageHeader>

        <FilterBar>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name..."
          />
          <div className={styles.filterGroup}>
            <Select
              name="sector"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              options={sectorOptions}
              placeholder="All Sectors"
            />
            <Select
              name="purok"
              value={purokFilter}
              onChange={(e) => setPurokFilter(e.target.value)}
              options={purokOptions}
              placeholder="All Purok"
            />
          </div>
        </FilterBar>

        {/* Desktop Table View */}
        <div className={styles.tableView}>
          <Table columns={columns} data={filteredResidents} />
        </div>

        {/* Mobile Card View */}
        <div className={styles.mobileCardView}>
          {filteredResidents.length === 0 ? (
            <div className={styles.emptyCard}>No residents found</div>
          ) : (
            filteredResidents.map((resident) => (
              <div key={resident.id} className={styles.residentCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardNameSection}>
                    <span className={styles.cardName}>{resident.name}</span>
                    <Badge variant={resident.status === 'Active' ? 'success' : 'danger'}>{resident.status}</Badge>
                  </div>
                  <ActionMenu actions={getResidentActions(resident)} />
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardBadges}>
                    {resident.sector.map((s, i) => (
                      <Badge key={i}>{s}</Badge>
                    ))}
                  </div>
                  <div className={styles.cardDetails}>
                    <div className={styles.cardDetail}>
                      <span className={styles.detailLabel}>Purok</span>
                      <span className={styles.detailValue}>{resident.purok}</span>
                    </div>
                    <div className={styles.cardDetail}>
                      <span className={styles.detailLabel}>Age</span>
                      <span className={styles.detailValue}>{resident.age}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DataTableFooter
          showing={filteredResidents.length}
          total={sampleResidents.length}
          itemName="residents"
        />
      </Card>

      {/* QR ID Modal */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="Generate QR ID"
        footer={qrModalFooter}
        size="small"
      >
        {selectedResident && (
          <div className={styles.qrModalContent}>
            <div className={styles.residentInfo}>
              <h4 className={styles.residentName}>{selectedResident.name}</h4>
              <p className={styles.controlNumber}>{selectedResident.controlNo}</p>
              <div className={styles.residentBadges}>
                {selectedResident.sector.map((s, i) => (
                  <Badge key={i}>{s}</Badge>
                ))}
              </div>
            </div>
            
            <div className={styles.qrPreview}>
              <div className={styles.qrPlaceholder}>
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="4" height="4" />
                  <rect x="18" y="18" width="3" height="3" />
                  <rect x="14" y="18" width="3" height="3" />
                  <rect x="18" y="14" width="3" height="3" />
                </svg>
                <span className={styles.qrPlaceholderText}>QR Preview</span>
              </div>
              <p className={styles.qrHint}>
                QR Code will be generated upon backend integration
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
