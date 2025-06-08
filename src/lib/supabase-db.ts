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
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result as T;
  },

  async read<T>(table: string, id: string) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as T;
  },

  async update<T>(table: string, id: string, data: Partial<T>) {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result as T;
  },

  async delete(table: string, id: string) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
    if (error) throw error;
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
  },

  // Transaction operations
  async transaction<T>(operations: () => Promise<T>) {
    const { data, error } = await supabase.rpc('begin_transaction');
    if (error) throw error;

    try {
      const result = await operations();
      await supabase.rpc('commit_transaction');
      return result;
    } catch (error) {
      await supabase.rpc('rollback_transaction');
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
  },

  // Batch operations
  async batchCreate<T>(table: string, items: Partial<T>[]) {
    const { data, error } = await supabase
      .from(table)
      .insert(items)
      .select();
    if (error) throw error;
    return data as T[];
  },

  async batchUpdate<T>(table: string, items: { id: string; data: Partial<T> }[]) {
    const { data, error } = await supabase
      .from(table)
      .upsert(
        items.map(({ id, data }) => ({
          id,
          ...data,
        }))
      )
      .select();
    if (error) throw error;
    return data as T[];
  },

  async batchDelete(table: string, ids: string[]) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in('id', ids);
    if (error) throw error;
  },

  // Specific business operations
  async getUserProfile(userId: string): Promise<User> {
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
          if (!userData.user) {
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
          return newProfile;
        }
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      throw error;
    }
  },

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getBranches(): Promise<Branch[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  async getBranch(branchId: string): Promise<Branch> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single();
    if (error) throw error;
    return data;
  },

  async createBranch(branchData: Partial<Branch>): Promise<Branch> {
    const { data, error } = await supabase
      .from('branches')
      .insert(branchData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateBranch(branchId: string, updates: Partial<Branch>): Promise<Branch> {
    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', branchId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteBranch(branchId: string): Promise<void> {
    // First check if branch is assigned to any users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .contains('assignedBranchIds', [branchId])
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
  },

  async getDocumentNumberingConfig(
    documentType: DocumentType,
    branchId: string,
    fiscalYear: string
  ): Promise<DocumentNumberingConfig> {
    const { data, error } = await supabase
      .from('document_numbering_configs')
      .select('*')
      .eq('document_type', documentType)
      .eq('branch_id', branchId)
      .eq('fiscal_year', fiscalYear)
      .single();
    if (error) throw error;
    return data;
  },

  async updateDocumentNumberingConfig(
    configId: string,
    updates: Partial<DocumentNumberingConfig>
  ): Promise<DocumentNumberingConfig> {
    const { data, error } = await supabase
      .from('document_numbering_configs')
      .update(updates)
      .eq('id', configId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getDaybooks(branchId: string): Promise<Daybook[]> {
    const { data, error } = await supabase
      .from('daybooks')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getDaybook(daybookId: string): Promise<Daybook> {
    const { data, error } = await supabase
      .from('daybooks')
      .select('*')
      .eq('id', daybookId)
      .single();
    if (error) throw error;
    return data;
  },

  async createDaybook(daybookData: Partial<Daybook>): Promise<Daybook> {
    const { data, error } = await supabase
      .from('daybooks')
      .insert(daybookData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateDaybook(daybookId: string, updates: Partial<Daybook>): Promise<Daybook> {
    const { data, error } = await supabase
      .from('daybooks')
      .update(updates)
      .eq('id', daybookId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteDaybook(daybookId: string): Promise<void> {
    const { error } = await supabase
      .from('daybooks')
      .delete()
      .eq('id', daybookId);
    if (error) throw error;
  },
};

export default db;

// Sign in
await auth.signIn(email, password);

// Sign up
await auth.signUp(email, password, {
  role: 'operator',
  displayName: 'John Doe',
  assignedBranchIds: ['branch1', 'branch2']
});

// Get current user
const user = await auth.getCurrentUser();

// Update profile
await auth.updateUserProfile(userId, {
  displayName: 'New Name',
  assignedBranchIds: ['branch3']
});

// Create a new bilti
const bilti = await db.create('biltis', {
  miti: new Date(),
  nepaliMiti: '2080-12-15',
  consignorId: 'party1',
  consigneeId: 'party2',
  // ... other fields
});

// Query biltis
const biltis = await db.query('biltis', {
  filters: { branchId: 'branch1', status: 'pending' },
  orderBy: { column: 'created_at', ascending: false },
  limit: 10
});

// Subscribe to real-time updates
const unsubscribe = db.subscribe('biltis', (payload) => {
  console.log('Bilti updated:', payload.new);
}, {
  filters: { branchId: 'branch1' },
  event: 'UPDATE'
});

// Upload an attachment
const attachment = await storage.uploadAttachment(
  'bilti',
  biltiId,
  file,
  { description: 'Delivery receipt' }
);

// Get document attachments
const attachments = await storage.getDocumentAttachments('bilti', biltiId);

// Delete an attachment
await storage.deleteAttachment(attachmentId);

// Call the document number generation function
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-document-number`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      documentType: 'bilti',
      branchId: 'branch1',
      fiscalYear: '2080-81'
    })
  }
);

const { documentNumber } = await response.json(); 