"use client";

import auth from "@/lib/supabase-auth";
import { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Initial auth check
    const checkAuth = async () => {
      try {
        const currentUser = await auth.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          try {
            const userProfile = await auth.getUserProfile(currentUser.id);
            setProfile(userProfile);
          } catch (error) {
            console.error("Error fetching user profile:", error);
            // Create a fallback profile
            setProfile({
              id: currentUser.id,
              email: currentUser.email,
              displayName: currentUser.user_metadata?.displayName || 'User',
              role: 'operator',
              status: 'active',
              assignedBranchIds: []
            });
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    };

    checkAuth();

    // Set up auth state change listener only after initial check
    let subscription: { unsubscribe: () => void } | null = null;
    
    if (!subscription && authChecked) {
      const { data } = auth.onAuthStateChange(async (event, session) => {
        console.log("Auth state changed:", event, session);
        if (session?.user) {
          setUser(session.user);
          try {
            const profile = await auth.getUserProfile(session.user.id);
            setProfile(profile);
          } catch (error) {
            console.error("Error fetching user profile:", error);
            // Create a fallback profile
            setProfile({
              id: session.user.id,
              email: session.user.email,
              displayName: session.user.user_metadata?.displayName || 'User',
              role: 'operator',
              status: 'active',
              assignedBranchIds: []
            });
          }
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });
      
      subscription = data.subscription;
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [authChecked]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};