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
} from '@/components';
import styles from './page.module.css';

// Sample data - Replace with actual data from Supabase
const sampleResidents = [
  { id: 1, name: 'Maria Santos Cruz', sector: ['Senior Citizen'], purok: 'Purok 1', age: 70, status: 'Active' },
  { id: 2, name: 'Juan Dela Cruz', sector: ['PWD'], purok: 'Purok 2', age: 45, status: 'Active' },
  { id: 3, name: 'Ana Reyes Garcia', sector: ['Solo Parent'], purok: 'Purok 3', age: 35, status: 'Active' },
  { id: 4, name: 'Rosa Mendoza Tan', sector: ['Senior Citizen', 'PWD'], purok: 'Purok 2', age: 77, status: 'Active' },
  { id: 5, name: 'Carlos Ramos Villanueva', sector: ['Senior Citizen'], purok: 'Purok 4', age: 65, status: 'Inactive' },
  { id: 6, name: 'Elena Bautista Lopez', sector: ['Solo Parent', 'PWD'], purok: 'Purok 3', age: 40, status: 'Active' },
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

  // Filter residents based on search and filters
  const filteredResidents = sampleResidents.filter((resident) => {
    const matchesSearch = resident.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = !sectorFilter || resident.sector.includes(sectorFilter);
    const matchesPurok = !purokFilter || resident.purok === purokFilter;
    return matchesSearch && matchesSector && matchesPurok;
  });

  const getResidentActions = (resident) => [
    { label: 'View Details', onClick: () => console.log('View', resident.id) },
    { label: 'Edit', onClick: () => console.log('Edit', resident.id) },
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

  return (
    <div className={styles.residentsPage}>
      <Card padding={false}>
        <PageHeader title="All Residents">
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

        <Table columns={columns} data={filteredResidents} />

        <DataTableFooter
          showing={filteredResidents.length}
          total={sampleResidents.length}
          itemName="residents"
        />
      </Card>
    </div>
  );
}
