import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabase-config';

const supabase = createClient(
  getSupabaseConfig().supabaseUrl,
  getSupabaseConfig().supabaseAnonKey
);

export interface AuthUser {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'operator';
  displayName?: string;
  assignedBranchIds?: string[];
  status: 'active' | 'inactive' | 'disabled';
}

export const auth = {
  // Sign in with email and password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Sign up with email and password
  async signUp(email: string, password: string, metadata: Partial<AuthUser>) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    if (error) throw error;

    // Create user profile in users table
    if (data.user) {
      try {
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: data.user.email || `${data.user.id}@placeholder.com`,
              role: metadata.role || 'operator',
              display_name: metadata.displayName,
              assigned_branch_ids: metadata.assignedBranchIds || [],
              status: metadata.status || 'active'
            }
          ]);
        if (profileError) console.error("Error creating user profile:", profileError);
      } catch (err) {
        console.error("Error in user profile creation:", err);
        // Continue even if profile creation fails - auth is more important
      }
    }

    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current user
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        // Return null instead of throwing error when session is missing
        console.log("Auth session missing or invalid");
        return null;
      }
      return user;
    } catch (error) {
      console.log("Error getting current user:", error);
      return null;
    }
  },

  // Get user profile from users table
  async getUserProfile(userId: string) {
    try {
      // First try to get from auth metadata as a fallback
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.log('Error getting auth user:', authError);
        return this.createFallbackProfile(userId);
      }
      
      // Try to get from users table
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          // If table doesn't exist or other error, use auth metadata
          console.log('Error fetching from users table:', error);
          return this.createFallbackProfile(userId, user);
        }
        
        // If no data found, create fallback profile
        if (!data) {
          console.log('No user profile found in database, creating fallback');
          return this.createFallbackProfile(userId, user);
        }
        
        return {
          id: data.id,
          email: data.email,
          displayName: data.display_name,
          role: data.role,
          assignedBranchIds: data.assigned_branch_ids || [],
          status: data.status,
        };
      } catch (dbError) {
        console.log('Database error in getUserProfile:', dbError);
        return this.createFallbackProfile(userId, user);
      }
    } catch (error) {
      console.log('Error in getUserProfile:', error);
      return this.createFallbackProfile(userId);
    }
  },

  // Create a fallback profile when the users table doesn't exist
  createFallbackProfile(userId: string, authUser?: any): AuthUser {
    return {
      id: userId,
      email: authUser?.email || `${userId}@placeholder.com`,
      role: 'operator',
      displayName: authUser?.user_metadata?.displayName || 'User',
      status: 'active' as const,
      assignedBranchIds: []
    };
  },

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<AuthUser>) {
    try {
      // Try to update in users table
      try {
        const { data, error } = await supabase
          .from('users')
          .update({
            display_name: updates.displayName,
            enable_email_notifications: updates.enableEmailNotifications,
            dark_mode_enabled: updates.darkModeEnabled,
            auto_data_sync_enabled: updates.autoDataSyncEnabled,
            status: updates.status,
            role: updates.role,
            assigned_branch_ids: updates.assignedBranchIds,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .maybeSingle();
          
        if (error) {
          console.log("Error updating user profile in database:", error);
          // Fall back to updating auth metadata
          return this.updateUserMetadata(userId, updates);
        }
        
        // If no data found, fall back to updating auth metadata
        if (!data) {
          console.log("No user profile found to update, falling back to auth metadata");
          return this.updateUserMetadata(userId, updates);
        }
        
        return {
          id: data.id,
          email: data.email,
          displayName: data.display_name,
          role: data.role,
          assignedBranchIds: data.assigned_branch_ids || [],
          status: data.status,
        };
      } catch (dbError) {
        console.log("Database error in updateUserProfile:", dbError);
        return this.updateUserMetadata(userId, updates);
      }
    } catch (error) {
      console.log("Error in updateUserProfile:", error);
      // Return the updates anyway to prevent UI issues
      return { id: userId, ...updates } as AuthUser;
    }
  },

  // Update user auth metadata
  async updateUserMetadata(userId: string, metadata: Partial<AuthUser>) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: metadata
      });
      if (error) throw error;
      return { ...data.user.user_metadata, id: userId, email: data.user.email } as AuthUser;
    } catch (error) {
      console.log("Error updating user metadata:", error);
      // Return the updates anyway to prevent UI issues
      return { id: userId, ...metadata } as AuthUser;
    }
  },

  // Reset password
  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return data;
  },

  // Update password
  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    return data;
  },

  // Subscribe to auth state changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export default auth;