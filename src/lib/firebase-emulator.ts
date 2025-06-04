/**
 * Firebase Emulator Configuration
 * This module configures Firebase to use local emulators in development
 */
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';
import { connectStorageEmulator } from 'firebase/storage';
import { auth, db, functions, storage } from './firebase';
import { useFirebaseEmulators, getEmulatorConfig } from './firebase-config';

/**
 * Connect to Firebase emulators if enabled in environment
 */
export function connectToEmulators(): void {
  if (!useFirebaseEmulators()) {
    console.log('Firebase emulators are not enabled. Using production services.');
    return;
  }

  try {
    const emulatorConfig = getEmulatorConfig();
    if (!emulatorConfig) return;

    // Extract host and port from emulator URLs
    const authHost = emulatorConfig.authHost || 'http://localhost:9099';
    const [firestoreHost, firestorePortStr] = (emulatorConfig.firestoreHost || 'localhost:8080').split(':');
    const firestorePort = parseInt(firestorePortStr, 10);
    const [functionsHost, functionsPortStr] = (emulatorConfig.functionsHost || 'localhost:5001').split(':');
    const functionsPort = parseInt(functionsPortStr, 10);

    // Connect to Auth Emulator
    connectAuthEmulator(auth, authHost);
    console.log(`🔥 Connected to Auth emulator at ${authHost}`);

    // Connect to Firestore Emulator
    connectFirestoreEmulator(db, firestoreHost, firestorePort);
    console.log(`🔥 Connected to Firestore emulator at ${firestoreHost}:${firestorePort}`);

    // Connect to Functions Emulator
    connectFunctionsEmulator(functions, functionsHost, functionsPort);
    console.log(`🔥 Connected to Functions emulator at ${functionsHost}:${functionsPort}`);

    // Connect to Storage Emulator (using default port 9199)
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('🔥 Connected to Storage emulator at localhost:9199');

    console.log('🔥 All Firebase emulators connected successfully!');
    console.log('🔥 Visit the Emulator UI at http://localhost:4000');
  } catch (error) {
    console.error('⚠️ Error connecting to Firebase emulators:', error);
    console.warn('⚠️ Make sure your emulators are running with: firebase emulators:start');
  }
}

/**
 * Check if we're connected to emulators
 */
export function isUsingEmulators(): boolean {
  return useFirebaseEmulators();
}
