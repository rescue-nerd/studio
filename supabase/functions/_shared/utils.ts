import { corsHeaders } from './cors.ts';

export async function authenticateUser(req: Request, supabase: any) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  } catch (error) {
    console.error('Authentication error:', error);
    return { user: null, error };
  }
}

export async function checkUserPermissions(userId: string, allowedRoles: string[], supabase: any) {
  try {
    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !userProfile) {
      console.error('Error fetching user profile:', error);
      return false;
    }

    return allowedRoles.includes(userProfile.role);
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

export function validateRequiredFields(data: any, requiredFields: string[]) {
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    return {
      isValid: false,
      message: `Missing required fields: ${missingFields.join(', ')}`
    };
  }

  return { isValid: true };
}

export async function checkForDuplicates(supabase: any, table: string, field: string, value: string) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq(field, value)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    throw error;
  }
}

export function handleError(error: any) {
  console.error('Error:', error);
  
  const message = error instanceof Error ? error.message : 'Internal server error';
  
  return new Response(
    JSON.stringify({
      success: false,
      message
    }),
    {
      status: 500,
      headers: corsHeaders
    }
  );
} 