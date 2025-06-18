import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, DELETE', // Added DELETE
  'Access-Control-Max-Age': '86400',
}

interface RequestBody {
  id: string;
}

const dependentTables = [
  // Assuming 'branch_id' is the common foreign key. Adjust if different.
  // For 'users', user mentioned "assignedBranchIds (array) or branchId".
  // This implementation assumes a direct 'branch_id' text/uuid reference for simplicity.
  // Array checks (e.g., using 'cs' for contains) would require knowing the exact array structure and type.
  { tableName: 'users', fkColumn: 'branch_id', displayName: 'users' },
  { tableName: 'trucks', fkColumn: 'branch_id', displayName: 'trucks' },
  { tableName: 'drivers', fkColumn: 'branch_id', displayName: 'drivers' },
  { tableName: 'parties', fkColumn: 'branch_id', displayName: 'parties' },
  { tableName: 'godowns', fkColumn: 'branch_id', displayName: 'godowns' },
  { tableName: 'biltis', fkColumn: 'branch_id', displayName: 'biltis' },
  // manifests has two columns: from_branch_id, to_branch_id - handled separately
  { tableName: 'goods_receipts', fkColumn: 'receiving_branch_id', displayName: 'goods receipts' }, // Assuming table name 'goods_receipts'
  { tableName: 'goods_deliveries', fkColumn: 'delivery_branch_id', displayName: 'goods deliveries' }, // Assuming table name 'goods_deliveries'
  { tableName: 'ledgers', fkColumn: 'branch_id', displayName: 'ledgers' },
  { tableName: 'daybooks', fkColumn: 'branch_id', displayName: 'daybooks' },
  { tableName: 'branch_settings', fkColumn: 'branch_id', displayName: 'branch-specific settings' } // Assuming table 'branch_settings'
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Unauthorized',
            details: 'You must be logged in to delete a branch'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse and validate request body
    const requestData: RequestBody = await req.json();
    
    if (!requestData.id) {
      return new Response(JSON.stringify({ success: false, error: { message: 'Missing required fields', details: 'Branch ID is required' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if branch exists and its current status
    const { data: currentBranch, error: fetchError } = await supabaseClient
      .from('branches')
      .select('id, status')
      .eq('id', requestData.id)
      .single();

    if (fetchError || !currentBranch) {
      return new Response(JSON.stringify({ success: false, error: { message: 'Branch not found', details: fetchError ? fetchError.message : 'The specified branch does not exist' } }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (currentBranch.status === 'Deleted') {
      return new Response(JSON.stringify({ success: true, message: 'Branch is already deleted.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Dependency checks
    for (const dep of dependentTables) {
      const { data, error: depCheckError, count } = await supabaseClient
        .from(dep.tableName)
        .select('id', { count: 'exact', head: true })
        .eq(dep.fkColumn, requestData.id)
        // Add status checks if dependent items also have soft delete, e.g. .neq('status', 'Deleted')
        // For now, any linkage blocks deletion.
      
      if (depCheckError && depCheckError.code !== 'PGRST116') { // PGRST116: no rows found, which is good here
         console.error(`Error checking ${dep.displayName}:`, depCheckError);
         return new Response(JSON.stringify({ success: false, error: { message: `Error checking branch associations with ${dep.displayName}`, details: depCheckError.message } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (count && count > 0) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Cannot delete branch', details: `This branch is referenced in active ${dep.displayName}. Please reassign or delete them first.` } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Special check for manifests (from_branch_id and to_branch_id)
    const manifestChecks = [
      { column: 'from_branch_id', name: 'manifests (as origin)'},
      { column: 'to_branch_id', name: 'manifests (as destination)'}
    ];
    for (const mCheck of manifestChecks) {
      const { count, error: manifestError } = await supabaseClient
        .from('manifests')
        .select('id', { count: 'exact', head: true })
        .eq(mCheck.column, requestData.id);
      
      if (manifestError && manifestError.code !== 'PGRST116') {
        console.error(`Error checking ${mCheck.name}:`, manifestError);
        return new Response(JSON.stringify({ success: false, error: { message: `Error checking branch associations with ${mCheck.name}`, details: manifestError.message } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (count && count > 0) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Cannot delete branch', details: `This branch is referenced in active ${mCheck.name}. Please reassign or delete them first.` } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }


    // Soft delete: Update status and set deleted_at, deleted_by
    const { error: softDeleteError } = await supabaseClient
      .from('branches')
      .update({
        status: 'Deleted', // Ensure 'Deleted' is a valid value in your party_status enum
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', requestData.id);

    if (softDeleteError) {
      return new Response(JSON.stringify({ success: false, error: { message: 'Error deleting branch', details: softDeleteError.message } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message: 'Branch marked as deleted successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})