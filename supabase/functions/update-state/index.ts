import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'PUT') {
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

    const { id, name, countryId } = await req.json()

    // Validate required fields
    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: id' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100)) {
      return new Response(JSON.stringify({ 
        error: 'State name must be between 2 and 100 characters' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if state exists
    const { data: existingState, error: stateError } = await supabase
      .from('locations')
      .select('id, name, parent_id, type, status')
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
        error: 'Cannot update inactive state' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify country if provided
    if (countryId && countryId !== existingState.parent_id) {
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
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== existingState.name) {
      const targetCountryId = countryId || existingState.parent_id
      const { data: duplicate, error: duplicateError } = await supabase
        .from('locations')
        .select('id')
        .eq('name', name.trim())
        .eq('parent_id', targetCountryId)
        .eq('type', 'state')
        .eq('status', 'active')
        .neq('id', id)
        .single()

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        throw duplicateError
      }

      if (duplicate) {
        return new Response(JSON.stringify({ 
          error: 'A state with this name already exists in this country' 
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Prepare update data
    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) {
      updateData.name = name.trim()
    }

    if (countryId !== undefined) {
      updateData.parent_id = countryId
    }

    // Update the state
    const { data: updatedState, error: updateError } = await supabase
      .from('locations')
      .update(updateData)
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
        updated_by,
        parent:locations!parent_id(id, name, type)
      `)
      .single()

    if (updateError) {
      console.error('Update state error:', updateError)
      return new Response(JSON.stringify({ 
        error: 'Failed to update state' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: updatedState
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error updating state:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
