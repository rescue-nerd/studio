import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface RequestBody {
  id: string;
  name?: string;
  location?: string;
  managerName?: string;
  managerUserId?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: "Active" | "Inactive";
}

interface BranchData {
  id: string;
  name: string;
  location: string;
  manager_name?: string;
  manager_user_id?: string;
  contact_email?: string;
  contact_phone?: string;
  status: "Active" | "Inactive";
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

    // Parse and validate request body
    const requestData: RequestBody = await req.json()
    
    if (!requestData.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Missing required fields',
            details: 'Branch ID is required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if branch exists
    const { data: existingBranch, error: checkError } = await supabaseClient
      .from('branches')
      .select('id')
      .eq('id', requestData.id)
      .single()

    if (checkError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Branch not found',
            details: 'The specified branch does not exist'
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // If name is being updated, check for duplicates
    if (requestData.name) {
      const { data: duplicateBranch, error: duplicateError } = await supabaseClient
        .from('branches')
        .select('id')
        .eq('name', requestData.name)
        .neq('id', requestData.id)
        .single()

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              message: 'Error checking duplicate branch',
              details: duplicateError.message
            }
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (duplicateBranch) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              message: 'Branch name already exists',
              details: 'Another branch with this name already exists'
            }
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Update branch
    const { data: branch, error: updateError } = await supabaseClient
      .from('branches')
      .update({
        name: requestData.name,
        location: requestData.location,
        manager_name: requestData.managerName,
        manager_user_id: requestData.managerUserId,
        contact_email: requestData.contactEmail,
        contact_phone: requestData.contactPhone,
        status: requestData.status,
        updated_by: user.id
      })
      .eq('id', requestData.id)
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