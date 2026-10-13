'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import Badge from '@/components/Badge';
import DataTableFooter from '@/components/DataTableFooter';
import { supabase } from '@/lib/supabaseClient';
import styles from './ActivityLogsView.module.css';

const ROLE_OPTIONS = [
  'Admin',
  'PWD Coordinator',
  'Senior Citizen Coordinator',
  'Solo Parent Coordinator',
  'Beneficiary',
];

const ACTION_SUGGESTIONS = [
  'Logged in',
  'Logged out',
  'Submitted account request',
  'Approved account request',
  'Marked account request incomplete',
  'Registered beneficiary account',
  'Updated beneficiary profile',
  'Submitted assistance request',
  'Approved assistance request',
  'Marked assistance request incomplete',
  'Reopened assistance request',
  'Marked assistance request released',
  'Submitted ID renewal request',
  'Approved ID renewal',
];

const STAFF_ACTION_SUGGESTIONS = [
  'Logged in',
  'Logged out',
  'Registered beneficiary account',
  'Submitted assistance request',
  'Approved assistance request',
  'Marked assistance request incomplete',
  'Reopened assistance request',
  'Marked assistance request released',
];

const EMPTY_FILTERS = {
  search: '',
  user: '',
  role: '',
  action: '',
  dateFrom: '',
  dateTo: '',
};

const MANILA_DATE_TIME = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? MANILA_DATE_TIME.format(date) : '-';
}

function displayValue(value, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}

function recordLabel(row) {
  const type = displayValue(row?.entity_type, 'Record').replaceAll('_', ' ');
  return row?.reference_number ? `${type}: ${row.reference_number}` : type;
}

function roleVariant(role) {
  if (role === 'Admin') return 'success';
  if (role === 'Beneficiary') return 'secondary';
  return 'primary';
}

async function getStaffAccessToken() {
  if (!supabase) return '';
  let { data } = await supabase.auth.getSession();
  let token = data?.session?.access_token || '';
  if (!token) {
    ;({ data } = await supabase.auth.refreshSession());
    token = data?.session?.access_token || '';
  }
  return token;
}

