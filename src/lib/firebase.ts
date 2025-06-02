
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
// TODO: Add SDKs for other Firebase products you want to use (e.g., getAuth for Authentication)
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For a real application, consider using environment variables for this configuration
const firebaseConfig = {
  apiKey: "AIzaSyBpzB4yM4qvK7TXYc0LA8F4d_jVx8cGjks",
  authDomain: "gorkhatrans.firebaseapp.com",
  projectId: "gorkhatrans",
  storageBucket: "gorkhatrans.appspot.com",
  messagingSenderId: "224119383159",
  appId: "1:224119383159:web:e02ca988722b8909759272"
};

// Initialize Firebase
let app: FirebaseApp;
let db: Firestore;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

db = getFirestore(app);

export { app, db };
