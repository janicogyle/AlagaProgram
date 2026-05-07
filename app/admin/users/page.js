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
import { supabase } from '@/lib/supabaseClient';

const filterRoleOptions = [
  { value: '', label: 'All Roles' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Staff', label: 'Staff' },
];

const formRoleOptions = [
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

  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    busy: false,
    onConfirm: null,
  });
  const [resetPwState, setResetPwState] = useState({
    open: false,
    user: null,
    password: '',
    error: '',
    submitting: false,
  });
  const [verifyResetState, setVerifyResetState] = useState({
    open: false,
    user: null,
    adminPassword: '',
    error: '',
    submitting: false,
  });

  const [detailsState, setDetailsState] = useState({ open: false, user: null });
  const [editState, setEditState] = useState({
    open: false,
    user: null,
    fullName: '',
    email: '',
    contactNumber: '',
    role: 'Staff',
    errors: {},
    submitting: false,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAlert = ({ title, message }) => {
    setAlertState({ open: true, title, message });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  const closeConfirm = () => {
    setConfirmState((prev) => ({ ...prev, open: false, busy: false, onConfirm: null }));
  };

  const getAuthHeaders = async () => {
    if (!supabase) {
      throw new Error('Supabase client not initialized.');
    }

    const { data, error } = await supabase.auth.getSession();
    let session = data?.session;

    const isExpired = session?.expires_at ? session.expires_at * 1000 <= Date.now() + 5000 : false;
    if (!error && session && !isExpired) {
      return {
        Authorization: `Bearer ${session.access_token}`,
      };
    }

    // Session can be stale in memory; attempt refresh before failing.
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    session = refreshData?.session;
    if (refreshError || !session) {
      throw new Error('Not authenticated. Please log in again.');
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  };

  const fetchUsers = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/users', { headers });
      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to fetch users');
      }

      setUsers(result.data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
      openAlert({ title: 'Error', message: error.message || 'Failed to fetch users.' });
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
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
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

      openAlert({ title: 'Success', message: 'User created successfully!' });
      handleCloseModal();
      fetchUsers(); // Refresh list
    } catch (error) {
      openAlert({
        title: 'Create user failed',
        message: error.message || 'Unknown error',
      });
      console.error('Create user error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = (user) => {
    setDetailsState({ open: true, user });
  };

  const closeDetails = () => {
    setDetailsState({ open: false, user: null });
  };

  const openEdit = (user) => {
    setEditState({
      open: true,
      user,
      fullName: user.full_name || '',
      email: user.email || '',
      contactNumber: user.contact_number || '',
      role: user.role || 'Staff',
      errors: {},
      submitting: false,
    });
  };

  const closeEdit = () => {
    setEditState({
      open: false,
      user: null,
      fullName: '',
      email: '',
      contactNumber: '',
      role: 'Staff',
      errors: {},
      submitting: false,
    });
  };

  const handleEditFieldChange = (e) => {
    const { name, value } = e.target;

    if (name === 'contactNumber') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 11);
      setEditState((prev) => ({
        ...prev,
        contactNumber: digitsOnly,
        errors: { ...prev.errors, contactNumber: '' },
      }));
      return;
    }

    setEditState((prev) => ({
      ...prev,
      [name]: value,
      errors: { ...prev.errors, [name]: '' },
    }));
  };

  const handleEditRoleChange = (e) => {
    const value = e.target.value;
    setEditState((prev) => ({ ...prev, role: value, errors: { ...prev.errors, role: '' } }));
  };

  const submitEdit = async () => {
    const user = editState.user;
    if (!user) return;

    const nextErrors = {};
    if (!editState.fullName.trim()) nextErrors.fullName = 'Full name is required';
    if (!editState.role) nextErrors.role = 'Role is required';

    const email = editState.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) nextErrors.email = 'Email is required';
    else if (!emailRegex.test(email)) nextErrors.email = 'Invalid email format';

    if (Object.keys(nextErrors).length) {
      setEditState((prev) => ({ ...prev, errors: nextErrors }));
      return;
    }

    setEditState((prev) => ({ ...prev, submitting: true }));

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          full_name: editState.fullName.trim(),
          email,
          contact_number: editState.contactNumber.trim() || null,
          role: editState.role,
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to update user');
      }

      closeEdit();
      openAlert({ title: 'Success', message: 'User updated successfully!' });
      fetchUsers();
    } catch (error) {
      openAlert({ title: 'Update failed', message: error.message || 'Unknown error' });
      console.error('Update user error:', error);
    } finally {
      setEditState((prev) => ({ ...prev, submitting: false }));
    }
  };

  const openResetPassword = (user) => {
    setVerifyResetState({
      open: true,
      user,
      adminPassword: '',
      error: '',
    });
  };

  const closeVerifyReset = () => {
    setVerifyResetState({
      open: false,
      user: null,
      adminPassword: '',
      error: '',
      submitting: false,
    });
  };

  const continueResetPassword = async () => {
    if (!verifyResetState.user) return;
    if (!verifyResetState.adminPassword) {
      setVerifyResetState((prev) => ({ ...prev, error: 'Your password is required for verification.' }));
      return;
    }

    setVerifyResetState((prev) => ({ ...prev, submitting: true, error: '' }));
    try {
      const { data: authUserData, error: authUserError } = await supabase.auth.getUser();
      const adminEmail = authUserData?.user?.email;
      if (authUserError || !adminEmail) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: verifyResetState.adminPassword,
      });
      if (signInError) {
        throw new Error('Admin password verification failed.');
      }

      setResetPwState({
        open: true,
        user: verifyResetState.user,
        password: '',
        error: '',
        submitting: false,
      });
      closeVerifyReset();
    } catch (error) {
      const message = error.message || 'Admin password verification failed.';
      setVerifyResetState((prev) => ({
        ...prev,
        submitting: false,
        error:
          message === 'Unauthorized.'
            ? 'Your admin session has expired. Please log in again.'
            : message,
      }));
    }
  };

  const closeResetPassword = () => {
    setResetPwState({
      open: false,
      user: null,
      password: '',
      error: '',
      submitting: false,
    });
  };

  const submitResetPassword = async () => {
    const user = resetPwState.user;
    const newPassword = resetPwState.password;

    if (!user) return;

    if (!newPassword || newPassword.length < 6) {
      setResetPwState((prev) => ({ ...prev, error: 'Password must be at least 6 characters.' }));
      return;
    }

    setResetPwState((prev) => ({ ...prev, submitting: true, error: '' }));

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ newPassword }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to reset password');
      }

      closeResetPassword();
      openAlert({ title: 'Success', message: 'Password reset successfully!' });
    } catch (error) {
      setResetPwState((prev) => ({
        ...prev,
        submitting: false,
        error: error.message || 'Unknown error',
      }));
      console.error('Reset password error:', error);
    }
  };

  const confirmToggleStatus = (user) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    const action = newStatus === 'Inactive' ? 'Deactivate' : 'Activate';

    setConfirmState({
      open: true,
      title: `${action} user`,
      message: `Are you sure you want to ${action.toLowerCase()} ${user.full_name}?`,
      confirmLabel: action,
      busy: false,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, busy: true }));
        try {
          const authHeaders = await getAuthHeaders();
          const response = await fetch(`/api/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ status: newStatus }),
          });

          const result = await response.json();

          if (!response.ok || result.error) {
            throw new Error(result.error || 'Failed to update status');
          }

          closeConfirm();
          openAlert({ title: 'Success', message: `User ${action.toLowerCase()}d successfully!` });
          fetchUsers();
        } catch (error) {
          closeConfirm();
          openAlert({
            title: 'Update failed',
            message: error.message || 'Unknown error',
          });
          console.error('Toggle status error:', error);
        }
      },
    });
  };

  const getUserActions = (user) => [
    { label: 'View Details', onClick: () => openDetails(user) },
    { label: 'Edit', onClick: () => openEdit(user) },
    { label: 'Reset Password', onClick: () => openResetPassword(user) },
    { type: 'divider' },
    {
      label: user.status === 'Active' ? 'Deactivate' : 'Activate',
      onClick: () => confirmToggleStatus(user),
      variant: user.status === 'Active' ? 'danger' : 'success',
    },
  ];

  const canSubmitResetPassword =
    resetPwState.password.length >= 6 &&
    !resetPwState.submitting;

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
            options={filterRoleOptions}
            placeholder="All Roles"
          />
        </FilterBar>

        {/* Desktop Table View */}
        <div className={styles.tableView}>
          <Table columns={columns} data={filteredUsers} />
        </div>

        {/* Mobile Card View */}
        <div className={styles.mobileCardView}>
          {filteredUsers.map((user) => (
            <div key={user.id} className={styles.userCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                  <div className={styles.avatar}>
                    {user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{user.full_name}</span>
                    <span className={styles.userEmail}>{user.email}</span>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <ActionMenu actions={getUserActions(user)} />
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardRow}>
                  <span className={styles.cardLabel}>Role</span>
                  <span className={styles.cardValue}>
                    <Badge variant={user.role === 'Admin' ? 'primary' : 'secondary'}>{user.role}</Badge>
                  </span>
                </div>
                <div className={styles.cardRow}>
                  <span className={styles.cardLabel}>Status</span>
                  <span className={styles.cardValue}>
                    <Badge variant={user.status === 'Active' ? 'success' : 'danger'}>{user.status}</Badge>
                  </span>
                </div>
                <div className={styles.cardRow}>
                  <span className={styles.cardLabel}>Last Login</span>
                  <span className={styles.cardValue}>
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {loading && <p style={{ padding: '20px', textAlign: 'center' }}>Loading users...</p>}
        {!loading && filteredUsers.length === 0 && (
          <p style={{ padding: '20px', textAlign: 'center' }}>
            No users found. Click “Add User” to create one.
          </p>
        )}

        <DataTableFooter
          showing={filteredUsers.length}
          total={users.length}
          itemName="users"
        />
      </Card>

      {/* Alert Modal */}
      <Modal
        isOpen={!!alertState.open}
        onClose={closeAlert}
        title={alertState.title || 'Message'}
        footer={<Button onClick={closeAlert}>OK</Button>}
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{alertState.message}</p>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        isOpen={!!confirmState.open}
        onClose={closeConfirm}
        title={confirmState.title || 'Confirm'}
        footer={
          <>
            <Button variant="secondary" onClick={closeConfirm} disabled={confirmState.busy}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmState.onConfirm?.()}
              disabled={confirmState.busy}
            >
              {confirmState.busy ? 'Working...' : confirmState.confirmLabel}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{confirmState.message}</p>
      </Modal>

      {/* View Details Modal */}
      <Modal
        isOpen={!!detailsState.open}
        onClose={closeDetails}
        title={detailsState.user ? `User Details: ${detailsState.user.full_name}` : 'User Details'}
        footer={<Button onClick={closeDetails}>Close</Button>}
      >
        {detailsState.user && (
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0 }}>
              <strong>Full Name:</strong> {detailsState.user.full_name}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Email:</strong> {detailsState.user.email}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Contact Number:</strong> {detailsState.user.contact_number || '—'}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Role:</strong> {detailsState.user.role}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Status:</strong> {detailsState.user.status}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Last Login:</strong>{' '}
              {detailsState.user.last_login ? new Date(detailsState.user.last_login).toLocaleString() : 'Never'}
            </p>
          </div>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editState.open}
        onClose={closeEdit}
        title={editState.user ? `Edit User: ${editState.user.full_name}` : 'Edit User'}
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit} disabled={editState.submitting}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={editState.submitting}>
              {editState.submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <Input
              label="Full Name"
              name="fullName"
              value={editState.fullName}
              onChange={handleEditFieldChange}
              placeholder="e.g. Juan Dela Cruz"
              required
              error={editState.errors.fullName}
            />
            <Input
              label="Email Address"
              type="email"
              name="email"
              value={editState.email}
              onChange={handleEditFieldChange}
              placeholder="e.g. juan@example.com"
              required
              error={editState.errors.email}
            />
          </div>

          <div className={styles.formGrid}>
            <Input
              label="Contact Number"
              type="tel"
              name="contactNumber"
              value={editState.contactNumber}
              onChange={handleEditFieldChange}
              placeholder="+63 XXX XXX XXXX"
              mask="ph-contact"
              error={editState.errors.contactNumber}
            />
            <Select
              label="Role"
              name="role"
              value={editState.role}
              onChange={handleEditRoleChange}
              options={formRoleOptions}
              placeholder="Select role"
              required
              error={editState.errors.role}
            />
          </div>

          <p className={styles.formHelperText} style={{ margin: 0 }}>
            This updates the user’s login email (Supabase Auth) and the Users table.
          </p>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetPwState.open}
        onClose={closeResetPassword}
        title={resetPwState.user ? `Reset Password: ${resetPwState.user.full_name}` : 'Reset Password'}
        footer={
          <>
            <Button variant="secondary" onClick={closeResetPassword} disabled={resetPwState.submitting}>
              Cancel
            </Button>
            <Button onClick={submitResetPassword} disabled={!canSubmitResetPassword}>
              {resetPwState.submitting ? 'Saving...' : 'Reset Password'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <Input
            label="New Password"
            type="password"
            name="newPassword"
            value={resetPwState.password}
            onChange={(e) =>
              setResetPwState((prev) => ({ ...prev, password: e.target.value, error: '' }))
            }
            placeholder="At least 6 characters"
            required
            error={resetPwState.error}
          />
          <p className={styles.formHelperText} style={{ margin: 0 }}>
            Minimum 6 characters. Admin verification was completed before this step.
          </p>
        </div>
      </Modal>

      {/* Verify Admin Password Modal */}
      <Modal
        isOpen={!!verifyResetState.open}
        onClose={closeVerifyReset}
        title={verifyResetState.user ? `Verify Admin Password: ${verifyResetState.user.full_name}` : 'Verify Admin Password'}
        footer={
          <>
            <Button variant="secondary" onClick={closeVerifyReset}>
              Cancel
            </Button>
            <Button onClick={continueResetPassword} disabled={verifyResetState.submitting}>
              {verifyResetState.submitting ? 'Verifying...' : 'Continue'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <Input
            label="Your Password"
            type="password"
            name="verifyAdminPassword"
            value={verifyResetState.adminPassword}
            onChange={(e) =>
              setVerifyResetState((prev) => ({ ...prev, adminPassword: e.target.value, error: '' }))
            }
            placeholder="Enter your password to continue"
            required
            error={verifyResetState.error}
          />
        </div>
      </Modal>

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
              type="tel"
              name="contactNumber"
              value={form.contactNumber}
              onChange={handleFieldChange}
              placeholder="+63 XXX XXX XXXX"
              mask="ph-contact"
            />
            <Select
              label="Role"
              name="role"
              value={form.role}
              onChange={handleRoleChange}
              options={formRoleOptions}
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
