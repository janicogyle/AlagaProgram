'use client';

import Card from '@/components/Card';
import Table from '@/components/Table';
import Badge from '@/components/Badge';
import BarChart from '@/components/BarChart';
import PieChart from '@/components/PieChart';
import styles from './page.module.css';

// Sample data - Replace with actual data from Supabase
const kpiData = [
  { title: 'Total Residents', current: 8, previous: 6, growth: 33.3, icon: 'users', color: 'blue' },
  { title: 'PWD Residents', current: 3, previous: 2, growth: 50, icon: 'disability', color: 'purple' },
  { title: 'Senior Citizens', current: 3, previous: 3, growth: 0, icon: 'senior', color: 'green' },
  { title: 'Solo Parents', current: 2, previous: 1, growth: 100, icon: 'parent', color: 'orange' },
];

// Chart data - Ready for backend integration
const monthlyRegistrations = [
  { month: 'Apr', registrations: 1 },
  { month: 'May', registrations: 2 },
  { month: 'Jun', registrations: 3 },
  { month: 'Jul', registrations: 2 },
  { month: 'Aug', registrations: 4 },
  { month: 'Sep', registrations: 3 },
  { month: 'Oct', registrations: 2 },
  { month: 'Nov', registrations: 3 },
  { month: 'Dec', registrations: 1 },
  { month: 'Jan', registrations: 2 },
  { month: 'Feb', registrations: 3 },
  { month: 'Mar', registrations: 2 },
];

// Sector distribution data - Ready for backend calculation
const sectorDistribution = [
  { label: 'PWD', value: 3, color: '#7c3aed' },
  { label: 'Senior Citizens', value: 3, color: '#1e40af' },
  { label: 'Solo Parents', value: 2, color: '#16a34a' },
];

const recentRegistrations = [
  { id: 1, name: 'Maria Santos Cruz', sector: ['Senior Citizen'], purok: 'Purok 1', date: '2024-01-15', status: 'Active' },
  { id: 2, name: 'Juan Dela Cruz', sector: ['PWD'], purok: 'Purok 2', date: '2024-01-18', status: 'Active' },
  { id: 3, name: 'Ana Reyes Garcia', sector: ['Solo Parent'], purok: 'Purok 3', date: '2024-01-20', status: 'Active' },
  { id: 4, name: 'Rosa Mendoza Tan', sector: ['Senior Citizen', 'PWD'], purok: 'Purok 2', date: '2024-01-25', status: 'Active' },
];

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
            labelKey="month"
            valueKey="registrations"
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

      {/* Quick Insights */}
      <Card title="Quick Insights" className={styles.insightsCard}>
        <div className={styles.insights}>
          <div className={styles.insight}>
            <div className={styles.insightIcon}>📈</div>
            <div className={styles.insightContent}>
              <h4>Growth Trend</h4>
              <p>Total residents increased by 33.3% this month with balanced sector distribution.</p>
            </div>
          </div>
          <div className={styles.insight}>
            <div className={styles.insightIcon}>⚖️</div>
            <div className={styles.insightContent}>
              <h4>Balanced Demographics</h4>
              <p>PWD and Senior Citizens each represent 37% of total registered residents.</p>
            </div>
          </div>
          <div className={styles.insight}>
            <div className={styles.insightIcon}>👥</div>
            <div className={styles.insightContent}>
              <h4>Active Community</h4>
              <p>4 new residents registered recently across different sectors and puroks.</p>
            </div>
          </div>
        </div>
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
