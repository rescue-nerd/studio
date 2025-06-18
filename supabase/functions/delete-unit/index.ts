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

    // Check if unit exists
    const { data: existingUnit, error: unitError } = await supabase
      .from('units')
      .select('id, name')
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

    // TODO: Add dependency checks here if needed
    // For example, check if any goods/products are using this unit
    // This would require knowing the structure of other tables

    // Hard delete the unit (since units table doesn't have a status field)
    const { data: deletedUnit, error: deleteError } = await supabase
      .from('units')
      .delete()
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

    if (deleteError) {
      console.error('Delete unit error:', deleteError)
      return new Response(JSON.stringify({ 
        error: 'Failed to delete unit' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: deletedUnit
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error deleting unit:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
