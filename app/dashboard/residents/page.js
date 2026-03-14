'use client';

import { useState, useEffect } from 'react';
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
import { supabase } from '@/lib/supabaseClient';

export default function ResidentsPage() {
  const [residents, setResidents] = useState([]);
  const [allAssistance, setAllAssistance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [purokFilter, setPurokFilter] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAssistanceModal, setShowAssistanceModal] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);

  const fetchResidents = async () => {
    const { data } = await supabase
      .from('residents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!data) return;

    setResidents(
      data.map((r) => ({
        id: r.id,
        name: `${r.last_name}, ${r.first_name}${r.middle_name ? ' ' + r.middle_name : ''}`,
        firstName: r.first_name,
        lastName: r.last_name,
        sector: [
          r.is_pwd && 'PWD',
          r.is_senior_citizen && 'Senior Citizen',
          r.is_solo_parent && 'Solo Parent',
        ].filter(Boolean),
        purok: r.street,
        age: r.age ?? (r.birthday ? Math.floor((Date.now() - new Date(r.birthday)) / 31557600000) : '—'),
        sex: r.sex,
        contact: r.contact_number,
        status: r.status || 'Active',
        registeredAt: r.created_at,
        controlNo: r.control_number,
      }))
    );
  };

  const fetchAssistance = async () => {
    const { data } = await supabase
      .from('assistance_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAllAssistance(data);
  };

  useEffect(() => {
    fetchResidents();
    fetchAssistance();
    const resChannel = supabase
      .channel('residents-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, fetchResidents)
      .subscribe();
    const astChannel = supabase
      .channel('residents-assistance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assistance_requests' }, fetchAssistance)
      .subscribe();
    return () => {
      supabase.removeChannel(resChannel);
      supabase.removeChannel(astChannel);
    };
  }, []);

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

  // Filter residents based on search and filters
  const filteredResidents = residents.filter((resident) => {
    const matchesSearch = resident.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = !sectorFilter || resident.sector.includes(sectorFilter);
    const matchesPurok = !purokFilter || resident.purok === purokFilter;
    return matchesSearch && matchesSector && matchesPurok;
  });

  const handleGenerateQR = (resident) => {
    setSelectedResident(resident);
    setShowQRModal(true);
  };

  const handleViewAssistance = (resident) => {
    setSelectedResident(resident);
    setShowAssistanceModal(true);
  };

  const getResidentAssistance = (resident) => {
    const fullName = `${resident.firstName} ${resident.lastName}`.toLowerCase();
    return allAssistance
      .filter((r) => r.beneficiary_name?.toLowerCase().includes(fullName) ||
                     fullName.includes(r.beneficiary_name?.toLowerCase()))
      .map((r) => ({
        id: r.id,
        controlNo: r.control_number,
        type: r.service_type === 'others' ? (r.other_service || 'Others') :
              ({ medicine: 'Medicine Assistance', confinement: 'Confinement Assistance', burial: 'Burial Assistance' }[r.service_type] || r.service_type),
        amount: r.amount ? `₱${Number(r.amount).toLocaleString()}` : '—',
        date: r.date ? new Date(r.date).toLocaleDateString() : '—',
        status: r.status,
        remarks: r.remarks || '',
      }));
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'Released': return 'success';
      case 'Approved': return 'info';
      case 'Pending': return 'warning';
      case 'Rejected': return 'danger';
      default: return 'default';
    }
  };

  const handleDownloadQR = () => {
    // TODO: Implement actual QR download
    alert('QR Code download will be implemented with backend integration.');
  };

  const getResidentActions = (resident) => [
    { label: 'View Details', onClick: () => console.log('View', resident.id) },
    { label: 'View Assistance History', onClick: () => handleViewAssistance(resident) },
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
          total={residents.length}
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

      {/* Assistance History Modal */}
      <Modal
        isOpen={showAssistanceModal}
        onClose={() => setShowAssistanceModal(false)}
        title="Assistance History"
        footer={
          <Button variant="secondary" onClick={() => setShowAssistanceModal(false)}>Close</Button>
        }
        size="large"
      >
        {selectedResident && (
          <div className={styles.assistanceModalContent}>
            <div className={styles.assistanceResidentInfo}>
              <div className={styles.assistanceResidentHeader}>
                <div>
                  <h4 className={styles.assistanceResidentName}>{selectedResident.name}</h4>
                  <div className={styles.assistanceResidentMeta}>
                    {selectedResident.sector.map((s, i) => (
                      <Badge key={i}>{s}</Badge>
                    ))}
                    <span className={styles.assistanceResidentDetail}>{selectedResident.purok}</span>
                    <span className={styles.assistanceResidentDetail}>Age: {selectedResident.age}</span>
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              const records = getResidentAssistance(selectedResident);
              const totalAmount = records.reduce((sum, r) => {
                const num = parseFloat(r.amount.replace(/[^\d.]/g, ''));
                return sum + (isNaN(num) ? 0 : num);
              }, 0);

              return (
                <>
                  <div className={styles.assistanceSummaryRow}>
                    <div className={styles.assistanceSummaryStat}>
                      <span className={styles.assistanceSummaryValue}>{records.length}</span>
                      <span className={styles.assistanceSummaryLabel}>Total Records</span>
                    </div>
                    <div className={styles.assistanceSummaryStat}>
                      <span className={styles.assistanceSummaryValue}>₱{totalAmount.toLocaleString()}</span>
                      <span className={styles.assistanceSummaryLabel}>Total Amount</span>
                    </div>
                    <div className={styles.assistanceSummaryStat}>
                      <span className={styles.assistanceSummaryValue}>{records.filter(r => r.status === 'Released').length}</span>
                      <span className={styles.assistanceSummaryLabel}>Released</span>
                    </div>
                    <div className={styles.assistanceSummaryStat}>
                      <span className={styles.assistanceSummaryValue}>{records.filter(r => r.status === 'Pending').length}</span>
                      <span className={styles.assistanceSummaryLabel}>Pending</span>
                    </div>
                  </div>

                  {records.length === 0 ? (
                    <div className={styles.assistanceEmpty}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <p>No assistance records found for this resident.</p>
                    </div>
                  ) : (
                    <div className={styles.assistanceList}>
                      {records.map((record) => (
                        <div key={record.id} className={styles.assistanceCard}>
                          <div className={styles.assistanceCardHeader}>
                            <div className={styles.assistanceCardTitle}>
                              <span className={styles.assistanceType}>{record.type}</span>
                              <span className={styles.assistanceControlNo}>{record.controlNo}</span>
                            </div>
                            <Badge variant={getStatusVariant(record.status)}>{record.status}</Badge>
                          </div>
                          <div className={styles.assistanceCardBody}>
                            <div className={styles.assistanceDetail}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              <span>{record.date}</span>
                            </div>
                            <div className={styles.assistanceDetail}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                              </svg>
                              <span>{record.amount}</span>
                            </div>
                            {record.remarks && (
                              <div className={styles.assistanceRemarks}>
                                <span className={styles.remarksLabel}>Remarks:</span> {record.remarks}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
