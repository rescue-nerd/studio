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
            details: 'You must be logged in to create a country'
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
    
    if (!requestData.name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Missing required fields', details: 'Name is required' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate name length
    if (requestData.name.length < 2 || requestData.name.length > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Invalid name length', details: 'Name must be between 2 and 100 characters' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if country with same name already exists
    const { data: existingCountry, error: checkError } = await supabaseClient
      .from('locations')
      .select('id')
      .eq('name', requestData.name)
      .eq('type', 'country')
      .single();

    if (checkError && checkError.code !== 'PGRST116') { /* PGRST116: no rows found */
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Error checking existing country', details: checkError.message } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    if (existingCountry) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Country already exists', details: 'A country with this name already exists.' } 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Insert new country
    const insertPayload: any = {
      name: requestData.name.trim(),
      type: 'country',
      parent_id: null, // Countries have no parent
      created_by: user.id,
      // created_at is set by DB default
      updated_at: null,
      updated_by: null,
    };

    const { data: country, error: insertError } = await supabaseClient
      .from('locations')
      .insert(insertPayload)
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Error creating country',
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
        data: country
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