export default function ActivityLogsView({ portal = 'admin' }) {
  const isBeneficiary = portal === 'beneficiary';
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
    viewerRole: isBeneficiary ? 'Beneficiary' : '',
    canViewAll: false,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    Object.entries(filters).forEach(([key, value]) => {
      if (String(value || '').trim()) params.set(key, String(value).trim());
    });
    return params.toString();
  }, [filters, page, pageSize]);

  const authorizedFetch = useCallback(async (url) => {
    const headers = new Headers();
    if (!isBeneficiary) {
      const token = await getStaffAccessToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, {
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
  }, [isBeneficiary]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authorizedFetch(`/api/activity-logs?${queryString}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Unable to load activity logs.');
      }
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setMeta((current) => ({ ...current, ...(payload?.meta || {}) }));
    } catch (loadError) {
      setRows([]);
      setMeta((current) => ({
        ...current,
        total: 0,
        totalPages: 0,
        viewerRole: isBeneficiary ? 'Beneficiary' : '',
        canViewAll: false,
      }));
      setError(loadError?.message || 'Unable to load activity logs.');
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, isBeneficiary, queryString]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const updateDraft = (key, value) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const exportPdf = async ({ print = false } = {}) => {
    if (exporting) return;
    const printWindow = print ? window.open('', '_blank', 'width=1100,height=760') : null;
    if (print && !printWindow) {
      setError('Allow pop-ups for this site, then try printing again.');
      return;
    }
    if (printWindow) printWindow.opener = null;

    setExporting(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (String(value || '').trim()) params.set(key, String(value).trim());
      });
      if (!print) params.set('download', '1');

      const response = await authorizedFetch(`/api/activity-logs/report?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Unable to generate the PDF report.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      if (print) {
        printWindow.location.replace(url);
        window.setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch {
            // The browser's PDF viewer still provides its own print control.
          }
        }, 1200);
        window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `alaga-activity-logs-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (exportError) {
      if (printWindow && !printWindow.closed) printWindow.close();
      setError(exportError?.message || 'Unable to generate the PDF report.');
    } finally {
      setExporting(false);
    }
  };

  const canViewAll = meta.canViewAll === true && meta.viewerRole === 'Admin';
  const actionSuggestions = canViewAll || isBeneficiary
    ? ACTION_SUGGESTIONS
    : STAFF_ACTION_SUGGESTIONS;
  const title = canViewAll ? 'Activity Logs' : isBeneficiary ? 'My Activity History' : 'My Activity Logs';
  const subtitle = canViewAll
    ? 'Review all administrator, coordinator, and beneficiary activity.'
    : isBeneficiary
      ? 'Review activity recorded for your beneficiary account.'
      : 'Review activity performed using your coordinator account.';

  return (
    <div className={styles.page}>
      <Card>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Read-only audit trail</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {canViewAll ? (
            <div className={styles.headerActions}>
              <Button variant="secondary" onClick={() => exportPdf({ print: true })} disabled={exporting || loading}>
                {exporting ? 'Preparing…' : 'Print PDF'}
              </Button>
              <Button onClick={() => exportPdf()} disabled={exporting || loading}>
                {exporting ? 'Preparing…' : 'Download PDF'}
              </Button>
            </div>
          ) : null}
        </div>

        {!canViewAll ? (
          <div className={styles.scopeNotice} role="status">
            {isBeneficiary
              ? 'For privacy, this page only includes activity connected to your beneficiary account.'
              : 'Coordinator access is restricted to activities performed by your own staff account.'}
          </div>
        ) : null}

        {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

        <form className={styles.filters} onSubmit={applyFilters}>
          <label className={styles.fieldWide}>
            <span>Search logs</span>
            <input
              type="search"
              value={draftFilters.search}
              onChange={(event) => updateDraft('search', event.target.value)}
              placeholder="Action, description, or reference"
            />
          </label>

          {canViewAll ? (
            <label>
              <span>User</span>
              <input
                value={draftFilters.user}
                onChange={(event) => updateDraft('user', event.target.value)}
                placeholder="Name or account"
              />
            </label>
          ) : null}

          {canViewAll ? (
            <label>
              <span>Role</span>
              <select value={draftFilters.role} onChange={(event) => updateDraft('role', event.target.value)}>
                <option value="">All roles</option>
                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
          ) : null}

          <label>
            <span>Action</span>
            <input
              list="activity-action-options"
              value={draftFilters.action}
              onChange={(event) => updateDraft('action', event.target.value)}
              placeholder="All actions"
            />
            <datalist id="activity-action-options">
              {actionSuggestions.map((action) => <option key={action} value={action} />)}
            </datalist>
          </label>

          <label>
            <span>Date from</span>
            <input type="date" value={draftFilters.dateFrom} onChange={(event) => updateDraft('dateFrom', event.target.value)} />
          </label>

          <label>
            <span>Date to</span>
            <input type="date" value={draftFilters.dateTo} onChange={(event) => updateDraft('dateTo', event.target.value)} />
          </label>

          <div className={styles.filterActions}>
            <Button type="submit" size="small">Apply Filters</Button>
            <Button type="button" size="small" variant="secondary" onClick={clearFilters}>Clear</Button>
          </div>
        </form>
      </Card>

      <Card className={styles.logsCard}>
        <div className={styles.tableHeading}>
          <div>
            <h2>Recorded Activities</h2>
            <p>Times are displayed in Philippine Standard Time.</p>
          </div>
          <Badge variant="secondary">{meta.total || 0} records</Badge>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date and time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Description</th>
                <th>Affected record</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className={styles.empty}>Loading activity logs…</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td className={styles.timestamp}>{formatDateTime(row.created_at)}</td>
                  <td className={styles.userName}>{displayValue(row.actor_name)}</td>
                  <td><Badge variant={roleVariant(row.actor_role)}>{displayValue(row.actor_role)}</Badge></td>
                  <td className={styles.action}>{displayValue(row.action)}</td>
                  <td className={styles.description}>{displayValue(row.message)}</td>
                  <td className={styles.record}>{recordLabel(row)}</td>
                </tr>
              )) : (
                <tr><td colSpan="6" className={styles.empty}>No activity logs matched the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.mobileList}>
          {loading ? <div className={styles.empty}>Loading activity logs…</div> : null}
          {!loading && rows.map((row) => (
            <article key={row.id} className={styles.logCard}>
              <div className={styles.logCardTop}>
                <strong>{displayValue(row.action)}</strong>
                <Badge variant={roleVariant(row.actor_role)}>{displayValue(row.actor_role)}</Badge>
              </div>
              <p>{displayValue(row.message)}</p>
              <dl>
                <div><dt>User</dt><dd>{displayValue(row.actor_name)}</dd></div>
                <div><dt>Record</dt><dd>{recordLabel(row)}</dd></div>
                <div><dt>Date and time</dt><dd>{formatDateTime(row.created_at)}</dd></div>
              </dl>
            </article>
          ))}
          {!loading && !rows.length ? <div className={styles.empty}>No activity logs matched the selected filters.</div> : null}
        </div>

        <DataTableFooter
          showing={rows.length}
          total={meta.total || 0}
          itemName="activities"
          page={page}
          pageSize={pageSize}
          totalPages={meta.totalPages || 0}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </Card>
    </div>
  );
}

