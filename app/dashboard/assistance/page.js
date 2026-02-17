'use client';

import { useState } from 'react';
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
  Modal,
} from '@/components';
import styles from './page.module.css';

// Sample data - Replace with actual data from Supabase
const sampleAssistance = [
  { id: 1, resident: 'Maria Santos Cruz', type: 'Cash', date: '2024-01-20', notes: 'Monthly senior citizen allowance', amount: '₱500' },
  { id: 2, resident: 'Juan Dela Cruz', type: 'Medical', date: '2024-01-25', notes: 'Medicine assistance for maintenance medi...', amount: '-' },
  { id: 3, resident: 'Ana Reyes Garcia', type: 'Relief Goods', date: '2024-02-01', notes: 'Food pack distribution', amount: '-' },
  { id: 4, resident: 'Rosa Mendoza Tan', type: 'Cash', date: '2024-02-05', notes: 'PWD monthly allowance', amount: '₱1,000' },
  { id: 5, resident: 'Pedro Lim Torres', type: 'Educational', date: '2024-02-10', notes: 'School supplies assistance', amount: '-' },
];

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Medical', label: 'Medical' },
  { value: 'Relief Goods', label: 'Relief Goods' },
  { value: 'Educational', label: 'Educational' },
];

export default function AssistancePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Filter assistance records
  const filteredAssistance = sampleAssistance.filter((record) => {
    const matchesSearch = record.resident.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || record.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const columns = [
    { key: 'resident', label: 'Resident' },
    {
      key: 'type',
      label: 'Type',
      render: (type) => <Badge>{type}</Badge>,
    },
    { key: 'date', label: 'Date' },
    { key: 'notes', label: 'Notes' },
    { key: 'amount', label: 'Amount' },
  ];

  const modalFooter = (
    <>
      <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
      <Button>Save Assistance</Button>
    </>
  );

  return (
    <div className={styles.assistancePage}>
      <Card padding={false}>
        <PageHeader
          title="Assistance Records"
          subtitle="Track and manage assistance provided to residents"
        >
          <Button onClick={() => setShowModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Assistance
          </Button>
        </PageHeader>

        <FilterBar>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by resident name..."
          />
          <Select
            name="type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={typeOptions}
            placeholder="All Types"
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
        title="Add New Assistance"
        footer={modalFooter}
      >
        <p className={styles.placeholder}>
          Form fields will be added here for creating new assistance records.
        </p>
      </Modal>
    </div>
  );
}
