import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface RequestBody {
  name: string;
  location: string;
  branchCode?: string; // Added
  managerName?: string;
  managerUserId?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: "Active" | "Inactive"; // Default will be "Active"
}

interface BranchData {
  id: string;
  name: string;
  location: string;
  branch_code?: string | null; // Added
  manager_name?: string;
  manager_user_id?: string;
  contact_email?: string;
  contact_phone?: string;
  status: "Active" | "Inactive" | "Deleted"; // Updated to include all party_status
  created_at: string;
  created_by: string;
  updated_at?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

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
            details: 'You must be logged in to create a branch'
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
    
    if (!requestData.name || !requestData.location) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Missing required fields', details: 'Name and location are required' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate status if provided - should not be 'Deleted' on create
    if (requestData.status && requestData.status === 'Deleted') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Invalid status value', details: 'Status cannot be set to "Deleted" during creation.' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (requestData.status && !['Active', 'Inactive'].includes(requestData.status)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Invalid status value', details: 'Status must be either "Active" or "Inactive" during creation.' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format if provided
    if (requestData.contactEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(requestData.contactEmail)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: 'Invalid email format', details: 'Please provide a valid email address for contactEmail' }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if branch with same name already exists
    const { data: existingBranchName, error: checkNameError } = await supabaseClient
      .from('branches')
      .select('id')
      .eq('name', requestData.name)
      .neq('status', 'Deleted') // Only check against active/inactive branches
      .single();

    if (checkNameError && checkNameError.code !== 'PGRST116') { /* PGRST116: no rows found */
      return new Response(JSON.stringify({ success: false, error: { message: 'Error checking existing branch name', details: checkNameError.message } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (existingBranchName) {
      return new Response(JSON.stringify({ success: false, error: { message: 'Branch name already exists', details: 'A branch with this name already exists (and is not deleted).' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate and check uniqueness for branchCode if provided
    if (requestData.branchCode && typeof requestData.branchCode === 'string' && requestData.branchCode.trim() !== '') {
      const trimmedBranchCode = requestData.branchCode.trim();
      const { data: existingBranchCode, error: checkCodeError } = await supabaseClient
        .from('branches')
        .select('id')
        .eq('branch_code', trimmedBranchCode)
        .neq('status', 'Deleted') // Only check against active/inactive branches
        .single();

      if (checkCodeError && checkCodeError.code !== 'PGRST116') { /* PGRST116: no rows found */
        return new Response(JSON.stringify({ success: false, error: { message: 'Error checking existing branch code', details: checkCodeError.message } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (existingBranchCode) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Branch code already exists', details: 'A branch with this code already exists (and is not deleted).' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else if (requestData.branchCode !== undefined && requestData.branchCode !== null && requestData.branchCode.trim() === '') {
        // if branchCode is provided but is empty string, treat as null or reject. Here, we'll save as null.
        requestData.branchCode = null;
    }


    // Insert new branch
    const insertPayload: any = {
      name: requestData.name,
      location: requestData.location,
      branch_code: (requestData.branchCode && requestData.branchCode.trim() !== '') ? requestData.branchCode.trim() : null,
      manager_name: requestData.managerName,
      manager_user_id: requestData.managerUserId,
      contact_email: requestData.contactEmail,
      contact_phone: requestData.contactPhone,
      status: requestData.status || 'Active', // Default to 'Active'
      created_by: user.id,
      // created_at is set by DB default
      // updated_at, updated_by, deleted_at, deleted_by should be null on creation
      updated_at: null,
      updated_by: null,
      deleted_at: null,
      deleted_by: null,
    };

    const { data: branch, error: insertError } = await supabaseClient
      .from('branches')
      .insert(insertPayload)
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Error creating branch',
            details: insertError.message
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: branch
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

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