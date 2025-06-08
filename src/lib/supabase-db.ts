import auth from '@/lib/supabase-auth';
import storage from '@/lib/supabase-storage';
import {
  Branch,
  Daybook,
  DocumentNumberingConfig,
  DocumentType,
  User
} from '@/types/database';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabase-config';

// Initialize Supabase client
const config = getSupabaseConfig();
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

export const db = {
  // Generic CRUD operations
  async create<T>(table: string, data: Partial<T>) {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result as T;
    } catch (error) {
      console.error(`Error creating record in ${table}:`, error);
      throw error;
    }
  },

  async read<T>(table: string, id: string) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as T;
    } catch (error) {
      console.error(`Error reading record from ${table}:`, error);
      throw error;
    }
  },

  async update<T>(table: string, id: string, data: Partial<T>) {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result as T;
    } catch (error) {
      console.error(`Error updating record in ${table}:`, error);
      throw error;
    }
  },

  async delete(table: string, id: string) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error(`Error deleting record from ${table}:`, error);
      throw error;
    }
  },

  // Query operations
  async query<T>(
    table: string,
    options: {
      select?: string;
      filters?: Record<string, any>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      let query = supabase.from(table).select(options.select || '*');

      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true,
        });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as T[];
    } catch (error) {
      console.error(`Error querying ${table}:`, error);
      return [] as T[]; // Return empty array instead of throwing to prevent UI crashes
    }
  },

  // Transaction operations
  async transaction<T>(operations: () => Promise<T>) {
    try {
      // Note: Supabase doesn't have true transactions in the JS client
      // This is a placeholder for future implementation
      return await operations();
    } catch (error) {
      console.error("Transaction error:", error);
      throw error;
    }
  },

  // Real-time subscriptions
  subscribe<T>(
    table: string,
    callback: (payload: { new: T; old: T; eventType: 'INSERT' | 'UPDATE' | 'DELETE' }) => void,
    options?: {
      filters?: Record<string, any>;
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    }
  ) {
    try {
      let subscription = supabase
        .channel(`${table}_changes`)
        .on(
          'postgres_changes',
          {
            event: options?.event || '*',
            schema: 'public',
            table: table,
            filter: options?.filters ? Object.entries(options.filters).map(([key, value]) => `${key}=eq.${value}`).join('&') : undefined,
          },
          (payload: { new: T; old: T; eventType: 'INSERT' | 'UPDATE' | 'DELETE' }) => {
            callback({
              new: payload.new,
              old: payload.old,
              eventType: payload.eventType,
            });
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error(`Error subscribing to ${table}:`, error);
      return () => {}; // Return empty function to prevent errors
    }
  },

  // Specific business operations
  async getUserProfile(userId: string): Promise<User> {
    try {
      // Try to get from auth metadata as a fallback
      const userData = await auth.getCurrentUser();
      
      // Try to get from users table
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          // If table doesn't exist or other error, use auth metadata
          console.warn('Error fetching from users table:', error);
          return {
            id: userId,
            email: userData?.email || `${userId}@placeholder.com`,
            role: 'operator',
            displayName: userData?.user_metadata?.displayName || 'User',
            status: 'active' as const,
            assignedBranchIds: []
          };
        }
        
        return data;
      } catch (dbError) {
        console.error('Database error in getUserProfile:', dbError);
        return {
          id: userId,
          email: userData?.email || `${userId}@placeholder.com`,
          role: 'operator',
          displayName: userData?.user_metadata?.displayName || 'User',
          status: 'active' as const,
          assignedBranchIds: []
        };
      }
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return {
        id: userId,
        email: `${userId}@placeholder.com`,
        role: 'operator',
        status: 'active' as const,
        assignedBranchIds: []
      };
    }
  },

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      if (error) {
        console.warn("Error updating user profile:", error);
        // Return the updates anyway to prevent UI issues
        return { id: userId, ...updates } as User;
      }
      return data;
    } catch (error) {
      console.error("Error in updateUserProfile:", error);
      // Return the updates anyway to prevent UI issues
      return { id: userId, ...updates } as User;
    }
  },

  async getBranches(): Promise<Branch[]> {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching branches:", error);
      return []; // Return empty array instead of throwing
    }
  },

  async getBranch(branchId: string): Promise<Branch> {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', branchId)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error fetching branch ${branchId}:`, error);
      throw error;
    }
  },

  async createBranch(branchData: Partial<Branch>): Promise<Branch> {
    try {
      const { data, error } = await supabase
        .from('branches')
        .insert({
          ...branchData,
          created_at: new Date().toISOString(),
          created_by: 'system' // Ideally this would be the current user's ID
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating branch:", error);
      throw error;
    }
  },

  async updateBranch(branchId: string, updates: Partial<Branch>): Promise<Branch> {
    try {
      const { data, error } = await supabase
        .from('branches')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', branchId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error updating branch ${branchId}:`, error);
      throw error;
    }
  },

  async deleteBranch(branchId: string): Promise<void> {
    try {
      // First check if branch is assigned to any users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .contains('assigned_branch_ids', [branchId])
        .limit(1);

      if (usersError) throw usersError;
      if (users && users.length > 0) {
        throw new Error('Cannot delete branch because it is assigned to users. Remove all assignments first.');
      }

      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);
      if (error) throw error;
    } catch (error) {
      console.error(`Error deleting branch ${branchId}:`, error);
      throw error;
    }
  }
};

export default db;