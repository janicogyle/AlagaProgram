'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/Card';
import Select from '@/components/Select';
import StatCard from '@/components/StatCard';
import BarChart from '@/components/BarChart';
import PieChart from '@/components/PieChart';
import Table from '@/components/Table';
import Badge from '@/components/Badge';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';

export default function AnalyticsPage() {
  const [viewportWidth, setViewportWidth] = useState(1200);
  const [timePeriod, setTimePeriod] = useState('3months');
  const [kpiData, setKpiData] = useState([
    { title: 'Total Beneficiaries', current: 0, previous: 0, growth: 0, icon: 'users', color: 'blue' },
    { title: 'New Registrations', current: 0, previous: 0, growth: 0, icon: 'registration', color: 'green' },
    { title: 'Active Request', current: 0, previous: 0, growth: 0, icon: 'assistance', color: 'orange' },
    { title: 'Completion Rate', current: 0, previous: 0, growth: 0, icon: 'completion', format: '%', color: 'purple' },
  ]);
  const [monthlyRegistrations, setMonthlyRegistrations] = useState([]);
  const [sectorDistribution, setSectorDistribution] = useState([]);
  const [genderDistribution, setGenderDistribution] = useState([]);
  const [ageDistribution, setAgeDistribution] = useState([]);
  const [purokDistribution, setPurokDistribution] = useState([]);
  const [recentRegistrations, setRecentRegistrations] = useState([]);
  const [recentAccountRequests, setRecentAccountRequests] = useState([]);
  const [staffActivity, setStaffActivity] = useState([]);
  const [staffActivityLoading, setStaffActivityLoading] = useState(true);

  useEffect(() => {
    const updateViewportWidth = () => {
      if (typeof window === 'undefined') return;
      setViewportWidth(window.innerWidth || 1200);
    };

    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  const fetchData = useCallback(async () => {
    if (!supabase) {
      console.warn('Database client not available');
      return;
    }
    const periodDays = { '1month': 30, '3months': 90, '6months': 180, '12months': 365 };
    const days = periodDays[timePeriod] || 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: residents } = await supabase
      .from('residents')
      .select(
        'id, created_at, last_name, first_name, is_pwd, is_senior_citizen, is_solo_parent, status, sex, age, birthday, purok, street',
      )
      .order('created_at', { ascending: false });

    if (!residents) return;

    const { data: assistanceRequests } = await supabase
      .from('assistance_requests')
      .select('status, created_at');

    const { data: accountRequests } = await supabase
      .from('account_requests')
      .select('id, created_at, first_name, last_name, is_pwd, is_senior_citizen, is_solo_parent, purok, barangay, status')
      .order('created_at', { ascending: false })
      .limit(5);

    const total = residents.length;
    const requestRows = assistanceRequests || [];
    const totalRequests = requestRows.length;
    const releasedRequests = requestRows.filter((r) => r.status === 'Released').length;
    const activeRequests = requestRows.filter((r) =>
      ['Pending', 'Resubmitted', 'Approved'].includes(r.status),
    ).length;

    let inPeriodCount = 0;
    let pwd = 0;
    let senior = 0;
    let soloParent = 0;
    let male = 0;
    let female = 0;

    const months = {};
    const ageBuckets = { '0-17': 0, '18-35': 0, '36-59': 0, '60+': 0 };
    const purokCounts = {};

    residents.forEach((r) => {
      const createdAt = r.created_at;
      if (createdAt && createdAt >= since) inPeriodCount++;

      if (r.is_pwd) pwd++;
      if (r.is_senior_citizen) senior++;
      if (r.is_solo_parent) soloParent++;
      if (r.sex === 'male') male++;
      if (r.sex === 'female') female++;

      if (createdAt) {
        const d = new Date(createdAt);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        months[key] = (months[key] || 0) + 1;
      }

      const age =
        r.age ?? (r.birthday ? Math.floor((Date.now() - new Date(r.birthday)) / 31557600000) : null);
      if (age !== null) {
        if (age < 18) ageBuckets['0-17']++;
        else if (age < 36) ageBuckets['18-35']++;
        else if (age < 60) ageBuckets['36-59']++;
        else ageBuckets['60+']++;
      }

      const purokKey = r.purok || r.street || 'Unknown';
      purokCounts[purokKey] = (purokCounts[purokKey] || 0) + 1;
    });

    const completionRate =
      totalRequests > 0 ? Math.round((releasedRequests / totalRequests) * 100) : 0;

    setKpiData([
      { title: 'Total Beneficiaries', current: total, previous: 0, growth: 0, icon: 'users', color: 'blue' },
      {
        title: 'New Registrations',
        current: inPeriodCount,
        previous: 0,
        growth: 0,
        icon: 'registration',
        color: 'green',
      },
      { title: 'Active Request', current: activeRequests, previous: 0, growth: 0, icon: 'assistance', color: 'orange' },
      {
        title: 'Completion Rate',
        current: completionRate,
        previous: 0,
        growth: 0,
        icon: 'completion',
        format: '%',
        color: 'purple',
      },
    ]);

    setMonthlyRegistrations(Object.entries(months).map(([label, value]) => ({ label, value })).slice(-6));

    setSectorDistribution([
      { label: 'PWD', value: pwd, color: '#8b5cf6' },
      { label: 'Senior Citizen', value: senior, color: '#10b981' },
      { label: 'Solo Parent', value: soloParent, color: '#f59e0b' },
    ]);

    setGenderDistribution([
      { label: 'Male', value: male, color: '#3b82f6' },
      { label: 'Female', value: female, color: '#ec4899' },
    ]);

    setAgeDistribution(Object.entries(ageBuckets).map(([label, value]) => ({ label, value })));

    const purokTotal = total || 1;
    setPurokDistribution(
      Object.entries(purokCounts).map(([purok, count]) => ({
        purok,
        count,
        percentage: Math.round((count / purokTotal) * 100),
      })),
    );

    setRecentRegistrations(
      residents.slice(0, 5).map((r) => ({
        id: r.id,
        name: `${r.last_name}, ${r.first_name}`,
        sector: [
          r.is_pwd && 'PWD',
          r.is_senior_citizen && 'Senior Citizen',
          r.is_solo_parent && 'Solo Parent',
        ].filter(Boolean),
        purok: r.purok || r.street || '—',
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
        status: r.status || 'Active',
      })),
    );

    if (accountRequests) {
      setRecentAccountRequests(
        accountRequests.map((r) => ({
          id: r.id,
          name: `${r.last_name || ''}, ${r.first_name || ''}`.replace(/^,\s/, '').trim() || '—',
          sector: [
            r.is_pwd && 'PWD',
            r.is_senior_citizen && 'Senior Citizen',
            r.is_solo_parent && 'Solo Parent',
          ].filter(Boolean),
          purok: r.purok || r.barangay || '—',
          date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
          status: r.status || 'Pending',
        }))
      );
    }
  }, [timePeriod]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchData]);

  const fetchStaffActivity = useCallback(async () => {
    setStaffActivityLoading(true);
    try {
      // Only Admin should see this panel; Staff can access Analytics but shouldn’t error.
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('adminUser');
          const user = raw ? JSON.parse(raw) : null;
          if (user?.role && user.role !== 'Admin') {
            setStaffActivity([]);
            return;
          }
        } catch {
          // ignore
        }
      }

      if (!supabase) {
        setStaffActivity([]);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setStaffActivity([]);
        return;
      }

      const res = await fetch('/api/admin/staff-activity?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        // Not an admin; don’t surface noisy errors.
        setStaffActivity([]);
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        setStaffActivity([]);
        return;
      }

      setStaffActivity(json?.data || []);
    } finally {
      setStaffActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('analytics-residents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, () => {
        void fetchData();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  useEffect(() => {
    void fetchStaffActivity();
  }, [fetchStaffActivity]);

  const timePeriodOptions = [
    { value: '1month', label: 'Last Month' },
    { value: '3months', label: 'Last 3 Months' },
    { value: '6months', label: 'Last 6 Months' },
    { value: '12months', label: 'Last Year' },
  ];

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'sector',
      label: 'Sector',
      render: (sectors) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {sectors.map((s, i) => (
            <Badge key={i}>{s}</Badge>
          ))}
        </div>
      ),
    },
    { key: 'purok', label: 'Purok' },
    { key: 'date', label: 'Registration Date' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <Badge
          variant={
            status === 'Active' || status === 'Approved'
              ? 'success'
              : status === 'Pending'
              ? 'warning'
              : 'danger'
          }
        >
          {status}
        </Badge>
      ),
    },
  ];

  const staffActivityColumns = [
    { key: 'title', label: 'Activity' },
    { key: 'time', label: 'When' },
  ];

  const staffActivityRows = (staffActivity || []).map((a) => ({
    id: a.id,
    title: `${a.title}\n${a.message}`,
    time: a.time ? new Date(a.time).toLocaleString() : '',
  }));

  const isTablet = viewportWidth <= 1200 && viewportWidth > 768;
  const isMobile = viewportWidth <= 768;
  const chartHeight = isMobile ? 160 : isTablet ? 170 : 200;
  const pieChartSize = isMobile ? 120 : isTablet ? 130 : 150;

  return (
    <div className={styles.analyticsPage}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>Alaga Dashboard</h2>
          <p>Comprehensive insights into resident data and assistance programs</p>
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
              {kpi.current}{kpi.format || ''}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Account Requests */}
      <Card title="Recent Account Requests" subtitle="Latest beneficiary account signups needing approval">
        {recentAccountRequests.length === 0 ? (
          <p style={{ padding: 12, margin: 0, color: '#6b7280' }}>No recent account requests.</p>
        ) : (
          <Table columns={columns} data={recentAccountRequests} fitToContainer />
        )}
      </Card>

      {/* Recent Registrations (same as Dashboard) */}
      <Card title="Recent Approved Accounts" subtitle="Latest residents added to the system">
        {recentRegistrations.length === 0 ? (
          <p style={{ padding: 12, margin: 0, color: '#6b7280' }}>No recent registrations.</p>
        ) : (
          <Table columns={columns} data={recentRegistrations} fitToContainer />
        )}
      </Card>

      <Card title="Staff Recent Activity" subtitle="Latest actions performed by staff/admin accounts">
        {staffActivityLoading ? (
          <p style={{ padding: 12, margin: 0, color: '#6b7280' }}>Loading staff activity...</p>
        ) : staffActivityRows.length === 0 ? (
          <p style={{ padding: 12, margin: 0, color: '#6b7280' }}>No staff activity yet.</p>
        ) : (
          <Table
            columns={staffActivityColumns.map((c) =>
              c.key === 'title'
                ? {
                    ...c,
                    render: (value) => (
                      <div style={{ whiteSpace: 'pre-line' }}>{value}</div>
                    ),
                  }
                : c,
            )}
            data={staffActivityRows}
          />
        )}
      </Card>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        {/* Registration Trends */}
        <Card title="Registration Trends" className={styles.chartCard}>
          <BarChart 
            data={monthlyRegistrations}
            labelKey="label"
            valueKey="value"
            height={chartHeight}
          />
        </Card>

        {/* Sector Distribution */}
        <Card title="Sector Distribution" className={styles.chartCard}>
          <PieChart 
            data={sectorDistribution}
            size={pieChartSize}
            donut={true}
          />
        </Card>

        {/* Gender Distribution */}
        <Card title="Gender Distribution" className={styles.chartCard}>
          <PieChart 
            data={genderDistribution}
            size={pieChartSize}
            donut={true}
          />
        </Card>

        {/* Age Demographics */}
        <Card title="Age Demographics" className={styles.chartCard}>
          <BarChart 
            data={ageDistribution}
            labelKey="label"
            valueKey="value"
            height={chartHeight}
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
