import { createClient } from '@supabase/supabase-js';

// Load credentials securely from environment variables (fallback to localStorage for mock run)
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_key') || '';

export let supabase = null;
export let isRealSupabase = false;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    isRealSupabase = true;
    console.log("Supabase: Real client initialized successfully.");
  } catch (err) {
    console.error("Supabase: Failed to initialize real client, falling back to mock:", err);
  }
}

// Fallback local storage database mock if no Supabase keys are entered yet
if (!supabase) {
  console.log("Supabase: Using LocalStorage database fallback.");
  
  // Seed default credentials if mock database is empty
  if (!localStorage.getItem('mock_users')) {
    localStorage.setItem('mock_users', JSON.stringify({
      'user123': 'user',
      'admin123': 'admin',
      'superadmin123': 'superadmin'
    }));
  }

  if (!localStorage.getItem('mock_logs')) {
    localStorage.setItem('mock_logs', JSON.stringify([
      { id: 1, action: 'System Init', role: 'System', details: 'Local database booted successfully.', timestamp: new Date().toISOString() }
    ]));
  }

  supabase = {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        const users = JSON.parse(localStorage.getItem('mock_users') || '{}');
        const role = users[password];
        if (role) {
          // Mock login successful
          const session = { user: { email, id: 'mock-user-id' } };
          localStorage.setItem('supabase_session', JSON.stringify({ role, email }));
          return { data: { session, role }, error: null };
        } else {
          return { data: { session: null }, error: { message: 'Invalid password. Try user123, admin123, or superadmin123.' } };
        }
      },
      signOut: async () => {
        localStorage.removeItem('supabase_session');
        return { error: null };
      },
      getSession: async () => {
        const session = localStorage.getItem('supabase_session');
        return { data: { session: session ? JSON.parse(session) : null }, error: null };
      }
    },
    from: (table) => {
      return {
        select: () => ({
          order: () => ({
            then: (callback) => {
              if (table === 'logs') {
                const logs = JSON.parse(localStorage.getItem('mock_logs') || '[]');
                callback({ data: logs, error: null });
              } else {
                callback({ data: [], error: null });
              }
            }
          })
        }),
        insert: (dataArray) => ({
          then: (callback) => {
            if (table === 'logs') {
              const logs = JSON.parse(localStorage.getItem('mock_logs') || '[]');
              dataArray.forEach(item => {
                logs.unshift({
                  id: logs.length + 1,
                  ...item,
                  timestamp: new Date().toISOString()
                });
              });
              localStorage.setItem('mock_logs', JSON.stringify(logs));
              callback({ error: null });
            } else {
              callback({ error: null });
            }
          }
        })
      };
    }
  };
}

// Function to reconnect Supabase client after settings changes
export function reconnectSupabase(url, key) {
  if (url && key) {
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
    try {
      supabase = createClient(url, key);
      isRealSupabase = true;
      console.log("Supabase: Reconnected to real database at", url);
      return true;
    } catch (e) {
      console.error("Supabase: Reconnection failed", e);
      return false;
    }
  } else {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    supabase = null; // Forces fallback initialization on next reload
    isRealSupabase = false;
    console.log("Supabase: Cleared keys, reverting to LocalStorage.");
    return false;
  }
}
