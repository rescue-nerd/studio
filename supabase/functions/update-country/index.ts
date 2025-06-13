import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
}

interface UpdateCountryRequest {
  id: string;
  name: string;
  code: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Authorization header:', authHeader);
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'No authorization header' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get user session
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Unauthorized' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { id, name, code } = await req.json() as UpdateCountryRequest

    // Validate request body
    if (!id || !name || !code) {
      console.log('Validation failed:', { id, name, code });
      return new Response(
        JSON.stringify({ success: false, error: { message: 'ID, name, and code are required', received: { id, name, code } } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if country exists
    const { data: existingCountry, error: checkError } = await supabaseClient
      .from('countries')
      .select('id')
      .eq('id', id)
      .single()
    console.log('Existing country check:', { existingCountry, checkError });

    if (checkError) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Error checking country existence' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!existingCountry) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Country not found', id } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if new code conflicts with existing country
    const { data: codeConflict, error: codeError } = await supabaseClient
      .from('countries')
      .select('id')
      .eq('code', code)
      .neq('id', id)
      .single()
    console.log('Code conflict check:', { codeConflict, codeError });

    if (codeError && codeError.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Error checking code uniqueness' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (codeConflict) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Country code already exists', code } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update country
    try {
      const { data: country, error: updateError } = await supabaseClient
        .from('countries')
        .update({ name, code, updated_at: new Date().toISOString(), updated_by: user.email || user.id })
        .eq('id', id)
        .select()
        .single()
      console.log('Update country result:', { country, updateError });

      if (updateError) {
        console.error('Database update error:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Error updating country', details: updateError.message } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch (dbError) {
      console.error('Exception during update:', dbError);
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Exception during update', details: dbError instanceof Error ? dbError.message : String(dbError) } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: country }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Update country error:', error);
    return new Response(
      JSON.stringify({ success: false, error: { message: 'Internal server error', details: error instanceof Error ? error.message : String(error) } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})