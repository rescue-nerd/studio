import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabase-config';

// Initialize Supabase client
const supabaseConfig = getSupabaseConfig();
const supabase = createClient(
  supabaseConfig.supabaseUrl,
  supabaseConfig.supabaseAnonKey
);

export { supabase };
