import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
}

interface UpdateUnitRequest {
  id: string;
  name: string;
  symbol: string;
  type: "Weight" | "Distance" | "Volume" | "Other";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'No authorization header' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get user session
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Unauthorized' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { id, name, symbol, type } = await req.json() as UpdateUnitRequest

    // Validate request body
    if (!id || !name || !symbol || !type) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'ID, name, symbol, and type are required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if unit exists
    const { data: existingUnit, error: checkError } = await supabaseClient
      .from('units')
      .select('id')
      .eq('id', id)
      .single()

    if (checkError) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Error checking unit existence' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!existingUnit) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Unit not found' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if new symbol conflicts with existing unit
    const { data: symbolConflict, error: symbolError } = await supabaseClient
      .from('units')
      .select('id')
      .eq('symbol', symbol)
      .neq('id', id)
      .single()

    if (symbolError && symbolError.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Error checking symbol uniqueness' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (symbolConflict) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Unit symbol already exists' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update unit
    const { data: unit, error: updateError } = await supabaseClient
      .from('units')
      .update({ name, symbol, type })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Error updating unit' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: unit }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: { message: 'Internal server error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})