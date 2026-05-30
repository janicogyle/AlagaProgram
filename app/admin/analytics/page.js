'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/Card';
import Select from '@/components/Select';
import KpiCard from '@/components/KpiCard';
import BarChart from '@/components/BarChart';
import PieChart from '@/components/PieChart';
import Table from '@/components/Table';
import Badge from '@/components/Badge';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';
import { deleteClientCache, getClientCache, setClientCache } from '@/lib/clientCache';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ANALYTICS_CACHE_MAX_AGE = 0;
const STAFF_ACTIVITY_CACHE_KEY = 'admin-analytics:staff-activity';
const MONTH_FULL_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getAnalyticsCacheKey = ({ timePeriod, trendMonth, trendYear }) =>
  `admin-analytics:${timePeriod}:${trendMonth}:${trendYear}`;

export default function AnalyticsPage() {
  const currentYear = new Date().getFullYear();
  const [viewportWidth, setViewportWidth] = useState(1200);
  const [timePeriod, setTimePeriod] = useState('3months');
  const [trendMonth, setTrendMonth] = useState('all');
  const [trendYear, setTrendYear] = useState(String(currentYear));
  const [trendYearOptions, setTrendYearOptions] = useState([
    { value: String(currentYear), label: String(currentYear) },
  ]);
  const [kpiData, setKpiData] = useState([
    { title: 'Total Beneficiaries', current: 0, previous: 0, growth: 0, icon: 'users', color: 'blue' },
    { title: 'New Registrations', current: 0, previous: 0, growth: 0, icon: 'registration', color: 'green' },
    { title: 'Active Request', current: 0, previous: 0, growth: 0, icon: 'assistance', color: 'orange' },
    { title: 'Released Assistance', current: 0, previous: 0, growth: 0, icon: 'completion', color: 'purple' },
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

  const applyAnalyticsState = useCallback((nextState) => {
    setKpiData(nextState.kpiData);
    setTrendYearOptions(nextState.trendYearOptions);
    setMonthlyRegistrations(nextState.monthlyRegistrations);
    setSectorDistribution(nextState.sectorDistribution);
    setGenderDistribution(nextState.genderDistribution);
    setAgeDistribution(nextState.ageDistribution);
    setPurokDistribution(nextState.purokDistribution);
    setRecentRegistrations(nextState.recentRegistrations);
    setRecentAccountRequests(nextState.recentAccountRequests);
  }, []);

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
    const cacheKey = getAnalyticsCacheKey({ timePeriod, trendMonth, trendYear });
    const cached = getClientCache(cacheKey, { maxAge: ANALYTICS_CACHE_MAX_AGE });

    if (cached) {
      applyAnalyticsState(cached.value);
      if (cached.isFresh) return;
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

    const ageBuckets = { '18-25': 0, '26-35': 0, '36-50': 0, '51-59': 0, '60+': 0 };
    const purokCounts = {};
    const selectedTrendYear = Number(trendYear) || currentYear;
    const trendMonthCounts = Array(12).fill(0);
    const availableTrendYears = new Set([currentYear]);

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
        const registrationYear = d.getFullYear();
        if (registrationYear >= currentYear) availableTrendYears.add(registrationYear);
        if (registrationYear === selectedTrendYear) {
          trendMonthCounts[d.getMonth()] += 1;
        }
      }

      const age =
        r.age ?? (r.birthday ? Math.floor((Date.now() - new Date(r.birthday)) / 31557600000) : null);
      if (age !== null) {
        if (age < 18) {
          // Age demographics chart starts at 18 by design.
        } else if (age <= 25) ageBuckets['18-25']++;
        else if (age <= 35) ageBuckets['26-35']++;
        else if (age <= 50) ageBuckets['36-50']++;
        else if (age <= 59) ageBuckets['51-59']++;
        else ageBuckets['60+']++;
      }

      const purokKey = r.purok || r.street || 'Unknown';
      purokCounts[purokKey] = (purokCounts[purokKey] || 0) + 1;
    });

    const nextKpiData = [
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
        title: 'Released Assistance',
        current: releasedRequests,
        previous: 0,
        growth: 0,
        icon: 'completion',
        color: 'purple',
      },
    ];

    const nextTrendYearOptions = Array.from(availableTrendYears)
      .sort((a, b) => a - b)
      .map((year) => ({ value: String(year), label: String(year) }));

    const selectedMonthIndex = trendMonth === 'all' ? null : Number(trendMonth);
    const trendMonthIndexes =
      selectedMonthIndex === null || Number.isNaN(selectedMonthIndex)
        ? MONTH_LABELS.map((_, index) => index)
        : [selectedMonthIndex];

    const nextMonthlyRegistrations = trendMonthIndexes.map((monthIndex) => ({
      label: MONTH_LABELS[monthIndex],
      value: trendMonthCounts[monthIndex],
    }));

    const nextSectorDistribution = [
      { label: 'PWD', value: pwd, color: '#8b5cf6' },
      { label: 'Senior Citizen', value: senior, color: '#10b981' },
      { label: 'Solo Parent', value: soloParent, color: '#f59e0b' },
    ];

    const nextGenderDistribution = [
      { label: 'Male', value: male, color: '#3b82f6' },
      { label: 'Female', value: female, color: '#ec4899' },
    ];

    const nextAgeDistribution = Object.entries(ageBuckets).map(([label, value]) => ({ label, value }));

    const purokTotal = total || 1;
    const nextPurokDistribution = Object.entries(purokCounts).map(([purok, count]) => ({
      purok,
      count,
      percentage: Math.round((count / purokTotal) * 100),
    }));

    const nextRecentRegistrations = residents.slice(0, 5).map((r) => ({
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
      }));

    const nextRecentAccountRequests = (accountRequests || []).map((r) => ({
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
        }));

    const nextState = {
      kpiData: nextKpiData,
      trendYearOptions: nextTrendYearOptions,
      monthlyRegistrations: nextMonthlyRegistrations,
      sectorDistribution: nextSectorDistribution,
      genderDistribution: nextGenderDistribution,
      ageDistribution: nextAgeDistribution,
      purokDistribution: nextPurokDistribution,
      recentRegistrations: nextRecentRegistrations,
      recentAccountRequests: nextRecentAccountRequests,
    };

    applyAnalyticsState(nextState);
    setClientCache(cacheKey, nextState);
  }, [applyAnalyticsState, currentYear, timePeriod, trendMonth, trendYear]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchData, timePeriod, trendMonth, trendYear]);

  const fetchStaffActivity = useCallback(async () => {
    const cached = getClientCache(STAFF_ACTIVITY_CACHE_KEY, { maxAge: ANALYTICS_CACHE_MAX_AGE });
    const hasCachedData = !!cached;

    if (cached) {
      setStaffActivity(cached.value);
      setStaffActivityLoading(false);
      if (cached.isFresh) return;
    } else {
      setStaffActivityLoading(true);
    }
    try {
      // Only Admin should see this panel; Staff can access Analytics but shouldn’t error.
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('adminUser');
          const user = raw ? JSON.parse(raw) : null;
          if (user?.role && user.role !== 'Admin') {
            setStaffActivity([]);
            setClientCache(STAFF_ACTIVITY_CACHE_KEY, []);
            return;
          }
        } catch {
          // ignore
        }
      }

      if (!supabase) {
        setStaffActivity([]);
        setClientCache(STAFF_ACTIVITY_CACHE_KEY, []);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setStaffActivity([]);
        setClientCache(STAFF_ACTIVITY_CACHE_KEY, []);
        return;
      }

      const res = await fetch('/api/admin/staff-activity?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        // Not an admin; don’t surface noisy errors.
        setStaffActivity([]);
        setClientCache(STAFF_ACTIVITY_CACHE_KEY, []);
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        setStaffActivity([]);
        setClientCache(STAFF_ACTIVITY_CACHE_KEY, []);
        return;
      }

      const nextStaffActivity = json?.data || [];
      setStaffActivity(nextStaffActivity);
      setClientCache(STAFF_ACTIVITY_CACHE_KEY, nextStaffActivity);
    } finally {
      if (!hasCachedData) setStaffActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('analytics-residents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, () => {
        deleteClientCache(getAnalyticsCacheKey({ timePeriod, trendMonth, trendYear }));
        void fetchData();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData, timePeriod, trendMonth, trendYear]);

  useEffect(() => {
    void fetchStaffActivity();
  }, [fetchStaffActivity]);

  const timePeriodOptions = [
    { value: '1month', label: 'Last Month' },
    { value: '3months', label: 'Last 3 Months' },
    { value: '6months', label: 'Last 6 Months' },
    { value: '12months', label: 'Last Year' },
  ];

  const trendMonthOptions = [
    { value: 'all', label: 'All Months' },
    ...MONTH_LABELS.map((month, index) => ({ value: String(index), label: month })),
  ];

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'sector',
      label: 'Sector',
      render: (sectors) => (
        <div className={styles.sectorBadges}>
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
  const trendTotal = monthlyRegistrations.reduce((total, item) => total + (item.value || 0), 0);
  const trendActiveMonths = monthlyRegistrations.filter((item) => item.value > 0);
  const selectedTrendMonth =
    trendMonth === 'all' ? null : MONTH_FULL_LABELS[Number(trendMonth)] || monthlyRegistrations[0]?.label || '';
  const formatRegistrationCount = (count) => `${count} registration${count === 1 ? '' : 's'}`;

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
          <KpiCard
            key={index}
            title={kpi.title}
            value={`${kpi.current}${kpi.format || ''}`}
            color={kpi.color}
            icon={kpi.icon}
          />
        ))}
      </div>

      {/* Recent Account Requests */}
      <Card title="Recent Account Requests" subtitle="Latest beneficiary account signups needing approval">
        {recentAccountRequests.length === 0 ? (
          <p className={styles.cardMessage}>No recent account requests.</p>
        ) : (
          <div className={styles.recentAccountsTable}>
            <Table columns={columns} data={recentAccountRequests} fitToContainer />
          </div>
        )}
      </Card>

      {/* Recent Registrations (same as Dashboard) */}
      <Card title="Recent Approved Accounts" subtitle="Latest residents added to the system">
        {recentRegistrations.length === 0 ? (
          <p className={styles.cardMessage}>No recent registrations.</p>
        ) : (
          <div className={styles.recentAccountsTable}>
            <Table columns={columns} data={recentRegistrations} fitToContainer />
          </div>
        )}
      </Card>

      <Card title="Staff Recent Activity" subtitle="Latest actions performed by staff/admin accounts">
        {staffActivityLoading ? (
          <p className={styles.cardMessage}>Loading staff activity...</p>
        ) : staffActivityRows.length === 0 ? (
          <p className={styles.cardMessage}>No staff activity yet.</p>
        ) : (
          <div className={styles.staffActivityTable}>
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
              fitToContainer
            />
          </div>
        )}
      </Card>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        {/* Registration Trends */}
        <Card
          title="Registration Trends"
          className={styles.chartCard}
          headerAction={(
            <div className={styles.trendFilters}>
              <Select
                name="trendMonth"
                value={trendMonth}
                onChange={(e) => setTrendMonth(e.target.value)}
                options={trendMonthOptions}
                compact
                className={styles.trendSelect}
              />
              <Select
                name="trendYear"
                value={trendYear}
                onChange={(e) => setTrendYear(e.target.value)}
                options={trendYearOptions}
                compact
                className={styles.trendSelect}
              />
            </div>
          )}
        >
          <BarChart 
            data={monthlyRegistrations}
            labelKey="label"
            valueKey="value"
            height={chartHeight}
          />
          <div className={styles.trendInsightPanel}>
            {trendMonth === 'all' ? (
              <>
                <div className={styles.trendInsightTotal}>
                  <strong>{formatRegistrationCount(trendTotal)}</strong>
                  <span>recorded in {trendYear}</span>
                </div>
                <div className={styles.trendInsightList}>
                  {trendActiveMonths.length > 0 ? (
                    trendActiveMonths.map((item) => (
                      <span key={item.label} className={styles.trendInsightItem}>
                        {formatRegistrationCount(item.value)} in {item.label}
                      </span>
                    ))
                  ) : (
                    <span className={styles.trendInsightItem}>No registrations recorded yet.</span>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.trendInsightTotal}>
                <strong>{formatRegistrationCount(trendTotal)}</strong>
                <span>this month of {selectedTrendMonth} {trendYear}</span>
              </div>
            )}
          </div>
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
        <Card title="Residents by Purok" className={`${styles.chartCard} ${styles.purokChartCard}`}>
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

