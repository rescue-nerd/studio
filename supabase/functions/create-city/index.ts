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

    const { name, stateId } = await req.json()

    // Validate required fields
    if (!name || !stateId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: name, stateId' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate name
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return new Response(JSON.stringify({ 
        error: 'City name must be between 2 and 100 characters' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify the state exists
    const { data: state, error: stateError } = await supabase
      .from('locations')
      .select('id, name')
      .eq('id', stateId)
      .eq('type', 'state')
      .eq('status', 'active')
      .single()

    if (stateError || !state) {
      return new Response(JSON.stringify({ 
        error: 'Invalid state ID or state is inactive' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for duplicate city name within the same state
    const { data: existingCity, error: duplicateError } = await supabase
      .from('locations')
      .select('id')
      .eq('name', name.trim())
      .eq('parent_id', stateId)
      .eq('type', 'city')
      .eq('status', 'active')
      .single()

    if (duplicateError && duplicateError.code !== 'PGRST116') {
      throw duplicateError
    }

    if (existingCity) {
      return new Response(JSON.stringify({ 
        error: 'A city with this name already exists in this state' 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create the city
    const { data: newCity, error: createError } = await supabase
      .from('locations')
      .insert({
        name: name.trim(),
        type: 'city',
        parent_id: stateId,
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
      console.error('Create city error:', createError)
      return new Response(JSON.stringify({ 
        error: 'Failed to create city' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: newCity
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error creating city:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
