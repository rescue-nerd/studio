import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabase-config';

const supabase = createClient(
  getSupabaseConfig().supabaseUrl,
  getSupabaseConfig().supabaseAnonKey
);

export const storage = {
  // Upload a file
  async uploadFile(
    bucket: string,
    path: string,
    file: File,
    options?: { cacheControl?: string; upsert?: boolean }
  ) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, options);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  },

  // Get a public URL for a file
  getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  // Download a file
  async downloadFile(bucket: string, path: string) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  },

  // Delete a file
  async deleteFile(bucket: string, path: string) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  },

  // List files in a bucket
  async listFiles(bucket: string, path?: string) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error listing files:", error);
      throw error;
    }
  }
};

export default storage;