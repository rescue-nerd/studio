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
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: data.user.id,
            email: data.user.email || `${data.user.id}@placeholder.com`,
            role: metadata.role || 'operator',
            displayName: metadata.displayName,
            assignedBranchIds: metadata.assignedBranchIds || [],
            status: metadata.status || 'active'
          }
        ]);
      if (profileError) throw profileError;
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
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Get user profile from users table
  async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user) {
            throw new Error('User not found');
          }
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert([
              {
                id: userId,
                email: userData.user.email || `${userId}@placeholder.com`,
                role: 'operator',
                status: 'active',
                assignedBranchIds: []
              }
            ])
            .select()
            .single();
          
          if (createError) throw createError;
          return newProfile as AuthUser;
        }
        throw error;
      }
      return data as AuthUser;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      throw error;
    }
  },

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<AuthUser>) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update user auth metadata
  async updateUserMetadata(userId: string, metadata: Partial<AuthUser>) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      { user_metadata: metadata }
    );
    if (error) throw error;
    return data;
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