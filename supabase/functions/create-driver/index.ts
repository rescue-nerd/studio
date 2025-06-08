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
  licenseNo: string;
  contactNo: string;
  address?: string;
  joiningDate?: string; // ISO date string
  status?: "Active" | "Inactive" | "On Leave";
  assignedLedgerId: string;
}

interface DriverData {
  id: string;
  name: string;
  license_no: string;
  contact_no: string;
  address?: string;
  joining_date?: string;
  status: "Active" | "Inactive" | "On Leave";
  assigned_ledger_id: string;
  created_at: string;
  created_by: string;
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
            details: 'You must be logged in to create a driver'
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
    
    if (!requestData.name || !requestData.licenseNo || !requestData.contactNo || !requestData.assignedLedgerId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Missing required fields',
            details: 'Name, license number, contact number, and assigned ledger ID are required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if license number already exists
    const { data: existingDriver, error: checkError } = await supabaseClient
      .from('drivers')
      .select('id')
      .eq('license_no', requestData.licenseNo)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Error checking existing driver',
            details: checkError.message
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (existingDriver) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Driver already exists',
            details: 'A driver with this license number already exists'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if ledger account exists
    const { data: ledgerAccount, error: ledgerError } = await supabaseClient
      .from('ledger_accounts')
      .select('id')
      .eq('id', requestData.assignedLedgerId)
      .single()

    if (ledgerError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Invalid ledger account',
            details: 'The specified ledger account does not exist'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Insert new driver
    const { data: driver, error: insertError } = await supabaseClient
      .from('drivers')
      .insert({
        name: requestData.name,
        license_no: requestData.licenseNo,
        contact_no: requestData.contactNo,
        address: requestData.address,
        joining_date: requestData.joiningDate,
        status: requestData.status || 'Active',
        assigned_ledger_id: requestData.assignedLedgerId,
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Error creating driver',
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
        data: driver
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