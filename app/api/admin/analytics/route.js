import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { applyDirectSectorFilter, rowMatchesSectorAccess } from '@/lib/sectorAccess';

export const runtime = 'nodejs';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function emptyDashboardState(currentYear) {
  return {
    kpiData: [
      { title: 'Total Beneficiaries', current: 0, previous: 0, growth: 0, icon: 'users', color: 'blue' },
      { title: 'New Registrations', current: 0, previous: 0, growth: 0, icon: 'registration', color: 'green' },
      { title: 'Active Request', current: 0, previous: 0, growth: 0, icon: 'assistance', color: 'orange' },
      { title: 'Released Assistance', current: 0, previous: 0, growth: 0, icon: 'completion', color: 'purple' },
    ],
    trendYearOptions: [{ value: String(currentYear), label: String(currentYear) }],
    monthlyRegistrations: MONTH_LABELS.map((label) => ({ label, value: 0 })),
    sectorDistribution: [
      { label: 'PWD', value: 0, color: '#8b5cf6' },
      { label: 'Senior Citizen', value: 0, color: '#10b981' },
      { label: 'Solo Parent', value: 0, color: '#f59e0b' },
    ],
    genderDistribution: [
      { label: 'Male', value: 0, color: '#3b82f6' },
      { label: 'Female', value: 0, color: '#ec4899' },
      { label: 'Unspecified', value: 0, color: '#94a3b8' },
    ],
    ageDistribution: ['1-17', '18-25', '26-35', '36-50', '51-59', '60+'].map((label) => ({ label, value: 0 })),
    purokDistribution: [],
    recentRegistrations: [],
    recentAccountRequests: [],
  };
}

function sectorLabels(row) {
  return [
    row?.is_pwd && 'PWD',
    row?.is_senior_citizen && 'Senior Citizen',
    row?.is_solo_parent && 'Solo Parent',
  ].filter(Boolean);
}

async function runDirectSectorQuery(query, profile) {
  const scoped = applyDirectSectorFilter(query, profile);
  if (!scoped) return [];
  const { data, error } = await scoped;
  if (error) throw error;
  return data || [];
}

