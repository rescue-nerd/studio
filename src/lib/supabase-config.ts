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

// Default Supabase configuration - replace with your actual values
const DEFAULT_SUPABASE_URL = 'https://cxvlsgvyvfuzvfxcetuv.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4dmxzZ3Z5dmZ1enZmeGNldHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyOTIwODAsImV4cCI6MjA2NDg2ODA4MH0.X9JVLN-SZUbuo26m1QUSCWi22Re1P_BaFGlUm1Vz87k';

/**
 * Gets the appropriate Supabase config based on environment
 */
export function getSupabaseConfig(): SupabaseConfig {
  // Check if we should use local development
  const useLocal = useSupabaseLocal();
  
  let supabaseUrl: string;
  let supabaseAnonKey: string;
  
  if (useLocal) {
    // Use local Supabase configuration
    supabaseUrl = 'http://127.0.0.1:54321';
    supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTQ3MDA4MDAsImV4cCI6MjAwOTI3NjgwMH0.h_2jkHO5A3-0Zj6mF2gEUqByeP5K0Wjz_G4GqPKRp7k';
  } else {
    // Use environment variables or defaults for production
    supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
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
  // Temporarily force production mode until Docker is fixed
  return false;
  // return process.env.NEXT_PUBLIC_USE_SUPABASE_LOCAL === 'true';
}