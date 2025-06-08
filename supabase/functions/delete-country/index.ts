import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
}

interface DeleteCountryRequest {
  id: string;
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
    const { id } = await req.json() as DeleteCountryRequest

    // Validate request body
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Country ID is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if country exists
    const { data: existingCountry, error: checkError } = await supabaseClient
      .from('countries')
      .select('id')
      .eq('id', id)
      .single()

    if (checkError) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Error checking country existence' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!existingCountry) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Country not found' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if country has associated states
    const { data: states, error: statesError } = await supabaseClient
      .from('states')
      .select('id')
      .eq('country_id', id)
      .limit(1)

    if (statesError) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Error checking associated states' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (states && states.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Cannot delete country with associated states' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete country
    const { error: deleteError } = await supabaseClient
      .from('countries')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Error deleting country' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: { id } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: { message: 'Internal server error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})