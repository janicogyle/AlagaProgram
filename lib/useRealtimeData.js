'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, realtimeHelpers, dataHelpers } from './supabaseClient';

// Hook for fetching data with real-time updates
export function useRealtimeData(tableName, options = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: fetchedData, error: fetchError } = await dataHelpers.fetchAll(tableName, options);
      
      if (fetchError) {
        throw fetchError;
      }
      
      setData(fetchedData || []);
    } catch (err) {
      console.error(`Error fetching ${tableName}:`, err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [tableName, JSON.stringify(options)]);

  useEffect(() => {
    fetchData();

    // Set up real-time subscription
    if (supabase && options.realtime !== false) {
      channelRef.current = realtimeHelpers.subscribeToTable(tableName, (payload) => {
        console.log(`Real-time update for ${tableName}:`, payload.eventType);
        
        setData(currentData => {
          switch (payload.eventType) {
            case 'INSERT':
              return [payload.new, ...currentData];
            
            case 'UPDATE':
              return currentData.map(item => 
                item.id === payload.new.id ? payload.new : item
              );
            
            case 'DELETE':
              return currentData.filter(item => item.id !== payload.old.id);
            
            default:
              return currentData;
          }
        });
      });
    }

    return () => {
      if (channelRef.current) {
        realtimeHelpers.unsubscribe(channelRef.current);
      }
    };
  }, [fetchData, tableName]);

  return { data, loading, error, refetch: fetchData };
}

// Hook specifically for users
export function useUsers() {
  return useRealtimeData('users', { orderBy: 'created_at' });
}

// Hook specifically for account requests
export function useAccountRequests(status = null) {
  const options = { orderBy: 'created_at' };
  if (status) {
    options.filter = { status };
  }
  return useRealtimeData('account_requests', options);
}

// Hook specifically for residents
export function useResidents(filters = {}) {
  const options = { orderBy: 'last_name', ascending: true };
  if (Object.keys(filters).length > 0) {
    options.filter = filters;
  }
  return useRealtimeData('residents', options);
}

// Hook for dashboard statistics with real-time updates
export function useDashboardStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelsRef = useRef([]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await dataHelpers.fetchDashboardStats();
      
      if (fetchError) {
        throw fetchError;
      }
      
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Subscribe to multiple tables for dashboard updates
    if (supabase) {
      const tables = ['residents', 'account_requests', 'users'];
      channelsRef.current = realtimeHelpers.subscribeToMultipleTables(tables, () => {
        // Refetch stats on any change
        fetchStats();
      });
    }

    return () => {
      channelsRef.current.forEach(channel => {
        if (channel) {
          realtimeHelpers.unsubscribe(channel);
        }
      });
    };
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// Hook for single record with real-time updates
export function useRealtimeRecord(tableName, id) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);

  const fetchRecord = useCallback(async () => {
    if (!id) {
      setRecord(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await dataHelpers.fetchById(tableName, id);
      
      if (fetchError) {
        throw fetchError;
      }
      
      setRecord(data);
    } catch (err) {
      console.error(`Error fetching ${tableName} record:`, err);
      setError(err.message || 'Failed to fetch record');
    } finally {
      setLoading(false);
    }
  }, [tableName, id]);

  useEffect(() => {
    fetchRecord();

    // Set up real-time subscription for this specific record
    if (supabase && id) {
      channelRef.current = realtimeHelpers.subscribeToTable(
        tableName, 
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new.id === id) {
            setRecord(payload.new);
          } else if (payload.eventType === 'DELETE' && payload.old.id === id) {
            setRecord(null);
          }
        },
        `id=eq.${id}`
      );
    }

    return () => {
      if (channelRef.current) {
        realtimeHelpers.unsubscribe(channelRef.current);
      }
    };
  }, [fetchRecord, tableName, id]);

  return { record, loading, error, refetch: fetchRecord };
}
