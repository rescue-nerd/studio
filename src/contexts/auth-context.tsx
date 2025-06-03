
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth } from "@/lib/firebase";
import type { User as FirestoreUser } from "@/types/firestore"; // Your Firestore user type

interface AuthContextType {
  user: FirebaseUser | null;
  firestoreUser: FirestoreUser | null; // Optional: store more detailed user profile from Firestore
  loading: boolean;
  // Add more auth-related functions if needed, e.g., fetchFirestoreUser
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<FirestoreUser | null>(null); // Example for richer profile
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Optional: Fetch more user details from Firestore if you store them separately
        // e.g., const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        // if (userDoc.exists()) setFirestoreUser(userDoc.data() as FirestoreUser);
      } else {
        setFirestoreUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, firestoreUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
