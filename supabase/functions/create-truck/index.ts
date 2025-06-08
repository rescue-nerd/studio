import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface RequestBody {
  truckNo: string;
  type: string;
  capacity?: string;
  ownerName: string;
  ownerPAN?: string;
  status?: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId: string;
}

interface TruckData {
  id: string;
  truck_no: string;
  type: string;
  capacity?: string;
  owner_name: string;
  owner_pan?: string;
  status: "Active" | "Inactive" | "Maintenance";
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
            details: 'You must be logged in to create a truck'
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
    
    if (!requestData.truckNo || !requestData.type || !requestData.ownerName || !requestData.assignedLedgerId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Missing required fields',
            details: 'Truck number, type, owner name, and assigned ledger ID are required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if truck number already exists
    const { data: existingTruck, error: checkError } = await supabaseClient
      .from('trucks')
      .select('id')
      .eq('truck_no', requestData.truckNo)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Error checking existing truck',
            details: checkError.message
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (existingTruck) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Truck already exists',
            details: 'A truck with this number already exists'
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

    // Insert new truck
    const { data: truck, error: insertError } = await supabaseClient
      .from('trucks')
      .insert({
        truck_no: requestData.truckNo,
        type: requestData.type,
        capacity: requestData.capacity,
        owner_name: requestData.ownerName,
        owner_pan: requestData.ownerPAN,
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
            message: 'Error creating truck',
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
        data: truck
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