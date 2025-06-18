import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { name, countryId } = await req.json()

    // Validate required fields
    if (!name || !countryId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: name, countryId' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate name
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return new Response(JSON.stringify({ 
        error: 'State name must be between 2 and 100 characters' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify the country exists
    const { data: country, error: countryError } = await supabase
      .from('locations')
      .select('id, name')
      .eq('id', countryId)
      .eq('type', 'country')
      .eq('status', 'active')
      .single()

    if (countryError || !country) {
      return new Response(JSON.stringify({ 
        error: 'Invalid country ID or country is inactive' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for duplicate state name within the same country
    const { data: existingState, error: duplicateError } = await supabase
      .from('locations')
      .select('id')
      .eq('name', name.trim())
      .eq('parent_id', countryId)
      .eq('type', 'state')
      .eq('status', 'active')
      .single()

    if (duplicateError && duplicateError.code !== 'PGRST116') {
      throw duplicateError
    }

    if (existingState) {
      return new Response(JSON.stringify({ 
        error: 'A state with this name already exists in this country' 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create the state
    const { data: newState, error: createError } = await supabase
      .from('locations')
      .insert({
        name: name.trim(),
        type: 'state',
        parent_id: countryId,
        status: 'active',
        created_by: user.id,
        updated_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        id,
        name,
        type,
        parent_id,
        status,
        created_at,
        updated_at,
        created_by,
        updated_by,
        parent:locations!parent_id(id, name, type)
      `)
      .single()

    if (createError) {
      console.error('Create state error:', createError)
      return new Response(JSON.stringify({ 
        error: 'Failed to create state' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: newState
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error creating state:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})