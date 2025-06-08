/**
 * Supabase Error Handler
 * Utility to handle Supabase errors and convert them to user-friendly messages
 */

import { PostgrestError } from '@supabase/supabase-js';

export type ErrorWithCode = {
  code?: string;
  message: string;
};

/**
 * Maps Supabase auth error codes to user-friendly messages
 * @param error Supabase error or any error object
 * @returns A user-friendly error message
 */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('invalid login credentials')) {
      return 'Invalid email or password. Please try again.';
    }
    if (errorMessage.includes('email not confirmed')) {
      return 'Please confirm your email address before signing in.';
    }
    if (errorMessage.includes('email already registered')) {
      return 'Email already in use. Try signing in instead.';
    }
    if (errorMessage.includes('password should be at least')) {
      return 'Password is too weak. Use at least 6 characters.';
    }
    if (errorMessage.includes('too many requests')) {
      return 'Too many sign-in attempts. Please try again later.';
    }
    if (errorMessage.includes('user not found')) {
      return 'User not found. Please check your credentials.';
    }
    if (errorMessage.includes('invalid email')) {
      return 'Invalid email address. Please check and try again.';
    }
    
    return `Authentication error: ${error.message}`;
  }
  
  return error instanceof Error
    ? error.message
    : typeof error === "string"
    ? error
    : "An unexpected authentication error occurred";
}

/**
 * Maps Supabase database error codes to user-friendly messages
 * @param error Supabase error or any error object
 * @returns A user-friendly error message
 */
export function getDatabaseErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as ErrorWithCode).code;
    switch (code) {
      case '23505': // unique_violation
        return 'This record already exists.';
      case '23503': // foreign_key_violation
        return 'This operation would violate database constraints.';
      case '42P01': // undefined_table
        return 'The requested table does not exist. The database schema may need to be initialized.';
      case '42703': // undefined_column
        return 'The requested column does not exist.';
      default:
        return `Database error: ${(error as ErrorWithCode).message}`;
    }
  }
  
  if (error instanceof PostgrestError) {
    switch (error.code) {
      case '23505': // unique_violation
        return 'This record already exists.';
      case '23503': // foreign_key_violation
        return 'This operation would violate database constraints.';
      case '42P01': // undefined_table
        return 'The requested table does not exist. The database schema may need to be initialized.';
      case '42703': // undefined_column
        return 'The requested column does not exist.';
      default:
        return `Database error: ${error.message}`;
    }
  }
  
  return error instanceof Error
    ? error.message
    : typeof error === "string"
    ? error
    : "An unexpected database error occurred";
}

/**
 * Generic handler for any Supabase errors
 * @param error Supabase error or any error object
 * @returns A user-friendly error message
 */
export function getSupabaseErrorMessage(error: unknown): string {
  if (error instanceof PostgrestError) {
    return getDatabaseErrorMessage(error);
  }
  
  if (error instanceof Error) {
    if (error.message.includes('auth')) {
      return getAuthErrorMessage(error);
    }
    return error.message;
  }
  
  return typeof error === "string"
    ? error
    : "An unexpected error occurred";
}

/**
 * Handles Supabase errors and displays them using toast notifications
 * @param error The error to handle
 * @param toast The toast function from useToast hook
 * @param customMessages Optional custom error messages for specific error codes
 */
export function handleSupabaseError(
  error: unknown,
  toast: any,
  customMessages: Record<string, string> = {}
): void {
  const message = getSupabaseErrorMessage(error);
  
  // Check if there's a custom message for this error
  let customMessage = null;
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    for (const [key, value] of Object.entries(customMessages)) {
      if (errorMessage.includes(key.toLowerCase())) {
        customMessage = value;
        break;
      }
    }
  }

  toast({
    title: "Error",
    description: customMessage || message,
    variant: "destructive",
  });
}

/**
 * Logs errors to console with additional context
 * @param error The error to log
 * @param context Additional context about where the error occurred
 */
export function logError(error: unknown, context: string): void {
  console.error(`Error in ${context}:`, error);
}