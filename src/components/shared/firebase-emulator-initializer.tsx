'use client';

import { useEffect, useState } from 'react';
import { connectToEmulators, isUsingEmulators } from '@/lib/firebase-emulator';

/**
 * This component initializes Firebase emulators when in development mode
 * It should be included once in the app, preferably in the root layout
 */
export function FirebaseEmulatorInitializer() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Only initialize emulators once and only in development
    if (!initialized && process.env.NODE_ENV !== 'production') {
      connectToEmulators();
      setInitialized(true);
    }
  }, [initialized]);

  // Only render development mode indicator if using emulators
  if (initialized && isUsingEmulators() && process.env.NODE_ENV !== 'production') {
    return (
      <div className="fixed bottom-4 right-4 bg-yellow-500/90 text-black px-3 py-1 rounded-full text-xs font-medium z-50 shadow-lg flex items-center gap-1">
        <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
        <span>Firebase Emulators Active</span>
      </div>
    );
  }

  return null;
}
