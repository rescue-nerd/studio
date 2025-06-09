import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface RequestBody {
  id: string;
  name?: string;
  countryId?: string;
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
    
    if (!body.id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { message: 'State ID is required' }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate name if provided
    if (body.name !== undefined && body.name.trim().length === 0) {
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

    // Check if state exists
    const { data: existingState, error: fetchError } = await supabaseClient
      .from('states')
      .select('*')
      .eq('id', body.id)
      .single()

    if (fetchError || !existingState) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { 
            message: 'State not found',
            details: fetchError?.message
          }
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If countryId is provided, verify it exists
    if (body.countryId) {
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
    }

    // Check for duplicate name in the same country (if name is being updated)
    if (body.name) {
      const targetCountryId = body.countryId || existingState.country_id;
      const { data: duplicateState, error: duplicateError } = await supabaseClient
        .from('states')
        .select('id')
        .eq('name', body.name.trim())
        .eq('country_id', targetCountryId)
        .neq('id', body.id)
        .single()

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: { 
              message: 'Error checking for duplicate state name',
              details: duplicateError.message
            }
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      if (duplicateState) {
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
    }

    // Prepare update data
    const updateData: Partial<StateData> = {
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    if (body.name) updateData.name = body.name.trim()
    if (body.countryId) updateData.country_id = body.countryId

    // Update state
    const { data: updatedState, error: updateError } = await supabaseClient
      .from('states')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating state:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { 
            message: 'Failed to update state',
            details: updateError.message
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
          id: updatedState.id,
          name: updatedState.name,
          countryId: updatedState.country_id,
          updatedAt: updatedState.updated_at
        },
        message: 'State updated successfully' 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error updating state:', error)
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