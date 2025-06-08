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
  truckNo?: string;
  type?: string;
  capacity?: string;
  ownerName?: string;
  ownerPAN?: string;
  status?: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId?: string;
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
            details: 'You must be logged in to update a truck'
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
            details: 'Truck ID is required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if truck exists
    const { data: existingTruck, error: checkError } = await supabaseClient
      .from('trucks')
      .select('id')
      .eq('id', requestData.id)
      .single()

    if (checkError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Truck not found',
            details: 'The specified truck does not exist'
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // If truck number is being updated, check for duplicates
    if (requestData.truckNo) {
      const { data: duplicateTruck, error: duplicateError } = await supabaseClient
        .from('trucks')
        .select('id')
        .eq('truck_no', requestData.truckNo)
        .neq('id', requestData.id)
        .single()

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              message: 'Error checking duplicate truck',
              details: duplicateError.message
            }
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (duplicateTruck) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              message: 'Truck number already exists',
              details: 'Another truck with this number already exists'
            }
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // If ledger account is being updated, check if it exists
    if (requestData.assignedLedgerId) {
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
    }

    // Update truck
    const { data: truck, error: updateError } = await supabaseClient
      .from('trucks')
      .update({
        truck_no: requestData.truckNo,
        type: requestData.type,
        capacity: requestData.capacity,
        owner_name: requestData.ownerName,
        owner_pan: requestData.ownerPAN,
        status: requestData.status,
        assigned_ledger_id: requestData.assignedLedgerId,
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
            message: 'Error updating truck',
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
        data: truck
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