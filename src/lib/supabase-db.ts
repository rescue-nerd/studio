import { supabase } from '@/lib/supabase';
import auth from '@/lib/supabase-auth';
import {
  Branch,
  User
} from '@/types/database';

// Base URL for your Supabase functions
const FUNCTIONS_URL = `${supabase.supabaseUrl}/functions/v1`;

// Helper function to get current session's access token
async function getAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    console.error('Error getting session or session not found:', error);
    throw new Error('User is not authenticated.');
  }
  return session.access_token;
}

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
      const accessToken = await getAccessToken();
      const response = await fetch(`${FUNCTIONS_URL}/get-branch`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching branches via function:', errorData);
        throw new Error(errorData.error?.message || 'Failed to fetch branches');
      }

      const result = await response.json();
      if (!result.success) {
        console.error('Error in get-branch function response:', result.error);
        throw new Error(result.error?.message || 'Failed to fetch branches from function');
      }
      // Map the data to match the expected Branch interface based on actual database schema
      return (result.data || []).map((branch: any) => ({
        id: branch.id,
        name: branch.name,
        location: branch.location, // Database column is 'location'
        branch_code: branch.branch_code,
        manager_name: branch.manager_name,
        manager_user_id: branch.manager_user_id,
        contact_email: branch.contact_email, // Database column is 'contact_email'
        contact_phone: branch.contact_phone, // Database column is 'contact_phone'
        status: branch.status, // String: 'Active' | 'Inactive' | 'Deleted'
        created_at: branch.created_at,
        created_by: branch.created_by,
        updated_at: branch.updated_at,
        updated_by: branch.updated_by,
        deleted_at: branch.deleted_at,
        deleted_by: branch.deleted_by,
      }));
    } catch (error) {
      console.error("Error fetching branches:", error);
      // Fallback or rethrow as appropriate for your error handling strategy
      throw error; 
    }
  },

  async getBranch(branchIdOrCode: string): Promise<Branch | null> {
    try {
      const accessToken = await getAccessToken();
      // Determine if it's an ID (UUID) or branch_code
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(branchIdOrCode);
      const paramName = isUuid ? 'id' : 'branch_code';
      
      const response = await fetch(`${FUNCTIONS_URL}/get-branch?${paramName}=${encodeURIComponent(branchIdOrCode)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null; // Not found
        const errorData = await response.json();
        console.error(`Error fetching branch ${branchIdOrCode} via function:`, errorData);
        throw new Error(errorData.error?.message || `Failed to fetch branch ${branchIdOrCode}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
         if (result.error?.message === 'Branch not found') return null;
        console.error('Error in get-branch function response or no data:', result.error);
        throw new Error(result.error?.message || `Failed to fetch branch ${branchIdOrCode} from function`);
      }
      
      const branch = result.data;
      // Map the data to match the expected Branch interface based on actual database schema
      return {
        id: branch.id,
        name: branch.name,
        location: branch.location, // Database column is 'location'
        branch_code: branch.branch_code,
        manager_name: branch.manager_name,
        manager_user_id: branch.manager_user_id,
        contact_email: branch.contact_email, // Database column is 'contact_email'
        contact_phone: branch.contact_phone, // Database column is 'contact_phone'
        status: branch.status, // String: 'Active' | 'Inactive' | 'Deleted'
        created_at: branch.created_at,
        created_by: branch.created_by,
        updated_at: branch.updated_at,
        updated_by: branch.updated_by,
        deleted_at: branch.deleted_at,
        deleted_by: branch.deleted_by,
      };
    } catch (error) {
      console.error(`Error fetching branch ${branchIdOrCode}:`, error);
      throw error;
    }
  },

  async createBranch(branchData: Partial<Omit<Branch, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'status' | 'isActive'> & { name: string; branch_code: string; }>): Promise<Branch> {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${FUNCTIONS_URL}/create-branch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(branchData),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('Error parsing error response for create branch:', parseError);
          throw new Error(`Failed to create branch - HTTP ${response.status}`);
        }
        console.error('Error creating branch via function:', errorData);
        throw new Error(errorData?.error?.message || errorData?.message || `Failed to create branch - HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        console.error('Error in create-branch function response or no data:', result.error);
        throw new Error(result.error?.message || 'Failed to create branch from function');
      }

      const branch = result.data;
      return {
        id: branch.id,
        name: branch.name,
        location: branch.location, // Database column is 'location'
        branch_code: branch.branch_code,
        manager_name: branch.manager_name,
        manager_user_id: branch.manager_user_id,
        contact_email: branch.contact_email, // Database column is 'contact_email'
        contact_phone: branch.contact_phone, // Database column is 'contact_phone'
        status: branch.status, // String: 'Active' | 'Inactive' | 'Deleted'
        created_at: branch.created_at,
        created_by: branch.created_by,
        updated_at: branch.updated_at,
        updated_by: branch.updated_by,
        deleted_at: branch.deleted_at,
        deleted_by: branch.deleted_by,
      };
    } catch (error) {
      console.error("Error creating branch:", error);
      throw error;
    }
  },

  async updateBranch(branchId: string, updates: Partial<Omit<Branch, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'status' | 'isActive'>>): Promise<Branch> {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${FUNCTIONS_URL}/update-branch?id=${encodeURIComponent(branchId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error(`Error parsing error response for branch ${branchId}:`, parseError);
          throw new Error(`Failed to update branch ${branchId} - HTTP ${response.status}`);
        }
        console.error(`Error updating branch ${branchId} via function:`, errorData);
        throw new Error(errorData?.error?.message || errorData?.message || `Failed to update branch ${branchId} - HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        console.error('Error in update-branch function response or no data:', result.error);
        throw new Error(result.error?.message || `Failed to update branch ${branchId} from function`);
      }

      const branch = result.data;
      return {
        id: branch.id,
        name: branch.name,
        location: branch.location, // Database column is 'location'
        branch_code: branch.branch_code,
        manager_name: branch.manager_name,
        manager_user_id: branch.manager_user_id,
        contact_email: branch.contact_email, // Database column is 'contact_email'
        contact_phone: branch.contact_phone, // Database column is 'contact_phone'
        status: branch.status, // String: 'Active' | 'Inactive' | 'Deleted'
        created_at: branch.created_at,
        created_by: branch.created_by,
        updated_at: branch.updated_at,
        updated_by: branch.updated_by,
        deleted_at: branch.deleted_at,
        deleted_by: branch.deleted_by,
      };
    } catch (error) {
      console.error(`Error updating branch ${branchId}:`, error);
      throw error;
    }
  },
  
  async deleteBranch(branchId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${FUNCTIONS_URL}/delete-branch?id=${encodeURIComponent(branchId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error deleting branch ${branchId} via function:`, errorData);
        throw new Error(errorData.error?.message || `Failed to delete branch ${branchId}`);
      }

      const result = await response.json();
      if (!result.success) {
        console.error('Error in delete-branch function response:', result.error);
        throw new Error(result.error?.message || `Failed to delete branch ${branchId} from function`);
      }
      return { success: true, message: result.message };
    } catch (error) {
      console.error(`Error deleting branch ${branchId}:`, error);
      throw error;
    }
  },

  // Location and Unit management functions
  async createCountry(countryData: { name: string }) {
    try {
      const response = await supabase.functions.invoke('create-country', {
        body: countryData
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error creating country:', error);
      throw error;
    }
  },

  async updateCountry(id: string, countryData: { name?: string }) {
    try {
      const response = await supabase.functions.invoke('update-country', {
        body: { id, ...countryData }
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error updating country:', error);
      throw error;
    }
  },

  async deleteCountry(id: string) {
    try {
      const response = await supabase.functions.invoke('delete-country', {
        body: { id }
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting country:', error);
      throw error;
    }
  },

  async createState(stateData: { name: string; countryId: string }) {
    try {
      const response = await supabase.functions.invoke('create-state', {
        body: stateData
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error creating state:', error);
      throw error;
    }
  },

  async updateState(id: string, stateData: { name?: string; countryId?: string }) {
    try {
      const response = await supabase.functions.invoke('update-state', {
        body: { id, ...stateData }
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error updating state:', error);
      throw error;
    }
  },

  async deleteState(id: string) {
    try {
      const response = await supabase.functions.invoke('delete-state', {
        body: { id }
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting state:', error);
      throw error;
    }
  },

  async createCity(cityData: { name: string; stateId: string }) {
    try {
      const response = await supabase.functions.invoke('create-city', {
        body: cityData
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error creating city:', error);
      throw error;
    }
  },

  async updateCity(id: string, cityData: { name?: string; stateId?: string }) {
    try {
      const response = await supabase.functions.invoke('update-city', {
        body: { id, ...cityData }
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error updating city:', error);
      throw error;
    }
  },

  async deleteCity(id: string) {
    try {
      const response = await supabase.functions.invoke('delete-city', {
        body: { id }
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting city:', error);
      throw error;
    }
  },

  async createUnit(unitData: { 
    name: string; 
    type: string; 
    symbol: string; 
    conversionFactor?: number; 
    isBaseUnit?: boolean 
  }) {
    try {
      const response = await supabase.functions.invoke('create-unit', {
        body: unitData
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error creating unit:', error);
      throw error;
    }
  },

  async updateUnit(id: string, unitData: { 
    name?: string; 
    type?: string; 
    symbol?: string; 
    conversionFactor?: number; 
    isBaseUnit?: boolean 
  }) {
    try {
      const response = await supabase.functions.invoke('update-unit', {
        body: { id, ...unitData }
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error updating unit:', error);
      throw error;
    }
  },

  async deleteUnit(id: string) {
    try {
      const response = await supabase.functions.invoke('delete-unit', {
        body: { id }
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting unit:', error);
      throw error;
    }
  },

  // Fetch functions for locations and units
  async fetchLocations() {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          id,
          name,
          type,
          parent_id,
          status,
          created_at,
          updated_at,
          parent:locations!parent_id(id, name, type)
        `)
        .eq('status', 'active')
        .order('type')
        .order('name');

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  },

  async fetchUnits() {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('type')
        .order('name');

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching units:', error);
      throw error;
    }
  }
};

export default db;