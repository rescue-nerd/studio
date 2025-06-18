import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'DELETE') {
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

    const { id } = await req.json()

    // Validate required fields
    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: id' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if state exists
    const { data: existingState, error: stateError } = await supabase
      .from('locations')
      .select('id, name, type, status')
      .eq('id', id)
      .eq('type', 'state')
      .single()

    if (stateError || !existingState) {
      return new Response(JSON.stringify({ 
        error: 'State not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (existingState.status !== 'active') {
      return new Response(JSON.stringify({ 
        error: 'State is already inactive' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for dependent cities
    const { data: cities, error: citiesError } = await supabase
      .from('locations')
      .select('id, name')
      .eq('parent_id', id)
      .eq('type', 'city')
      .eq('status', 'active')
      .limit(5)

    if (citiesError) {
      throw citiesError
    }

    if (cities && cities.length > 0) {
      const cityNames = cities.map(c => c.name).join(', ')
      return new Response(JSON.stringify({ 
        error: `Cannot delete state. It has ${cities.length} active cities: ${cityNames}${cities.length === 5 ? '...' : ''}` 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for dependent units
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, name')
      .eq('state_id', id)
      .eq('status', 'active')
      .limit(5)

    if (unitsError) {
      throw unitsError
    }

    if (units && units.length > 0) {
      const unitNames = units.map(u => u.name).join(', ')
      return new Response(JSON.stringify({ 
        error: `Cannot delete state. It has ${units.length} active units: ${unitNames}${units.length === 5 ? '...' : ''}` 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Soft delete the state
    const { data: deletedState, error: deleteError } = await supabase
      .from('locations')
      .update({
        status: 'inactive',
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        id,
        name,
        type,
        parent_id,
        status,
        created_at,
        updated_at,
        created_by,
        updated_by
      `)
      .single()

    if (deleteError) {
      console.error('Delete state error:', deleteError)
      return new Response(JSON.stringify({ 
        error: 'Failed to delete state' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: deletedState
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error deleting state:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
