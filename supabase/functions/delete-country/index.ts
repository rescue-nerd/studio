import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
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
            details: 'You must be logged in to delete a country'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get country ID from query parameters
    const url = new URL(req.url);
    const countryId = url.searchParams.get('id');

    if (!countryId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Missing required fields', details: 'Country ID is required in query parameters' } 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Fetch current country to verify it exists and is a country
    const { data: currentCountry, error: fetchError } = await supabaseClient
      .from('locations')
      .select('*')
      .eq('id', countryId)
      .eq('type', 'country')
      .single();

    if (fetchError || !currentCountry) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Country not found', details: fetchError ? fetchError.message : 'The specified country does not exist' } 
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check if country has dependent states (prevent deletion if there are dependencies)
    const { data: dependentStates, error: statesError } = await supabaseClient
      .from('locations')
      .select('id, name')
      .eq('parent_id', countryId)
      .eq('type', 'state');

    if (statesError) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Error checking dependencies', details: statesError.message } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (dependentStates && dependentStates.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { 
          message: 'Cannot delete country with dependent states', 
          details: `This country has ${dependentStates.length} state(s) that must be deleted first.`,
          dependencies: dependentStates
        } 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Delete the country
    const { error: deleteError } = await supabaseClient
      .from('locations')
      .delete()
      .eq('id', countryId)
      .eq('type', 'country');

    if (deleteError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Error deleting country',
            details: deleteError.message
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Country "${currentCountry.name}" deleted successfully`
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
