'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import Select from '@/components/Select';
import StatCard from '@/components/StatCard';
import styles from './page.module.css';

// Sample analytics data - Replace with actual Supabase data
const kpiData = [
  { title: 'Total Residents', current: 8, previous: 6, growth: 33.3, icon: 'users', color: 'blue' },
  { title: 'New Registrations', current: 4, previous: 2, growth: 100, icon: 'registration', color: 'green' },
  { title: 'Active Cases', current: 6, previous: 8, growth: -25, icon: 'assistance', color: 'orange' },
  { title: 'Completion Rate', current: 94, previous: 87, growth: 8, icon: 'completion', format: '%', color: 'purple' },
];

const sectorTrends = [
  { month: 'Jan', PWD: 1, 'Senior Citizen': 2, 'Solo Parent': 1 },
  { month: 'Feb', PWD: 2, 'Senior Citizen': 3, 'Solo Parent': 1 },
  { month: 'Mar', PWD: 3, 'Senior Citizen': 3, 'Solo Parent': 2 },
];

const purokDistribution = [
  { purok: 'Purok 1', count: 2, percentage: 25 },
  { purok: 'Purok 2', count: 3, percentage: 37.5 },
  { purok: 'Purok 3', count: 2, percentage: 25 },
  { purok: 'Purok 4', count: 1, percentage: 12.5 },
  { purok: 'Purok 5', count: 0, percentage: 0 },
];

const ageDistribution = [
  { range: '0-17', count: 0, percentage: 0 },
  { range: '18-39', count: 3, percentage: 37.5 },
  { range: '40-59', count: 2, percentage: 25 },
  { range: '60+', count: 3, percentage: 37.5 },
];

const monthlyRegistrations = [
  { month: 'Oct', registrations: 2 },
  { month: 'Nov', registrations: 3 },
  { month: 'Dec', registrations: 1 },
  { month: 'Jan', registrations: 2 },
];

const assistanceData = [
  { type: 'Medical', count: 12, amount: '₱45,000' },
  { type: 'Educational', count: 8, amount: '₱25,000' },
  { type: 'Cash Aid', count: 15, amount: '₱75,000' },
  { type: 'Relief Goods', count: 20, amount: '₱30,000' },
];

export default function AnalyticsPage() {
  const [timePeriod, setTimePeriod] = useState('3months');

  const timePeriodOptions = [
    { value: '1month', label: 'Last Month' },
    { value: '3months', label: 'Last 3 Months' },
    { value: '6months', label: 'Last 6 Months' },
    { value: '12months', label: 'Last Year' },
  ];

  return (
    <div className={styles.analyticsPage}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>Analytics Dashboard</h2>
          <p>Comprehensive insights into resident data and assistance programs</p>
        </div>
        <Select
          value={timePeriod}
          onChange={(e) => setTimePeriod(e.target.value)}
          options={timePeriodOptions}
          className={styles.periodSelect}
        />
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
              {kpi.current}{kpi.format || ''}
            </div>
            <div className={styles.kpiGrowth}>
              <span className={kpi.growth >= 0 ? styles.positive : styles.negative}>
                {kpi.growth >= 0 ? '+' : ''}{kpi.growth.toFixed(1)}%
              </span>
              <span className={styles.kpiPrevious}>vs previous period</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        {/* Registration Trends */}
        <Card title="Registration Trends" className={styles.chartCard}>
          <div className={styles.lineChart}>
            {monthlyRegistrations.map((item, index) => (
              <div key={index} className={styles.linePoint}>
                <div 
                  className={styles.lineBar}
                  style={{ height: `${(item.registrations / 3) * 100}%` }}
                />
                <span className={styles.lineLabel}>{item.month}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Sector Distribution */}
        <Card title="Sector Distribution" className={styles.chartCard}>
          <div className={styles.pieChart}>
            <div className={styles.pieContainer}>
              <div className={styles.pieSlice} style={{ '--percentage': 37, '--color': '#7c3aed' }}></div>
              <div className={styles.pieSlice} style={{ '--percentage': 37, '--color': '#1e40af' }}></div>
              <div className={styles.pieSlice} style={{ '--percentage': 26, '--color': '#16a34a' }}></div>
            </div>
            <div className={styles.pieLegend}>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: '#7c3aed' }}></div>
                <span>PWD (37%)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: '#1e40af' }}></div>
                <span>Senior Citizens (37%)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: '#16a34a' }}></div>
                <span>Solo Parents (26%)</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Age Demographics */}
        <Card title="Age Demographics" className={styles.chartCard}>
          <div className={styles.barChart}>
            {ageDistribution.map((item, index) => (
              <div key={index} className={styles.barItem}>
                <div 
                  className={styles.bar}
                  style={{ height: `${item.percentage * 2}%` }}
                />
                <span className={styles.barLabel}>{item.range}</span>
                <span className={styles.barValue}>{item.count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Purok Distribution */}
        <Card title="Residents by Purok" className={styles.chartCard}>
          <div className={styles.horizontalChart}>
            {purokDistribution.map((item, index) => (
              <div key={index} className={styles.hBarItem}>
                <div className={styles.hBarLabel}>
                  <span>{item.purok}</span>
                  <span className={styles.hBarCount}>{item.count}</span>
                </div>
                <div className={styles.hBarContainer}>
                  <div 
                    className={styles.hBar}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className={styles.hBarPercentage}>{item.percentage}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Assistance Analytics */}
      <Card title="Assistance Program Analytics" className={styles.assistanceCard}>
        <div className={styles.assistanceGrid}>
          {assistanceData.map((item, index) => (
            <div key={index} className={styles.assistanceItem}>
              <div className={styles.assistanceHeader}>
                <h4>{item.type}</h4>
                <span className={styles.assistanceAmount}>{item.amount}</span>
              </div>
              <div className={styles.assistanceCount}>
                <span className={styles.count}>{item.count}</span>
                <span className={styles.countLabel}>recipients</span>
              </div>
            </div>
          ))}
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
    registration: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
    assistance: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
    completion: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22,4 12,14.01 9,11.01" />
      </svg>
    ),
  };
  return icons[type] || icons.users;
}