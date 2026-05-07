'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import styles from './NotificationPanel.module.css';

const DEFAULT_ACTIVITIES = [];

function getLocalReadKey() {
  if (typeof window === 'undefined') return null;
  const rid = window.localStorage.getItem('beneficiaryResidentId');
  return `activityReadIds:${rid || 'anon'}`;
}

function readLocalReadSet() {
  try {
    const key = getLocalReadKey();
    if (!key) return new Set();
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeLocalReadSet(set) {
  try {
    const key = getLocalReadKey();
    if (!key) return;
    window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function formatTimeAgo(value) {
  const now = new Date();
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay}d ago`;
}

function ActivityIcon({ type }) {
  const iconMap = {
    'user-plus': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
    'clipboard': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      </svg>
    ),
    'check-circle': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    'edit': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    'package': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    'file-text': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    'x-circle': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  };

  return iconMap[type] || iconMap['clipboard'];
}

const TYPE_COLORS = {
  blue: 'blue',
  orange: 'orange',
  green: 'green',
  purple: 'purple',
  teal: 'teal',
  indigo: 'indigo',
  red: 'red',
};

export default function NotificationPanel({ isOpen, onClose, anchorRef, onUnreadCountChange }) {
  const router = useRouter();
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'staff'
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffActivities, setStaffActivities] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = useMemo(() => activities.filter((a) => !a.read).length, [activities]);

  useEffect(() => {
    if (typeof onUnreadCountChange === 'function') {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  const filteredActivities = useMemo(() => {
    if (filter === 'staff') return staffActivities;
    if (filter === 'unread') return activities.filter((a) => !a.read);
    return activities;
  }, [activities, filter, staffActivities]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        anchorRef?.current && !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, anchorRef]);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session?.access_token || null;
  }, []);

  const applyLocalReadState = useCallback((items) => {
    const readSet = readLocalReadSet();
    return (items || []).map((a) => {
      if (a?.source === 'beneficiary' || a?.source === 'system') {
        return { ...a, read: a.read || readSet.has(a.id) };
      }
      return a;
    });
  }, []);

  const mapLevelToIconAndColor = useCallback((level) => {
    const l = String(level || 'info');
    const colorByLevel = {
      info: 'blue',
      success: 'green',
      warning: 'orange',
      error: 'red',
    };

    const iconByLevel = {
      info: 'clipboard',
      success: 'check-circle',
      warning: 'file-text',
      error: 'x-circle',
    };

    return {
      icon: iconByLevel[l] || 'clipboard',
      color: colorByLevel[l] || 'blue',
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const res = await fetch('/api/activity', { headers });
      const json = await res.json();

      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Failed to load activity.');
      }

      setActivities(applyLocalReadState(json?.data || []));

      // Admin-only: load staff activity feed for monitoring
      if (token) {
        setStaffLoading(true);
        try {
          const staffRes = await fetch('/api/admin/staff-activity?limit=30', { headers });
          const staffJson = await staffRes.json().catch(() => ({}));

          if (staffRes.ok && !staffJson?.error) {
            setIsAdmin(true);
            const items = (staffJson?.data || []).map((row) => {
              const { icon, color } = mapLevelToIconAndColor(row?.type);
              return {
                id: `staff:${String(row?.id || '')}`,
                source: 'staff',
                title: row?.title || 'Staff activity',
                message: row?.message || '',
                time: row?.time || row?.created_at || null,
                read: true,
                icon,
                color,
                link: row?.link || '/admin/assistance/requests',
              };
            });
            setStaffActivities(items);
          } else {
            // 403 for non-admin is expected; don't treat as an error
            setIsAdmin(false);
            setStaffActivities([]);
          }
        } catch {
          setIsAdmin(false);
          setStaffActivities([]);
        } finally {
          setStaffLoading(false);
        }
      }
    } catch (err) {
      console.error('Failed to load recent activity:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [applyLocalReadState, getAccessToken, mapLevelToIconAndColor]);

  useEffect(() => {
    // Load once on mount so the navbar badge works even before opening.
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  const markAllAsRead = useCallback(async () => {
    const token = await getAccessToken();

    // If we have a token, we can update server notifications.
    if (token) {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ markAll: true }),
        });
      } catch {
        // ignore
      }
    }

    // Always persist local derived read-state too.
    const readSet = readLocalReadSet();
    activities.forEach((a) => {
      if (a?.source === 'beneficiary' || a?.source === 'system') {
        readSet.add(a.id);
      }
    });
    writeLocalReadSet(readSet);

    setActivities((prev) => prev.map((a) => ({ ...a, read: true })));
  }, [activities, getAccessToken]);

  const markAsRead = useCallback(
    async (activity) => {
      if (!activity || activity.read) return;

      const next = (prev) => prev.map((a) => (a.id === activity.id ? { ...a, read: true } : a));

      if (activity.source === 'notification') {
        const token = await getAccessToken();
        if (token) {
          try {
            await fetch('/api/notifications', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ ids: [activity.id] }),
            });
          } catch {
            // ignore
          }
        }
        setActivities(next);
        return;
      }

      const readSet = readLocalReadSet();
      readSet.add(activity.id);
      writeLocalReadSet(readSet);
      setActivities(next);
    },
    [getAccessToken],
  );

  const handleClickActivity = useCallback(
    async (activity) => {
      await markAsRead(activity);
      if (activity?.link) {
        router.push(activity.link);
        onClose();
      }
    },
    [markAsRead, onClose, router],
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      <div className={styles.panel} ref={panelRef} role="dialog" aria-label="Recent Activity">
        {/* Drag handle (visible on mobile only via CSS) */}
        <div className={styles.dragHandle}>
          <span className={styles.dragBar} />
        </div>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Recent Activity</h3>
            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>{unreadCount}</span>
            )}
          </div>
          <div className={styles.headerRight}>
            {filter !== 'staff' && unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={markAllAsRead}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Mark all read
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close recent activity">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className={styles.filterBar}>
          <button
            className={`${styles.filterTab} ${filter === 'all' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'unread' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread{unreadCount > 0 && ` (${unreadCount})`}
          </button>
          {isAdmin && (
            <button
              className={`${styles.filterTab} ${filter === 'staff' ? styles.filterTabActive : ''}`}
              onClick={() => setFilter('staff')}
            >
              Staff Activity
            </button>
          )}
        </div>

        {/* Activity list */}
        <div className={styles.activityList}>
          {(filter === 'staff' ? staffLoading : loading) ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>
                {filter === 'staff' ? 'Loading staff activity…' : 'Loading activity…'}
              </p>
              <p className={styles.emptyText}>Please wait.</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <p className={styles.emptyTitle}>
                {filter === 'staff' ? 'No staff activity yet' : 'No recent activity'}
              </p>
              <p className={styles.emptyText}>
                {filter === 'unread'
                  ? "You're all caught up!"
                  : filter === 'staff'
                    ? 'Staff activities will appear here.'
                    : 'Recent activities will appear here.'}
              </p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <button
                key={activity.id}
                className={`${styles.activityItem} ${!activity.read ? styles.unread : ''}`}
                onClick={() => handleClickActivity(activity)}
              >
                <div className={`${styles.activityIcon} ${styles[TYPE_COLORS[activity.color]] || ''}`}>
                  <ActivityIcon type={activity.icon} />
                </div>
                <div className={styles.activityBody}>
                  <div className={styles.activityHeader}>
                    <span className={styles.activityTitle}>{activity.title}</span>
                    <span className={styles.activityTime}>{formatTimeAgo(activity.time)}</span>
                  </div>
                  <p className={styles.activityMessage}>{activity.message}</p>
                </div>
                {!activity.read && <span className={styles.unreadDot} />}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {filteredActivities.length > 0 && (
          <div className={styles.footer}>
            <span className={styles.footerText}>
              Showing {filteredActivities.length} recent {filteredActivities.length === 1 ? 'activity' : 'activities'}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
