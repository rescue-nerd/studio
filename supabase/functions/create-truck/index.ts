import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateUser, checkForDuplicates, checkUserPermissions, handleError, validateRequiredFields } from '../_shared/utils.ts';

interface RequestBody {
  truckNo: string;
  type: string;
  capacity?: string;
  ownerName: string;
  ownerPAN?: string;
  status?: "Active" | "Inactive" | "Maintenance";
  assignedLedgerId: string;
}

interface TruckData {
  id: string;
  truck_no: string;
  type: string;
  capacity?: string;
  owner_name: string;
  owner_pan?: string;
  status: "Active" | "Inactive" | "Maintenance";
  assigned_ledger_id: string;
  created_at: string;
  created_by: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Authenticate user
    const { user, error: authError } = await authenticateUser(req, supabase);
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Authentication required'
        }),
        {
          status: 401,
          headers: corsHeaders
        }
      );
    }

    // Check user permissions
    const hasPermission = await checkUserPermissions(user.id, ['superAdmin', 'admin'], supabase);
    if (!hasPermission) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Only administrators can manage trucks'
        }),
        {
          status: 403,
          headers: corsHeaders
        }
      );
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await handleGetTrucks(supabase);
      case 'POST':
        return await handleCreateTruck(req, supabase, user.id);
      case 'PUT':
        return await handleUpdateTruck(req, supabase, user.id);
      case 'DELETE':
        return await handleDeleteTruck(req, supabase, user.id);
      default:
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Method not allowed'
          }),
          {
            status: 405,
            headers: corsHeaders
          }
        );
    }
  } catch (error) {
    console.error('Error in create-truck function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
});

async function handleGetTrucks(supabase) {
  try {
    const { data: trucks, error } = await supabase
      .from('trucks')
      .select('*')
      .order('truckNo');

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        data: trucks
      }),
      {
        headers: corsHeaders
      }
    );
  } catch (error) {
    return handleError(error);
  }
}

async function handleCreateTruck(req, supabase, userId) {
  try {
    const body = await req.json();

    // Validate required fields
    const requiredFields = ['truckNo', 'ownerName', 'assignedLedgerId'];
    const validation = validateRequiredFields(body, requiredFields);
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: validation.message
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Check for duplicate truck number
    const isDuplicate = await checkForDuplicates(supabase, 'trucks', 'truckNo', body.truckNo);
    if (isDuplicate) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'A truck with this number already exists'
        }),
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }

    const truckData = {
      truckNo: body.truckNo,
      ownerName: body.ownerName,
      driverName: body.driverName || '',
      contactNo: body.contactNo || '',
      capacity: body.capacity || '',
      truckType: body.type || body.truckType || '',
      assignedLedgerId: body.assignedLedgerId,
      status: body.status || 'Active',
      createdAt: new Date().toISOString(),
      createdBy: userId
    };

    const { data, error } = await supabase
      .from('trucks')
      .insert([truckData])
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        id: data.id,
        message: 'Truck created successfully'
      }),
      {
        headers: corsHeaders
      }
    );
  } catch (error) {
    return handleError(error);
  }
}

async function handleUpdateTruck(req, supabase, userId) {
  try {
    const body = await req.json();
    const { truckId, ...updateData } = body;

    if (!truckId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Truck ID is required'
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Check if truck exists
    const { data: existingTruck, error: fetchError } = await supabase
      .from('trucks')
      .select('id')
      .eq('id', truckId)
      .single();

    if (fetchError || !existingTruck) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Truck not found'
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }

    // Check for duplicate truck number if truckNo is being updated
    if (updateData.truckNo) {
      const { data: duplicateCheck } = await supabase
        .from('trucks')
        .select('id')
        .eq('truckNo', updateData.truckNo)
        .neq('id', truckId)
        .single();

      if (duplicateCheck) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'A truck with this number already exists'
          }),
          {
            status: 409,
            headers: corsHeaders
          }
        );
      }
    }

    const truckUpdateData = {
      ...updateData,
      truckType: updateData.type || updateData.truckType,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    delete truckUpdateData.type;

    const { error } = await supabase
      .from('trucks')
      .update(truckUpdateData)
      .eq('id', truckId);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        id: truckId,
        message: 'Truck updated successfully'
      }),
      {
        headers: corsHeaders
      }
    );
  } catch (error) {
    return handleError(error);
  }
}

async function handleDeleteTruck(req, supabase, userId) {
  try {
    const body = await req.json();
    const { truckId } = body;

    if (!truckId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Truck ID is required'
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Check if truck exists
    const { data: existingTruck, error: fetchError } = await supabase
      .from('trucks')
      .select('id')
      .eq('id', truckId)
      .single();

    if (fetchError || !existingTruck) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Truck not found'
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }

    // Check for references in biltis
    const { data: biltisWithTruck } = await supabase
      .from('biltis')
      .select('id')
      .eq('truckId', truckId)
      .limit(1);

    if (biltisWithTruck && biltisWithTruck.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Cannot delete truck. It is referenced in existing bilti documents.'
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Check for references in manifests
    const { data: manifestsWithTruck } = await supabase
      .from('manifests')
      .select('id')
      .eq('truckId', truckId)
      .limit(1);

    if (manifestsWithTruck && manifestsWithTruck.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Cannot delete truck. It is referenced in existing manifest documents.'
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const { error } = await supabase
      .from('trucks')
      .delete()
      .eq('id', truckId);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        id: truckId,
        message: 'Truck deleted successfully'
      }),
      {
        headers: corsHeaders
      }
    );
  } catch (error) {
    return handleError(error);
  }
} 