export async function GET(request) {
  const auth = await requireStaffOrAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const timePeriod = searchParams.get('timePeriod') || '3months';
    const trendMonth = searchParams.get('trendMonth') || 'all';
    const currentYear = new Date().getFullYear();
    const selectedTrendYear = Number(searchParams.get('trendYear')) || currentYear;
    const periodDays = { '1month': 30, '3months': 90, '6months': 180, '12months': 365 };
    const days = periodDays[timePeriod] || 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const residentQuery = db
      .from('residents')
      .select(
        'id, created_at, last_name, first_name, is_pwd, is_senior_citizen, is_solo_parent, status, sex, age, birthday, purok, street',
      )
      .order('created_at', { ascending: false });
    const accountRequestQuery = db
      .from('account_requests')
      .select('id, created_at, first_name, last_name, is_pwd, is_senior_citizen, is_solo_parent, purok, barangay, status')
      .order('created_at', { ascending: false })
      .limit(5);

    const [residents, accountRequestsResult, assistanceResult] = await Promise.all([
      runDirectSectorQuery(residentQuery, auth.profile),
      runDirectSectorQuery(accountRequestQuery, auth.profile),
      db
        .from('assistance_requests')
        .select('status, created_at, residents:resident_id(id, is_pwd, is_senior_citizen, is_solo_parent)'),
    ]);

    if (assistanceResult.error) throw assistanceResult.error;
    const requestRows = (assistanceResult.data || []).filter((row) => rowMatchesSectorAccess(row, auth.profile));

    const total = residents.length;
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
    let unspecifiedSex = 0;
    const ageBuckets = { '1-17': 0, '18-25': 0, '26-35': 0, '36-50': 0, '51-59': 0, '60+': 0 };
    const purokCounts = {};
    const trendMonthCounts = Array(12).fill(0);
    const availableTrendYears = new Set([currentYear]);

    residents.forEach((r) => {
      const createdAt = r.created_at;
      if (createdAt && createdAt >= since) inPeriodCount++;

      if (r.is_pwd) pwd++;
      if (r.is_senior_citizen) senior++;
      if (r.is_solo_parent) soloParent++;

      const normalizedSex = String(r.sex || '').trim().toLowerCase();
      if (normalizedSex === 'male' || normalizedSex === 'm') male++;
      else if (normalizedSex === 'female' || normalizedSex === 'f') female++;
      else unspecifiedSex++;

      if (createdAt) {
        const d = new Date(createdAt);
        const registrationYear = d.getFullYear();
        if (registrationYear >= currentYear) availableTrendYears.add(registrationYear);
        if (registrationYear === selectedTrendYear) trendMonthCounts[d.getMonth()] += 1;
      }

      const ageValue = r.age ?? (r.birthday ? Math.floor((Date.now() - new Date(r.birthday)) / 31557600000) : null);
      const age = ageValue === null || ageValue === undefined ? null : Number(ageValue);
      if (Number.isFinite(age)) {
        if (age >= 1 && age <= 17) ageBuckets['1-17']++;
        else if (age >= 18 && age <= 25) ageBuckets['18-25']++;
        else if (age >= 26 && age <= 35) ageBuckets['26-35']++;
        else if (age >= 36 && age <= 50) ageBuckets['36-50']++;
        else if (age >= 51 && age <= 59) ageBuckets['51-59']++;
        else if (age >= 60) ageBuckets['60+']++;
      }

      const purokKey = r.purok || r.street || 'Unknown';
      purokCounts[purokKey] = (purokCounts[purokKey] || 0) + 1;
    });

    const selectedMonthIndex = trendMonth === 'all' ? null : Number(trendMonth);
    const trendMonthIndexes =
      selectedMonthIndex === null || Number.isNaN(selectedMonthIndex)
        ? MONTH_LABELS.map((_, index) => index)
        : [selectedMonthIndex];

    const state = {
      kpiData: [
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
      ],
      trendYearOptions: Array.from(availableTrendYears)
        .sort((a, b) => a - b)
        .map((year) => ({ value: String(year), label: String(year) })),
      monthlyRegistrations: trendMonthIndexes.map((monthIndex) => ({
        label: MONTH_LABELS[monthIndex],
        value: trendMonthCounts[monthIndex],
      })),
      sectorDistribution: [
        { label: 'PWD', value: pwd, color: '#8b5cf6' },
        { label: 'Senior Citizen', value: senior, color: '#10b981' },
        { label: 'Solo Parent', value: soloParent, color: '#f59e0b' },
      ],
      genderDistribution: [
        { label: 'Male', value: male, color: '#3b82f6' },
        { label: 'Female', value: female, color: '#ec4899' },
        { label: 'Unspecified', value: unspecifiedSex, color: '#94a3b8' },
      ],
      ageDistribution: Object.entries(ageBuckets).map(([label, value]) => ({ label, value })),
      purokDistribution: Object.entries(purokCounts)
        .map(([purok, count]) => ({
          purok,
          count,
          percentage: Math.round((count / (total || 1)) * 100),
        }))
        .sort((a, b) => b.count - a.count || a.purok.localeCompare(b.purok)),
      recentRegistrations: residents.slice(0, 5).map((r) => ({
        id: r.id,
        name: `${r.last_name}, ${r.first_name}`,
        sector: sectorLabels(r),
        purok: r.purok || r.street || '-',
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
        status: r.status || 'Active',
      })),
      recentAccountRequests: accountRequestsResult.map((r) => ({
        id: r.id,
        name: `${r.last_name || ''}, ${r.first_name || ''}`.replace(/^,\s/, '').trim() || '-',
        sector: sectorLabels(r),
        purok: r.purok || r.barangay || '-',
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
        status: r.status || 'Pending',
      })),
    };

    return NextResponse.json({ data: state, error: null });
  } catch (error) {
    console.error('Fetch analytics dashboard error:', error);
    return NextResponse.json(
      { data: emptyDashboardState(new Date().getFullYear()), error: error.message || 'Failed to fetch analytics.' },
      { status: 500 },
    );
  }
}
