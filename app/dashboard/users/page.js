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
  ActionMenu,
} from '@/components';
import styles from './page.module.css';

// Sample data - Replace with actual data from Supabase
const sampleUsers = [
  { id: 1, name: 'Admin User', email: 'admin@barangaystarita.gov.ph', role: 'Admin', lastLogin: '2024-02-15 09:30:00', status: 'Active' },
  { id: 2, name: 'Barangay Secretary', email: 'secretary@barangaystarita.gov.ph', role: 'Staff', lastLogin: '2024-02-14 14:20:00', status: 'Active' },
  { id: 3, name: 'PWD Desk Officer', email: 'pwd@barangaystarita.gov.ph', role: 'Staff', lastLogin: '2024-02-13 10:15:00', status: 'Active' },
  { id: 4, name: 'OSCA Officer', email: 'osca@barangaystarita.gov.ph', role: 'Staff', lastLogin: '2024-01-30 08:45:00', status: 'Inactive' },
];

const roleOptions = [
  { value: '', label: 'All Roles' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Staff', label: 'Staff' },
];

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Filter users
  const filteredUsers = sampleUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getUserActions = (user) => [
    { label: 'View Details', onClick: () => console.log('View', user.id) },
    { label: 'Edit', onClick: () => console.log('Edit', user.id) },
    { label: 'Reset Password', onClick: () => console.log('Reset Password', user.id) },
    { type: 'divider' },
    { 
      label: user.status === 'Active' ? 'Deactivate' : 'Activate', 
      onClick: () => console.log('Toggle status', user.id), 
      variant: user.status === 'Active' ? 'danger' : 'success' 
    },
  ];

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (_, row) => (
        <div className={styles.userCell}>
          <div className={styles.avatar}>{row.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{row.name}</span>
            <span className={styles.userEmail}>{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (role) => <Badge variant={role === 'Admin' ? 'primary' : 'secondary'}>{role}</Badge>,
    },
    { key: 'lastLogin', label: 'Last Login' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <Badge variant={status === 'Active' ? 'success' : 'danger'}>{status}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => <ActionMenu actions={getUserActions(row)} />,
    },
  ];

  const modalFooter = (
    <>
      <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
      <Button>Create User</Button>
    </>
  );

  return (
    <div className={styles.usersPage}>
      <Card padding={false}>
        <PageHeader
          title="System Users"
          subtitle="Manage user accounts and access permissions"
        >
          <Button onClick={() => setShowModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add User
          </Button>
        </PageHeader>

        <FilterBar>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name or email..."
          />
          <Select
            name="role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={roleOptions}
            placeholder="All Roles"
          />
        </FilterBar>

        <Table columns={columns} data={filteredUsers} />

        <DataTableFooter
          showing={filteredUsers.length}
          total={sampleUsers.length}
          itemName="users"
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New User"
        footer={modalFooter}
      >
        <p className={styles.placeholder}>
          Form fields will be added here for creating new user accounts.
        </p>
      </Modal>
    </div>
  );
}
