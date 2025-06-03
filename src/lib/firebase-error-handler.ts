/**
 * Firebase Error Handler
 * Utility to handle Firebase errors and convert them to user-friendly messages
 */

import { FirebaseError } from "firebase/app";
import { AuthErrorCodes } from "firebase/auth";
import { FirestoreErrorCode } from "firebase/firestore";
import { FunctionsErrorCode } from "firebase/functions";

export type ErrorWithCode = {
  code?: string;
  message: string;
};

/**
 * Maps Firebase auth error codes to user-friendly messages
 * @param error Firebase error or any error object
 * @returns A user-friendly error message
 */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case AuthErrorCodes.USER_DELETED:
        return "User not found. Please check your credentials.";
      case AuthErrorCodes.INVALID_PASSWORD:
        return "Invalid password. Please try again.";
      case AuthErrorCodes.EMAIL_EXISTS:
        return "Email already in use. Try signing in instead.";
      case AuthErrorCodes.INVALID_EMAIL:
        return "Invalid email address. Please check and try again.";
      case AuthErrorCodes.WEAK_PASSWORD:
        return "Password is too weak. Use at least 6 characters.";
      case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
        return "Too many sign-in attempts. Please try again later.";
      case AuthErrorCodes.USER_DISABLED:
        return "Your account has been disabled. Contact support for help.";
      default:
        return `Authentication error: ${error.message}`;
    }
  } 
  
  return error instanceof Error
    ? error.message
    : typeof error === "string"
    ? error
    : "An unexpected authentication error occurred";
}

/**
 * Maps Firestore error codes to user-friendly messages
 * @param error Firebase error or any error object
 * @returns A user-friendly error message
 */
export function getFirestoreErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code as FirestoreErrorCode) {
      case "permission-denied":
        return "You don't have permission to perform this action.";
      case "not-found":
        return "The requested document was not found.";
      case "already-exists":
        return "A document with the same ID already exists.";
      case "failed-precondition":
        return "Operation failed due to the current state of the database.";
      case "aborted":
        return "The operation was aborted due to a conflict.";
      case "unavailable":
        return "The service is currently unavailable. Please try again later.";
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
 * Maps Cloud Functions error codes to user-friendly messages
 * @param error Firebase error or any error object
 * @returns A user-friendly error message
 */
export function getFunctionsErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code as FunctionsErrorCode) {
      case "functions/cancelled":
        return "The operation was cancelled.";
      case "functions/unknown":
        return "An unknown error occurred.";
      case "functions/invalid-argument":
        return "Invalid argument provided to function.";
      case "functions/deadline-exceeded":
        return "Operation took too long to complete.";
      case "functions/not-found":
        return "The requested resource was not found.";
      case "functions/already-exists":
        return "The resource already exists.";
      case "functions/permission-denied":
        return "You don't have permission to perform this action.";
      case "functions/resource-exhausted":
        return "Resource quota or limits exceeded.";
      case "functions/failed-precondition":
        return "Operation cannot be executed in the current system state.";
      case "functions/aborted":
        return "The operation was aborted.";
      case "functions/out-of-range":
        return "Operation was attempted past the valid range.";
      case "functions/unimplemented":
        return "This functionality is not implemented yet.";
      case "functions/internal":
        return "Internal error. Please try again later.";
      case "functions/unavailable":
        return "The service is currently unavailable. Please try again later.";
      case "functions/data-loss":
        return "Unrecoverable data loss or corruption.";
      case "functions/unauthenticated":
        return "Authentication required to perform this action.";
      default:
        return `Function error: ${error.message}`;
    }
  }

  return error instanceof Error
    ? error.message
    : typeof error === "string"
    ? error
    : "An unexpected error occurred";
}

/**
 * Generic handler for any Firebase errors
 * @param error Firebase error or any error object
 * @returns A user-friendly error message
 */
export function getFirebaseErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "An unexpected error occurred";
  }

  if (error.code.startsWith("auth/")) {
    return getAuthErrorMessage(error);
  } else if (error.code.startsWith("firestore/")) {
    return getFirestoreErrorMessage(error);
  } else if (error.code.startsWith("functions/")) {
    return getFunctionsErrorMessage(error);
  } else {
    return error.message;
  }
}