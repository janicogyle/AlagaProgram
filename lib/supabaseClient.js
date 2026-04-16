import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) are required',
  );
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : null;

// Admin client with service role key (server-side only)
export const supabaseAdmin = typeof window === 'undefined' && supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export const authHelpers = {
  signIn: async (email, password) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  signOut: async () => {
    if (!supabase) {
      return { error: new Error('Supabase client not initialized') };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getSession: async () => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }
    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  },

  getUser: async () => {
    if (!supabase) {
      return { user: null, error: new Error('Supabase client not initialized') };
    }
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Update last login
  updateLastLogin: async (userId) => {
    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      const { error } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
      return { error };
    } catch (error) {
      console.error('Failed to update last login:', error);
      return { error };
    }
  },
};

// Real-time subscription helpers
export const realtimeHelpers = {
  // Subscribe to a table for real-time updates
  subscribeToTable: (tableName, callback, filter = null) => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    let channel = supabase.channel(`${tableName}-changes`);
    
    const subscriptionConfig = {
      event: '*',
      schema: 'public',
      table: tableName,
    };

    if (filter) {
      subscriptionConfig.filter = filter;
    }

    channel = channel.on('postgres_changes', subscriptionConfig, (payload) => {
      callback(payload);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to ${tableName} real-time updates`);
      }
    });

    return channel;
  },

  // Unsubscribe from a channel
  unsubscribe: async (channel) => {
    if (!supabase || !channel) return;
    await supabase.removeChannel(channel);
  },

  // Subscribe to multiple tables
  subscribeToMultipleTables: (tables, callback) => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    return tables.map(tableName => 
      realtimeHelpers.subscribeToTable(tableName, (payload) => {
        callback({ table: tableName, ...payload });
      })
    );
  },
};

// Data fetching helpers with error handling
export const dataHelpers = {
  // Fetch all records from a table
  fetchAll: async (tableName, options = {}) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }

    try {
      let query = supabase.from(tableName).select(options.select || '*');

      if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? false });
      }

      if (options.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error);
      return { data: null, error };
    }
  },

  // Fetch single record by ID
  fetchById: async (tableName, id) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }

    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      return { data, error };
    } catch (error) {
      console.error(`Error fetching ${tableName} by id:`, error);
      return { data: null, error };
    }
  },

  // Fetch users
  fetchUsers: async () => {
    return dataHelpers.fetchAll('users', { orderBy: 'created_at' });
  },

  // Fetch account requests
  fetchAccountRequests: async (status = null) => {
    const options = { orderBy: 'created_at' };
    if (status) {
      options.filter = { status };
    }
    return dataHelpers.fetchAll('account_requests', options);
  },

  // Fetch residents
  fetchResidents: async (filters = {}) => {
    const options = { orderBy: 'last_name', ascending: true };
    if (Object.keys(filters).length > 0) {
      options.filter = filters;
    }
    return dataHelpers.fetchAll('residents', options);
  },

  // Fetch residents by sector
  fetchResidentsBySector: async (sector) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }

    try {
      let query = supabase.from('residents').select('*');

      if (sector === 'pwd') {
        query = query.eq('is_pwd', true);
      } else if (sector === 'senior') {
        query = query.eq('is_senior_citizen', true);
      } else if (sector === 'soloparent') {
        query = query.eq('is_solo_parent', true);
      }

      const { data, error } = await query.order('last_name', { ascending: true });
      return { data, error };
    } catch (error) {
      console.error('Error fetching residents by sector:', error);
      return { data: null, error };
    }
  },

  // Get dashboard statistics
  fetchDashboardStats: async () => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }

    try {
      const [residents, pendingRequests, users] = await Promise.all([
        supabase.from('residents').select('id, is_pwd, is_senior_citizen, is_solo_parent, status'),
        supabase.from('account_requests').select('id').eq('status', 'Pending'),
        supabase.from('users').select('id, status'),
      ]);

      const activeResidents = residents.data?.filter(r => r.status === 'Active') || [];
      
      return {
        data: {
          totalResidents: residents.data?.length || 0,
          activeResidents: activeResidents.length,
          pwdCount: activeResidents.filter(r => r.is_pwd).length,
          seniorCount: activeResidents.filter(r => r.is_senior_citizen).length,
          soloParentCount: activeResidents.filter(r => r.is_solo_parent).length,
          pendingRequests: pendingRequests.data?.length || 0,
          totalUsers: users.data?.length || 0,
          activeUsers: users.data?.filter(u => u.status === 'Active').length || 0,
        },
        error: null,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return { data: null, error };
    }
  },
};
