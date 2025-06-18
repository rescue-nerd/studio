import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const validUnitTypes = ['weight', 'volume', 'length', 'count']

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

    const { name, type, symbol, conversionFactor, isBaseUnit } = await req.json()

    // Validate required fields
    if (!name || !type || !symbol) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: name, type, symbol' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate name
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return new Response(JSON.stringify({ 
        error: 'Unit name must be between 2 and 100 characters' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate type
    if (!validUnitTypes.includes(type)) {
      return new Response(JSON.stringify({ 
        error: `Invalid unit type. Must be one of: ${validUnitTypes.join(', ')}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate symbol
    if (typeof symbol !== 'string' || symbol.trim().length < 1 || symbol.trim().length > 10) {
      return new Response(JSON.stringify({ 
        error: 'Unit symbol must be between 1 and 10 characters' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate conversion factor
    const factor = conversionFactor !== undefined ? Number(conversionFactor) : 1.0
    if (isNaN(factor) || factor <= 0) {
      return new Response(JSON.stringify({ 
        error: 'Conversion factor must be a positive number' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for duplicate name
    const { data: existingUnit, error: duplicateError } = await supabase
      .from('units')
      .select('id')
      .eq('name', name.trim())
      .single()

    if (duplicateError && duplicateError.code !== 'PGRST116') {
      throw duplicateError
    }

    if (existingUnit) {
      return new Response(JSON.stringify({ 
        error: 'A unit with this name already exists' 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for duplicate symbol
    const { data: existingSymbol, error: symbolError } = await supabase
      .from('units')
      .select('id')
      .eq('symbol', symbol.trim())
      .single()

    if (symbolError && symbolError.code !== 'PGRST116') {
      throw symbolError
    }

    if (existingSymbol) {
      return new Response(JSON.stringify({ 
        error: 'A unit with this symbol already exists' 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create the unit
    const { data: newUnit, error: createError } = await supabase
      .from('units')
      .insert({
        name: name.trim(),
        type: type,
        symbol: symbol.trim(),
        conversion_factor: factor,
        is_base_unit: isBaseUnit || false,
        created_by: user.id,
        updated_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
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

    if (createError) {
      console.error('Create unit error:', createError)
      return new Response(JSON.stringify({ 
        error: 'Failed to create unit' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: newUnit
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error creating unit:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
