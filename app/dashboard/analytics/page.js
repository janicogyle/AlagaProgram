'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import Select from '@/components/Select';
import StatCard from '@/components/StatCard';
import BarChart from '@/components/BarChart';
import PieChart from '@/components/PieChart';
import styles from './page.module.css';

// TODO: Fetch from Supabase
const kpiData = [
  { title: 'Total Residents', current: 0, previous: 0, growth: 0, icon: 'users', color: 'blue' },
  { title: 'New Registrations', current: 0, previous: 0, growth: 0, icon: 'registration', color: 'green' },
  { title: 'Active Cases', current: 0, previous: 0, growth: 0, icon: 'assistance', color: 'orange' },
  { title: 'Completion Rate', current: 0, previous: 0, growth: 0, icon: 'completion', format: '%', color: 'purple' },
];

// TODO: Fetch from Supabase
// Expected shapes for Supabase queries:
// purokDistribution: [{ purok: 'Purok 1', count: 10, percentage: 25 }]
// assistanceData: [{ type: 'Medicine Assistance', amount: '₱50,000', count: 15 }]
const sectorTrends = [];
const purokDistribution = [];
const ageDistribution = [];
const monthlyRegistrations = [];
const sectorDistribution = [];
const genderDistribution = [];
const assistanceData = [];

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

        {/* Gender Distribution */}
        <Card title="Gender Distribution" className={styles.chartCard}>
          <PieChart 
            data={genderDistribution}
            size={150}
            donut={true}
          />
        </Card>

        {/* Age Demographics */}
        <Card title="Age Demographics" className={styles.chartCard}>
          <BarChart 
            data={ageDistribution}
            labelKey="label"
            valueKey="value"
            height={200}
            color="linear-gradient(180deg, #10b981 0%, #059669 100%)"
          />
        </Card>

        {/* Purok Distribution */}
        <Card title="Residents by Purok" className={styles.chartCard}>
          <div className={styles.horizontalChart}>
            {purokDistribution.map((item, index) => (
              <div 
                key={index} 
                className={styles.hBarItem}
              >
                <div className={styles.hBarLabel}>
                  <span>{item.purok}</span>
                  <span className={styles.hBarCount}>{item.count}</span>
                </div>
                <div className={styles.hBarContainer}>
                  <div 
                    className={styles.hBar}
                    style={{ width: `${item.percentage}%` }}
                  >
                    <span className={styles.hBarTooltip}>
                      <strong>{item.purok}</strong>
                      <span>{item.count} resident{item.count !== 1 ? 's' : ''}</span>
                      <span>{item.percentage}% of total</span>
                    </span>
                  </div>
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    registration: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
    assistance: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
    completion: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    chart: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    trending: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    calendar: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    file: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  };
  return icons[type] || icons.users;
}