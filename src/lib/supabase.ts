import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabase-config';

// Initialize Supabase client
const supabaseConfig = getSupabaseConfig();

// Create the Supabase client with retry and timeout options
const supabase = createClient(
  supabaseConfig.supabaseUrl,
  supabaseConfig.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          // Add a longer timeout for network requests
          signal: AbortSignal.timeout(30000), // 30 seconds timeout
        });
      },
    },
  }
);

export { supabase };