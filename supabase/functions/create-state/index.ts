import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface RequestBody {
  name: string;
  countryId: string;
}

interface StateData {
  id: string;
  name: string;
  country_id: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { message: 'Authorization header is required' }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { message: 'Unauthorized' }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse and validate request body
    let body: RequestBody;
    try {
      body = await req.json()
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { message: 'Invalid JSON in request body' }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    if (!body.name || !body.countryId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { message: 'Name and country ID are required' }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate name length
    if (body.name.trim().length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { message: 'State name cannot be empty' }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if country exists
    const { data: country, error: countryError } = await supabaseClient
      .from('countries')
      .select('id')
      .eq('id', body.countryId)
      .single()

    if (countryError || !country) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { 
            message: 'Country not found',
            details: countryError?.message
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if state with same name already exists in the country
    const { data: existingState, error: checkError } = await supabaseClient
      .from('states')
      .select('id')
      .eq('name', body.name.trim())
      .eq('country_id', body.countryId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { 
            message: 'Error checking state existence',
            details: checkError.message
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (existingState) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { message: 'A state with this name already exists in the selected country' }
        }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create state
    const { data: newState, error: createError } = await supabaseClient
      .from('states')
      .insert({
        name: body.name.trim(),
        country_id: body.countryId,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating state:', createError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { 
            message: 'Failed to create state',
            details: createError.message
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Return success response with camelCase field names
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          id: newState.id,
          name: newState.name,
          countryId: newState.country_id,
          createdAt: newState.created_at
        }
      }),
      { 
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating state:', error)
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