/**
 * Supabase configuration utility
 * Manages Supabase configuration based on environment
 */

/**
 * Supabase Config interface
 */
interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// Default Supabase configuration
const DEFAULT_SUPABASE_URL = 'https://cxvlsgvyvfuzvfxcetuv.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4dmxzZ3Z5dmZ1enZmeGNldHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyOTIwODAsImV4cCI6MjA2NDg2ODA4MH0.X9JVLN-SZUbuo26m1QUSCWi22Re1P_BaFGlUm1Vz87k';

/**
 * Gets the appropriate Supabase config based on environment
 */
export function getSupabaseConfig(): SupabaseConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Supabase URL is required. Please set NEXT_PUBLIC_SUPABASE_URL environment variable.');
  }

  if (!supabaseAnonKey) {
    throw new Error('Supabase anonymous key is required. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

/**
 * Determines if Supabase should use local development
 */
export function useSupabaseLocal(): boolean {
  return process.env.NEXT_PUBLIC_USE_SUPABASE_LOCAL === 'true';
} 