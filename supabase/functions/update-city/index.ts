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

    const { id, name, stateId } = await req.json()

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
        error: 'City name must be between 2 and 100 characters' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if city exists
    const { data: existingCity, error: cityError } = await supabase
      .from('locations')
      .select('id, name, parent_id, type, status')
      .eq('id', id)
      .eq('type', 'city')
      .single()

    if (cityError || !existingCity) {
      return new Response(JSON.stringify({ 
        error: 'City not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (existingCity.status !== 'active') {
      return new Response(JSON.stringify({ 
        error: 'Cannot update inactive city' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify state if provided
    if (stateId && stateId !== existingCity.parent_id) {
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
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== existingCity.name) {
      const targetStateId = stateId || existingCity.parent_id
      const { data: duplicate, error: duplicateError } = await supabase
        .from('locations')
        .select('id')
        .eq('name', name.trim())
        .eq('parent_id', targetStateId)
        .eq('type', 'city')
        .eq('status', 'active')
        .neq('id', id)
        .single()

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        throw duplicateError
      }

      if (duplicate) {
        return new Response(JSON.stringify({ 
          error: 'A city with this name already exists in this state' 
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

    if (stateId !== undefined) {
      updateData.parent_id = stateId
    }

    // Update the city
    const { data: updatedCity, error: updateError } = await supabase
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
      console.error('Update city error:', updateError)
      return new Response(JSON.stringify({ 
        error: 'Failed to update city' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: updatedCity
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error updating city:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
