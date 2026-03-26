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
  Input,
} from '@/components';
import styles from './page.module.css';

// TODO: Fetch from Supabase
// Expected shape: [{ id, name, email, role, status, lastLogin }]
const sampleUsers = [];

const roleOptions = [
  { value: '', label: 'All Roles' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Staff', label: 'Staff' },
];

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    contactNumber: '',
    role: '',
  });
  const [errors, setErrors] = useState({});

  // Filter users
  const filteredUsers = sampleUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    if (name === 'contactNumber') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 11);
      setForm((prev) => ({ ...prev, contactNumber: digitsOnly }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleRoleChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, role: value }));
    setErrors((prev) => ({ ...prev, role: '' }));
  };

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setErrors({});
  };

  // TODO: Replace with Supabase insert + auth user creation
  const handleCreateUser = () => {
    const newErrors = {};
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!form.role) newErrors.role = 'Role is required';

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      name: form.fullName.trim(),
      email: form.email.trim(),
      contactNumber: form.contactNumber.trim() || null,
      role: form.role,
    };

    console.log('Create system user payload', payload);

    // Reset and close
    setForm({ fullName: '', email: '', contactNumber: '', role: '' });
    setErrors({});
    setShowModal(false);
  };

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
      <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
      <Button onClick={handleCreateUser}>Create User</Button>
    </>
  );

  return (
    <div className={styles.usersPage}>
      <Card padding={false}>
        <PageHeader
          title="System Users"
          subtitle="Manage user accounts and access permissions"
        >
          <Button onClick={handleOpenModal}>
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
        onClose={handleCloseModal}
        title="Add New User"
        footer={modalFooter}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <Input
              label="Full Name"
              name="fullName"
              value={form.fullName}
              onChange={handleFieldChange}
              placeholder="e.g. Juan Dela Cruz"
              required
              error={errors.fullName}
            />
            <Input
              label="Email Address"
              type="email"
              name="email"
              value={form.email}
              onChange={handleFieldChange}
              placeholder="e.g. juan@example.com"
              required
              error={errors.email}
            />
          </div>

          <div className={styles.formGrid}>
            <Input
              label="Contact Number"
              name="contactNumber"
              value={form.contactNumber}
              onChange={handleFieldChange}
              placeholder="e.g. 0917 123 4567"
            />
            <Select
              label="Role"
              name="role"
              value={form.role}
              onChange={handleRoleChange}
              options={roleOptions}
              placeholder="Select role"
              required
              error={errors.role}
            />
          </div>

          <p className={styles.formHelperText}>
            After saving, you can manage this user&#39;s permissions and reset their password from this page.
          </p>
        </div>
      </Modal>
    </div>
  );
}
