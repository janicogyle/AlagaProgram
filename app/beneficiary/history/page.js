'use client';

import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Table from '../../../components/Table';
import Badge from '../../../components/Badge';
import Button from '../../../components/Button';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';

const columns = [
  { key: 'control_number', label: 'Control No.' },
  { key: 'assistance_type', label: 'Type of Assistance' },
  {
    key: 'request_date',
    label: 'Date Requested',
  },
  {
    key: 'status',
    label: 'Status',
    render: (status) => (
      <Badge
        variant={
          status === 'Released' || status === 'Approved'
            ? 'success'
            : status === 'Rejected'
            ? 'danger'
            : 'warning'
        }
      >
        {status}
      </Badge>
    ),
  },
];

export default function BeneficiaryHistoryPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        let residentId = null;
        if (typeof window !== 'undefined') {
          residentId = window.localStorage.getItem('beneficiaryResidentId');
        }

        if (!residentId) {
          setRequests([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('assistance_requests')
          .select('*')
          .eq('resident_id', residentId)
          .order('request_date', { ascending: false });

        if (error) throw error;
        setRequests(data || []);
      } catch (err) {
        console.error('Failed to load assistance history:', err);
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, []);

  const tableData = requests.map((r) => ({
    ...r,
    request_date: r.request_date ? new Date(r.request_date).toLocaleDateString() : '',
  }));

  return (
    <div className={styles.historyPage}>
      <PageHeader
        title="Requests History"
        subtitle="View all assistance requests you have submitted"
      />

      <Card className={styles.historyCard}>
        <div className={styles.headerRow}>
          <h2>Requests</h2>
          <Button href="/beneficiary/requests">New Request</Button>
        </div>

        {loading ? (
          <p className={styles.muted}>Loading your assistance history...</p>
        ) : tableData.length === 0 ? (
          <p className={styles.muted}>
            You have no assistance requests yet. Click "New Request" to submit one.
          </p>
        ) : (
          <Table columns={columns} data={tableData} />
        )}
      </Card>
    </div>
  );
}
