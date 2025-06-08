import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { documentType, branchId, fiscalYear } = await req.json();

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the document numbering config
    const { data: config, error: configError } = await supabaseClient
      .from('document_numbering_configs')
      .select('*')
      .eq('document_type', documentType)
      .eq('branch_id', branchId)
      .eq('fiscal_year', fiscalYear)
      .eq('is_active', true)
      .single();

    if (configError) throw configError;
    if (!config) throw new Error('Document numbering config not found');

    // Generate the document number
    const paddedNumber = config.current_number.toString().padStart(config.padding_length, '0');
    const documentNumber = `${config.prefix || ''}${paddedNumber}${config.suffix || ''}`;

    // Update the current number
    const { error: updateError } = await supabaseClient
      .from('document_numbering_configs')
      .update({ current_number: config.current_number + 1 })
      .eq('id', config.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ documentNumber }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}); 