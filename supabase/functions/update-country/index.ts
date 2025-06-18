import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface RequestBody {
  name?: string;
  code?: string;
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
            details: 'You must be logged in to update a country'
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

    // Parse request body for update data
    const updates: RequestBody = await req.json();
    
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

    // Validate name if being updated
    if (updates.name) {
      if (updates.name.length < 2 || updates.name.length > 100) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: 'Invalid name length', details: 'Name must be between 2 and 100 characters' }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for duplicate names (excluding current country)
      const { data: duplicateCountry, error: duplicateError } = await supabaseClient
        .from('locations')
        .select('id')
        .eq('name', updates.name)
        .eq('type', 'country')
        .neq('id', countryId)
        .single();

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Error checking duplicate country name', details: duplicateError.message } 
        }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (duplicateCountry) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Country name already exists', details: 'Another country with this name already exists.' } 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Check if country is being used by states before allowing updates
    const { data: dependentStates, error: statesError } = await supabaseClient
      .from('locations')
      .select('id')
      .eq('parent_id', countryId)
      .eq('type', 'state')
      .limit(1);

    if (statesError) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Error checking dependencies', details: statesError.message } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // If there are dependent states and we're changing the name significantly, warn but allow
    if (dependentStates && dependentStates.length > 0 && updates.name && updates.name !== currentCountry.name) {
      console.log(`Warning: Updating country name for ${countryId} which has ${dependentStates.length} dependent states`);
    }

    // Construct update object
    const updateObject: { [key: string]: any } = {};
    if (updates.name !== undefined) updateObject.name = updates.name.trim();
    
    if (Object.keys(updateObject).length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'No updateable fields provided', details: 'Please provide at least one field to update.' } 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    updateObject.updated_by = user.id;
    updateObject.updated_at = new Date().toISOString();

    const { data: country, error: updateError } = await supabaseClient
      .from('locations')
      .update(updateObject)
      .eq('id', countryId)
      .eq('type', 'country')
      .select()
      .single()

    if (updateError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Error updating country',
            details: updateError.message
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
        data: country
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
