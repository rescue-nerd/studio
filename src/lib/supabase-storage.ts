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
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, options);

    if (error) throw error;
    return data;
  },

  // Get a public URL for a file
  getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  // Download a file
  async downloadFile(bucket: string, path: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) throw error;
    return data;
  },

  // Delete a file
  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
  },

  // List files in a bucket
  async listFiles(bucket: string, path?: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path);

    if (error) throw error;
    return data;
  },

  // Create a signed URL for temporary access
  async createSignedUrl(bucket: string, path: string, expiresIn: number) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  },

  // Upload attachment for a document
  async uploadAttachment(
    documentType: string,
    documentId: string,
    file: File,
    metadata?: Record<string, any>
  ) {
    const path = `${documentType}/${documentId}/${file.name}`;
    const { data, error } = await supabase.storage
      .from('attachments')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    // Create attachment record in the database
    const { data: attachment, error: dbError } = await supabase
      .from('attachments')
      .insert({
        document_type: documentType,
        document_id: documentId,
        file_name: file.name,
        file_path: path,
        file_type: file.type,
        file_size: file.size,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (dbError) throw dbError;
    return attachment;
  },

  // Get attachments for a document
  async getDocumentAttachments(documentType: string, documentId: string) {
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('document_type', documentType)
      .eq('document_id', documentId);

    if (error) throw error;
    return data;
  },

  // Delete an attachment
  async deleteAttachment(attachmentId: string) {
    // Get attachment details
    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachmentId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('attachments')
      .remove([attachment.file_path]);

    if (storageError) throw storageError;

    // Delete from database
    const { error: dbError } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachmentId);

    if (dbError) throw dbError;
  },
};

export default storage; 