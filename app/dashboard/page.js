'use client';

import Card from '@/components/Card';
import Table from '@/components/Table';
import Badge from '@/components/Badge';
import BarChart from '@/components/BarChart';
import PieChart from '@/components/PieChart';
import styles from './page.module.css';

// TODO: Fetch from Supabase
const kpiData = [
  { title: 'Total Residents', current: 0, previous: 0, growth: 0, icon: 'users', color: 'blue' },
  { title: 'PWD Residents', current: 0, previous: 0, growth: 0, icon: 'disability', color: 'purple' },
  { title: 'Senior Citizens', current: 0, previous: 0, growth: 0, icon: 'senior', color: 'green' },
  { title: 'Solo Parents', current: 0, previous: 0, growth: 0, icon: 'parent', color: 'orange' },
];

// TODO: Fetch from Supabase
const monthlyRegistrations = [];

// TODO: Fetch from Supabase
const sectorDistribution = [];

// TODO: Fetch from Supabase
const recentRegistrations = [];

const columns = [
  { key: 'name', label: 'Name' },
  { 
    key: 'sector', 
    label: 'Sector',
    render: (sectors) => (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {sectors.map((s, i) => <Badge key={i}>{s}</Badge>)}
      </div>
    )
  },
  { key: 'purok', label: 'Purok' },
  { key: 'date', label: 'Registration Date' },
  { 
    key: 'status', 
    label: 'Status',
    render: (status) => <Badge variant={status === 'Active' ? 'success' : 'danger'}>{status}</Badge>
  },
];

export default function DashboardPage() {
  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>Dashboard Overview</h2>
          <p>Summary of residents and recent activities in Barangay Sta. Rita</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {kpiData.map((kpi, index) => (
          <div key={index} className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>{kpi.title}</span>
              <div className={`${styles.kpiIcon} ${styles[kpi.color]}`}>
                {getKpiIcon(kpi.icon)}
              </div>
            </div>
            <div className={styles.kpiValue}>
              {kpi.current}
            </div>
            <div className={styles.kpiGrowth}>
              <span className={kpi.growth >= 0 ? styles.positive : styles.negative}>
                {kpi.growth >= 0 ? '+' : ''}{kpi.growth.toFixed(1)}%
              </span>
              <span className={styles.kpiPrevious}>vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        {/* Registration Trends */}
        <Card title="Registration Trends" className={styles.chartCard}>
          <BarChart 
            data={monthlyRegistrations}
            labelKey="label"
            valueKey="value"
            height={200}
          />
        </Card>

        {/* Sector Distribution */}
        <Card title="Sector Distribution" className={styles.chartCard}>
          <PieChart 
            data={sectorDistribution}
            size={150}
            donut={true}
          />
        </Card>
      </div>

      {/* Recent Registrations */}
      <Card title="Recent Registrations" subtitle="Latest residents added to the system">
        <Table columns={columns} data={recentRegistrations} />
      </Card>
    </div>
  );
}

function getKpiIcon(type) {
  const icons = {
    users: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    disability: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="4" r="2" />
        <path d="M12 6v6" />
        <path d="M12 12l-4 4-2 2" />
        <path d="M12 12l4 4 2 2" />
      </svg>
    ),
    senior: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    parent: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  };
  return icons[type] || icons.users;
}
