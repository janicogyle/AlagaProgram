'use client';

import { useState, useEffect } from 'react';
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

const roleOptions = [
  { value: '', label: 'All Roles' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Staff', label: 'Staff' },
];

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    contactNumber: '',
    role: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const result = await response.json();
      
      if (result.error) {
        console.error('Error fetching users:', result.error);
        setUsers([]);
      } else {
        setUsers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    setForm({
      fullName: '',
      email: '',
      contactNumber: '',
      role: '',
      password: '',
    });
  };

  const handleCreateUser = async () => {
    const newErrors = {};
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!form.role) newErrors.role = 'Role is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    if (!form.password || form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          contactNumber: form.contactNumber.trim() || null,
          role: form.role,
          password: form.password,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to create user');
      }

      alert('✅ User created successfully!');
      handleCloseModal();
      fetchUsers(); // Refresh list
    } catch (error) {
      alert('❌ Failed to create user: ' + (error.message || 'Unknown error'));
      console.error('Create user error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (user) => {
    const newPassword = prompt(`Enter new password for ${user.full_name}:\n\n(Minimum 6 characters)`);
    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert('❌ Password must be at least 6 characters');
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to reset password');
      }

      alert('✅ Password reset successfully!');
    } catch (error) {
      alert('❌ Failed to reset password: ' + (error.message || 'Unknown error'));
      console.error('Reset password error:', error);
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    const action = newStatus === 'Inactive' ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} ${user.full_name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to update status');
      }

      alert(`✅ User ${action}d successfully!`);
      fetchUsers();
    } catch (error) {
      alert('❌ Failed to update status: ' + (error.message || 'Unknown error'));
      console.error('Toggle status error:', error);
    }
  };

  const getUserActions = (user) => [
    { label: 'View Details', onClick: () => console.log('View', user.id) },
    { label: 'Edit', onClick: () => console.log('Edit', user.id) },
    { label: 'Reset Password', onClick: () => handleResetPassword(user) },
    { type: 'divider' },
    { 
      label: user.status === 'Active' ? 'Deactivate' : 'Activate', 
      onClick: () => handleToggleStatus(user), 
      variant: user.status === 'Active' ? 'danger' : 'success' 
    },
  ];

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (_, row) => (
        <div className={styles.userCell}>
          <div className={styles.avatar}>{row.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{row.full_name}</span>
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
    { 
      key: 'last_login', 
      label: 'Last Login',
      render: (lastLogin) => lastLogin ? new Date(lastLogin).toLocaleString() : 'Never'
    },
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
      <Button variant="secondary" onClick={handleCloseModal} disabled={submitting}>Cancel</Button>
      <Button onClick={handleCreateUser} disabled={submitting}>
        {submitting ? 'Creating...' : 'Create User'}
      </Button>
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

        {loading && <p style={{ padding: '20px', textAlign: 'center' }}>Loading users...</p>}
        {!loading && filteredUsers.length === 0 && <p style={{ padding: '20px', textAlign: 'center' }}>No users found. Click "Add User" to create one.</p>}

        <DataTableFooter
          showing={filteredUsers.length}
          total={users.length}
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

          <Input
            label="Initial Password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleFieldChange}
            placeholder="At least 6 characters"
            required
            error={errors.password}
          />

          <p className={styles.formHelperText}>
            After saving, you can manage this user&#39;s permissions and reset their password from this page.
          </p>
        </div>
      </Modal>
    </div>
  );
}
