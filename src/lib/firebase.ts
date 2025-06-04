
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseConfig, getFirebaseRegion } from "./firebase-config";
// https://firebase.google.com/docs/web/setup#available-libraries

// Get Firebase configuration from environment-aware config utility
const firebaseConfig = getFirebaseConfig();

// Initialize Firebase
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let functions: Functions;
let storage: FirebaseStorage;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

db = getFirestore(app);
auth = getAuth(app);
functions = getFunctions(app, getFirebaseRegion()); // Get region from environment config
storage = getStorage(app);

// Enable offline persistence for Firestore when in browser environment
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence could not be enabled: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence is not available in this environment');
    }
  });
}

export { app, db, auth, functions, storage };
