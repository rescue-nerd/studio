import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
}

const validUnitTypes = ['weight', 'volume', 'length', 'count']

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

    const { id, name, type, symbol, conversionFactor, isBaseUnit } = await req.json()

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
        error: 'Unit name must be between 2 and 100 characters' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate type if provided
    if (type !== undefined && !validUnitTypes.includes(type)) {
      return new Response(JSON.stringify({ 
        error: `Invalid unit type. Must be one of: ${validUnitTypes.join(', ')}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate symbol if provided
    if (symbol !== undefined && (typeof symbol !== 'string' || symbol.trim().length < 1 || symbol.trim().length > 10)) {
      return new Response(JSON.stringify({ 
        error: 'Unit symbol must be between 1 and 10 characters' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate conversion factor if provided
    if (conversionFactor !== undefined) {
      const factor = Number(conversionFactor)
      if (isNaN(factor) || factor <= 0) {
        return new Response(JSON.stringify({ 
          error: 'Conversion factor must be a positive number' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Check if unit exists
    const { data: existingUnit, error: unitError } = await supabase
      .from('units')
      .select('id, name, symbol')
      .eq('id', id)
      .single()

    if (unitError || !existingUnit) {
      return new Response(JSON.stringify({ 
        error: 'Unit not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== existingUnit.name) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('units')
        .select('id')
        .eq('name', name.trim())
        .neq('id', id)
        .single()

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        throw duplicateError
      }

      if (duplicate) {
        return new Response(JSON.stringify({ 
          error: 'A unit with this name already exists' 
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Check for duplicate symbol if symbol is being changed
    if (symbol && symbol.trim() !== existingUnit.symbol) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('units')
        .select('id')
        .eq('symbol', symbol.trim())
        .neq('id', id)
        .single()

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        throw duplicateError
      }

      if (duplicate) {
        return new Response(JSON.stringify({ 
          error: 'A unit with this symbol already exists' 
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

    if (type !== undefined) {
      updateData.type = type
    }

    if (symbol !== undefined) {
      updateData.symbol = symbol.trim()
    }

    if (conversionFactor !== undefined) {
      updateData.conversion_factor = Number(conversionFactor)
    }

    if (isBaseUnit !== undefined) {
      updateData.is_base_unit = isBaseUnit
    }

    // Update the unit
    const { data: updatedUnit, error: updateError } = await supabase
      .from('units')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        name,
        type,
        symbol,
        conversion_factor,
        is_base_unit,
        created_at,
        updated_at,
        created_by,
        updated_by
      `)
      .single()

    if (updateError) {
      console.error('Update unit error:', updateError)
      return new Response(JSON.stringify({ 
        error: 'Failed to update unit' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: updatedUnit
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error updating unit:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
