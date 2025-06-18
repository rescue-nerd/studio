import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or your specific frontend origin
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS', // Only GET and OPTIONS
  'Access-Control-Max-Age': '86400',
};

interface QueryParams {
  id?: string;
  branch_code?: string;
  include_deleted?: string; // Will be parsed to boolean
  page?: string; // Will be parsed to number
  page_size?: string; // Will be parsed to number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Optional: Authentication check if you want to restrict who can get branches
    // const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    // if (authError || !user) {
    //   return new Response(JSON.stringify({ success: false, error: { message: 'Unauthorized' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    // }

    const url = new URL(req.url);
    const queryParams: QueryParams = Object.fromEntries(url.searchParams.entries());

    let query = supabaseClient.from('branches').select('*');

    if (queryParams.id) {
      query = query.eq('id', queryParams.id).single(); // Expect single record
    } else if (queryParams.branch_code) {
      query = query.eq('branch_code', queryParams.branch_code).single(); // Expect single record
    } else {
      // Listing multiple branches
      if (queryParams.include_deleted !== 'true') {
        query = query.neq('status', 'Deleted'); // Or .is('deleted_at', null)
      }

      const page = parseInt(queryParams.page || '1', 10);
      const pageSize = parseInt(queryParams.page_size || '10', 10); // Default page size 10
      const offset = (page - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);
      
      // Optional: Add ordering
      query = query.order('name', { ascending: true });
    }
    
    const { data, error, count } = await query;

    if (error) {
      // For .single(), if no row is found, PGRST116 is returned. Treat as 404.
      if (error.code === 'PGRST116' && (queryParams.id || queryParams.branch_code)) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Branch not found' } }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.error('Error fetching branches:', error);
      return new Response(JSON.stringify({ success: false, error: { message: 'Error fetching branches', details: error.message } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        // Include count for listings if needed for pagination UI
        ...( !(queryParams.id || queryParams.branch_code) && { count: count } ) 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { message: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
