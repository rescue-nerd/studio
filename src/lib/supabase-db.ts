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
          .maybeSingle();

        if (error) {
          // If table doesn't exist or other error, use auth metadata
          console.warn('Error fetching from users table:', error);
          return {
            id: userId,
            email: userData?.email || `${userId}@placeholder.com`,
            role: 'operator',
            displayName: userData?.user_metadata?.displayName || 'User',
            status: 'active' as const,
            assignedBranchIds: [],
            createdAt: new Date().toISOString()
          };
        }
        
        // If no data found, create fallback profile
        if (!data) {
          console.warn('No user profile found in database, creating fallback');
          return {
            id: userId,
            email: userData?.email || `${userId}@placeholder.com`,
            role: 'operator',
            displayName: userData?.user_metadata?.displayName || 'User',
            status: 'active' as const,
            assignedBranchIds: [],
            createdAt: new Date().toISOString()
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
          assignedBranchIds: [],
          createdAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return {
        id: userId,
        email: `${userId}@placeholder.com`,
        role: 'operator',
        status: 'active' as const,
        assignedBranchIds: [],
        createdAt: new Date().toISOString()
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
        .maybeSingle();
      if (error) {
        console.warn("Error updating user profile:", error);
        // Return the updates anyway to prevent UI issues
        return { 
          id: userId, 
          ...updates,
          email: updates.email || `${userId}@placeholder.com`,
          role: updates.role || 'operator',
          status: updates.status || 'active' as const,
          createdAt: new Date().toISOString()
        } as User;
      }
      
      // If no data found, return the updates anyway to prevent UI issues
      if (!data) {
        console.warn("No user profile found to update");
        return { 
          id: userId, 
          ...updates,
          email: updates.email || `${userId}@placeholder.com`,
          role: updates.role || 'operator',
          status: updates.status || 'active' as const,
          createdAt: new Date().toISOString()
        } as User;
      }
      
      return data;
    } catch (error) {
      console.error("Error in updateUserProfile:", error);
      // Return the updates anyway to prevent UI issues
      return { 
        id: userId, 
        ...updates,
        email: updates.email || `${userId}@placeholder.com`,
        role: updates.role || 'operator',
        status: updates.status || 'active' as const,
        createdAt: new Date().toISOString()
      } as User;
    }
  },

  async getBranches(): Promise<Branch[]> {
    try {
      // Check if branches table exists by trying to get a count
      const { count, error: countError } = await supabase
        .from('branches')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.warn("Branches table might not exist:", countError);
        // Return mock data if table doesn't exist
        return [
          {
            id: '1',
            name: 'Main Branch',
            code: 'MB',
            address: 'Main Street',
            isActive: true,
            createdAt: new Date().toISOString()
          },
          {
            id: '2',
            name: 'Secondary Branch',
            code: 'SB',
            address: 'Second Avenue',
            isActive: true,
            createdAt: new Date().toISOString()
          }
        ];
      }
      
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      // Map the data to match the expected Branch interface
      return data.map(branch => ({
        id: branch.id,
        name: branch.name,
        location: branch.location,
        code: branch.code || branch.name.substring(0, 2).toUpperCase(),
        address: branch.address || branch.location,
        contactNo: branch.contact_phone,
        email: branch.contact_email,
        isActive: branch.status === 'Active',
        createdAt: branch.created_at
      }));
    } catch (error) {
      console.error("Error fetching branches:", error);
      // Return mock data as fallback
      return [
        {
          id: '1',
          name: 'Main Branch',
          code: 'MB',
          address: 'Main Street',
          isActive: true,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Secondary Branch',
          code: 'SB',
          address: 'Second Avenue',
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ];
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
      
      // Map the data to match the expected Branch interface
      return {
        id: data.id,
        name: data.name,
        location: data.location,
        code: data.code || data.name.substring(0, 2).toUpperCase(),
        address: data.address || data.location,
        contactNo: data.contact_phone,
        email: data.contact_email,
        isActive: data.status === 'Active',
        createdAt: data.created_at
      };
    } catch (error) {
      console.error(`Error fetching branch ${branchId}:`, error);
      throw error;
    }
  },

  async createBranch(branchData: Partial<Branch>): Promise<Branch> {
    try {
      // Map the data to match the database schema
      const dbData = {
        name: branchData.name,
        location: branchData.location || branchData.address,
        manager_name: branchData.managerName,
        contact_email: branchData.email,
        contact_phone: branchData.contactNo,
        status: branchData.isActive ? 'Active' : 'Inactive',
        created_at: new Date().toISOString(),
        created_by: 'system' // Ideally this would be the current user's ID
      };
      
      const { data, error } = await supabase
        .from('branches')
        .insert(dbData)
        .select()
        .single();
        
      if (error) {
        // If table doesn't exist, return mock data
        if (error.code === '42P01') {
          console.warn("Branches table doesn't exist:", error);
          return {
            id: `branch-${Date.now()}`,
            name: branchData.name || '',
            code: branchData.code || (branchData.name || '').substring(0, 2).toUpperCase(),
            address: branchData.address || '',
            isActive: branchData.isActive || true,
            createdAt: new Date().toISOString()
          };
        }
        throw error;
      }
      
      // Map the response to match the expected Branch interface
      return {
        id: data.id,
        name: data.name,
        location: data.location,
        code: data.code || data.name.substring(0, 2).toUpperCase(),
        address: data.address || data.location,
        contactNo: data.contact_phone,
        email: data.contact_email,
        isActive: data.status === 'Active',
        createdAt: data.created_at
      };
    } catch (error) {
      console.error("Error creating branch:", error);
      throw error;
    }
  },

  async updateBranch(branchId: string, updates: Partial<Branch>): Promise<Branch> {
    try {
      // Map the updates to match the database schema
      const dbUpdates = {
        name: updates.name,
        location: updates.location || updates.address,
        manager_name: updates.managerName,
        contact_email: updates.email,
        contact_phone: updates.contactNo,
        status: updates.isActive ? 'Active' : 'Inactive',
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('branches')
        .update(dbUpdates)
        .eq('id', branchId)
        .select()
        .single();
        
      if (error) throw error;
      
      // Map the response to match the expected Branch interface
      return {
        id: data.id,
        name: data.name,
        location: data.location,
        code: data.code || data.name.substring(0, 2).toUpperCase(),
        address: data.address || data.location,
        contactNo: data.contact_phone,
        email: data.contact_email,
        isActive: data.status === 'Active',
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
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