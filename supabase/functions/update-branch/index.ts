import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, PUT', // Added PUT
  'Access-Control-Max-Age': '86400',
}

interface RequestBody {
  id: string;
  name?: string;
  location?: string;
  branchCode?: string; // Added
  managerName?: string;
  managerUserId?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: "Active" | "Inactive"; // Cannot set to "Deleted" via this function
}

interface BranchData { // Assuming this is for the response
  id: string;
  name: string;
  location: string;
  branch_code?: string | null; // Added
  // ... other fields from your branches table
  status: "Active" | "Inactive" | "Deleted";
  updated_at: string;
  updated_by: string;
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
            details: 'You must be logged in to update a branch'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get branch ID from query parameters
    const url = new URL(req.url);
    const branchIdFromQuery = url.searchParams.get('id');

    if (!branchIdFromQuery) {
      return new Response(JSON.stringify({ success: false, error: { message: 'Missing required fields', details: 'Branch ID is required in query parameters' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse request body for update data
    const updatesFromBody: Omit<RequestBody, 'id'> = await req.json();
    
    // Fetch current branch to check status and current branch_code
    const { data: currentBranch, error: fetchError } = await supabaseClient
      .from('branches')
      .select('status, branch_code')
      .eq('id', branchIdFromQuery) // Use ID from query
      .single();

    if (fetchError || !currentBranch) {
      return new Response(JSON.stringify({ success: false, error: { message: 'Branch not found', details: fetchError ? fetchError.message : 'The specified branch does not exist' } }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (currentBranch.status === 'Deleted') {
      return new Response(JSON.stringify({ success: false, error: { message: 'Cannot update deleted branch', details: 'This branch has been deleted and cannot be modified.' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Validate status if provided in body
    if (updatesFromBody.status && updatesFromBody.status === 'Deleted') {
      return new Response(JSON.stringify({ success: false, error: { message: 'Invalid status value', details: 'Status cannot be set to "Deleted" via update. Use the delete-branch function.'}}), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
    if (updatesFromBody.status && !['Active', 'Inactive'].includes(updatesFromBody.status)) {
      return new Response(JSON.stringify({ success: false, error: { message: 'Invalid status value', details: 'Status must be either "Active" or "Inactive".'}}), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Validate email format if provided in body
    if (updatesFromBody.contactEmail !== undefined && updatesFromBody.contactEmail !== null) {
      if(updatesFromBody.contactEmail === '') { // Allow clearing the email
         // valid
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updatesFromBody.contactEmail)) {
          return new Response(JSON.stringify({ success: false, error: { message: 'Invalid email format', details: 'Please provide a valid email address for contactEmail or an empty string to clear it.'}}), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }
      }
    }

    // If name is being updated, check for duplicates (excluding current branch and deleted branches)
    if (updatesFromBody.name) {
      const { data: duplicateBranchName, error: duplicateNameError } = await supabaseClient
        .from('branches')
        .select('id')
        .eq('name', updatesFromBody.name)
        .neq('id', branchIdFromQuery) // Use ID from query
        .neq('status', 'Deleted')
        .single();
      if (duplicateNameError && duplicateNameError.code !== 'PGRST116') { /* PGRST116: no rows found */
        return new Response(JSON.stringify({ success: false, error: { message: 'Error checking duplicate branch name', details: duplicateNameError.message } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (duplicateBranchName) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Branch name already exists', details: 'Another active branch with this name already exists.' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // If branchCode is being updated, check for duplicates
    if (updatesFromBody.branchCode !== undefined && updatesFromBody.branchCode !== null && updatesFromBody.branchCode.trim() !== currentBranch.branch_code) {
        const trimmedBranchCode = updatesFromBody.branchCode.trim();
        if (trimmedBranchCode === '') { // Setting to null/empty
            // This is fine, will be set to null later
        } else {
            const { data: duplicateBranchCode, error: duplicateCodeError } = await supabaseClient
            .from('branches')
            .select('id')
            .eq('branch_code', trimmedBranchCode)
            .neq('id', branchIdFromQuery) // Use ID from query
            .neq('status', 'Deleted')
            .single();
            if (duplicateCodeError && duplicateCodeError.code !== 'PGRST116') { /* PGRST116: no rows found */
            return new Response(JSON.stringify({ success: false, error: { message: 'Error checking duplicate branch code', details: duplicateCodeError.message } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            if (duplicateBranchCode) {
            return new Response(JSON.stringify({ success: false, error: { message: 'Branch code already exists', details: 'Another active branch with this code already exists.' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }
    }


    // Construct update object for partial updates
    const updateObject: { [key: string]: any } = {};
    if (updatesFromBody.name !== undefined) updateObject.name = updatesFromBody.name;
    // Ensure the field name matches the database column 'location'
    if (updatesFromBody.location !== undefined) updateObject.location = updatesFromBody.location; 
    if (updatesFromBody.branchCode !== undefined) {
        updateObject.branch_code = (updatesFromBody.branchCode && updatesFromBody.branchCode.trim() !== '') ? updatesFromBody.branchCode.trim() : null;
    }
    if (updatesFromBody.managerName !== undefined) updateObject.manager_name = updatesFromBody.managerName;
    if (updatesFromBody.managerUserId !== undefined) updateObject.manager_user_id = updatesFromBody.managerUserId;
    if (updatesFromBody.contactEmail !== undefined) updateObject.contact_email = updatesFromBody.contactEmail === '' ? null : updatesFromBody.contactEmail;
    if (updatesFromBody.contactPhone !== undefined) updateObject.contact_phone = updatesFromBody.contactPhone;
    if (updatesFromBody.status !== undefined) updateObject.status = updatesFromBody.status;

    if (Object.keys(updateObject).length === 0) {
      return new Response(JSON.stringify({ success: false, error: { message: 'No updateable fields provided', details: 'Please provide at least one field to update.' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    updateObject.updated_by = user.id;
    updateObject.updated_at = new Date().toISOString();

    const { data: branch, error: updateError } = await supabaseClient
      .from('branches')
      .update(updateObject)
      .eq('id', branchIdFromQuery) // Use ID from query
      .select()
      .single()

    if (updateError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Error updating branch',
            details: updateError.message
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
        status: 200,
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