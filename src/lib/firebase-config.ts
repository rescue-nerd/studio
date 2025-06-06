/**
 * Firebase configuration utility
 * Manages Firebase configuration based on environment
 */

/**
 * Firebase Config for various environments
 */
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/**
 * Gets the appropriate Firebase config based on environment
 */
export function getFirebaseConfig(): FirebaseConfig {
  // Use environment variables for production
  if (process.env.NODE_ENV === 'production') {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY as string,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID as string,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };
  }

  // Default development config with hardcoded values as fallback
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBpzB4yM4qvK7TXYc0LA8F4d_jVx8cGjks",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "gorkhatrans.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gorkhatrans",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "gorkhatrans.appspot.com", // Fixed storage bucket URL
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "224119383159",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:224119383159:web:e02ca988722b8909759272",
  };
}

/**
 * Gets the Firebase region configuration
 * @returns Firebase region (e.g., 'us-central1')
 */
export function getFirebaseRegion(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_REGION || 'us-central1';
}

/**
 * Determines if Firebase emulators should be used
 */
export function useFirebaseEmulators(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
}

/**
 * Gets the Firebase emulator host configuration
 */
export function getEmulatorConfig() {
  if (!useFirebaseEmulators()) {
    return null;
  }

  return {
    authHost: 'http://localhost:9099',
    firestoreHost: 'localhost:8080',
    functionsHost: 'localhost:5001',
  };
}