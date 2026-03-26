import React from 'react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Card from '../../components/Card';
import Table from '../../components/Table';
import styles from './page.module.css';

const recentRequestsData = [
  { id: 1, service: 'Medical Assistance', date: '2024-03-15', status: 'Approved' },
  { id: 2, service: 'Business Permit', date: '2024-03-12', status: 'Pending' },
  { id: 3, service: 'Barangay Clearance', date: '2024-03-10', status: 'Completed' },
];

const columns = [
  { key: 'service', label: 'Service' },
  { key: 'date', label: 'Date Requested' },
  { key: 'status', label: 'Status' },
];


export default function BeneficiaryDashboard() {
  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className={styles.statsGrid}>
        <StatCard title="My Requests" value="3" />
        <StatCard title="Available Services" value="12" />
        <StatCard title="Notifications" value="2" />
      </div>
      <Card>
        <h2>Recent Requests</h2>
        <Table columns={columns} data={recentRequestsData} />
      </Card>
    </div>
  );
}
