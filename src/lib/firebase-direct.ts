// This file contains utility functions for making direct calls to Firebase Functions
// It's a fallback for when the standard Firebase Functions SDK has CORS issues
// Such as when working from GitHub Codespaces

import { auth } from './firebase';
import { getIdToken } from 'firebase/auth';

/**
 * Make a Firebase Function call using direct fetch instead of the Firebase SDK
 * This bypasses CORS issues in some environments like GitHub Codespaces
 * 
 * @param functionName - The name of the function to call
 * @param data - The data payload to send
 * @returns Promise with the function result
 */
export const callFirebaseFunctionDirect = async <T, R>(functionName: string, data: T): Promise<R> => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated to call Firebase Functions');
  }

  // Get a fresh token before making the request
  const idToken = await getIdToken(auth.currentUser, true);
  
  // Construct the URL for the function
  const region = process.env.NEXT_PUBLIC_FIREBASE_REGION || 'us-central1';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
  
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ data })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Function call failed: ${errorData}`);
    }
    
    const result = await response.json();
    return result.result as R;
  } catch (error) {
    console.error(`Error calling Firebase function ${functionName}:`, error);
    throw error;
  }
};

// Driver-specific function wrappers
export const createDriverDirect = async (driverData: any) => {
  return callFirebaseFunctionDirect<any, { success: boolean; id: string; message: string }>(
    'createDriver', 
    driverData
  );
};

export const updateDriverDirect = async (driverId: string, driverData: any) => {
  return callFirebaseFunctionDirect<any, { success: boolean; id: string; message: string }>(
    'updateDriver', 
    { driverId, ...driverData }
  );
};

export const deleteDriverDirect = async (driverId: string) => {
  return callFirebaseFunctionDirect<{ driverId: string }, { success: boolean; id: string; message: string }>(
    'deleteDriver', 
    { driverId }
  );
};
