import { createClient } from 'npm:@supabase/supabase-js@2';

const responseHeaders = (origin: string | null, allowed: Set<string>) => ({
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  ...(origin && allowed.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
});

function jsonResponse(status: number, body: unknown, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  const allowedOrigins = new Set(
    (Deno.env.get('ADMIN_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const origin = request.headers.get('Origin');
  const headers = responseHeaders(origin, allowedOrigins);

  if (request.method === 'OPTIONS') {
    return origin && allowedOrigins.has(origin)
      ? new Response(null, { status: 204, headers })
      : jsonResponse(403, { error: 'This origin is not allowed.' }, headers);
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' }, headers);
  }
  if (!origin || !allowedOrigins.has(origin)) {
    return jsonResponse(403, { error: 'This origin is not allowed.' }, headers);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Required Supabase Edge Function secrets are missing.');
    return jsonResponse(500, { error: 'The staff account management service is not configured.' }, headers);
  }

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse(401, { error: 'A valid administrator session is required.' }, headers);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return jsonResponse(401, { error: 'The administrator session is invalid or expired.' }, headers);
  }

  const { data: actor, error: actorError } = await serviceClient
    .from('profiles')
    .select('organization_id, role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (actorError) {
    console.error('Unable to verify the administrator profile.', actorError.message);
    return jsonResponse(500, { error: 'Unable to verify administrator access.' }, headers);
  }
  if (!actor || actor.role !== 'organization_admin' || !actor.is_active) {
    return jsonResponse(403, { error: 'Only organization administrators can manage staff accounts.' }, headers);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'A valid JSON request body is required.' }, headers);
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return jsonResponse(400, { error: 'A valid staff account action is required.' }, headers);
  }
  const input = payload as {
    action?: unknown;
    targetUserId?: unknown;
  };
  const action = input.action;
  if (action !== 'reset_password' && action !== 'deactivate' && action !== 'reactivate' && action !== 'approve') {
    return jsonResponse(400, { error: 'Select a supported account action.' }, headers);
  }

  const targetUserId = typeof input.targetUserId === 'string' ? input.targetUserId.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return jsonResponse(400, { error: 'Select a valid staff account.' }, headers);
  }

  const { data: target, error: targetError } = await serviceClient
    .from('profiles')
    .select('id, email, role, is_active, approval_status')
    .eq('id', targetUserId)
    .eq('organization_id', actor.organization_id)
    .maybeSingle();
  if (targetError) {
    console.error('Unable to verify the target staff account.', targetError.message);
    return jsonResponse(500, { error: 'Unable to verify the selected staff account.' }, headers);
  }
  if (!target || (target.role !== 'district_manager' && target.role !== 'enumerator')) {
    return jsonResponse(404, { error: 'The selected staff account was not found.' }, headers);
  }

  if (action === 'approve' && (target.role !== 'enumerator' || target.approval_status !== 'pending' || target.is_active)) {
    return jsonResponse(409, { error: 'This Screening Faculty account is not waiting for approval.' }, headers);
  }
  if (action === 'reactivate' && target.approval_status !== 'approved') {
    return jsonResponse(409, { error: 'Approve this account before reactivating it.' }, headers);
  }

  if (action === 'reset_password') {
    const { error: resetError } = await authClient.auth.resetPasswordForEmail(target.email);
    if (resetError) {
      console.error('Unable to send a password recovery email.', resetError.message);
      return jsonResponse(502, { error: 'The password recovery email could not be sent.' }, headers);
    }
  } else if (action === 'deactivate') {
    if (target.is_active) {
      const { error: profileError } = await serviceClient
        .from('profiles')
        .update({ is_active: false })
        .eq('id', target.id)
        .eq('organization_id', actor.organization_id);
      if (profileError) {
        console.error('Unable to deactivate the staff profile.', profileError.message);
        return jsonResponse(500, { error: 'The staff account could not be deactivated.' }, headers);
      }
    }

    const { error: banError } = await serviceClient.auth.admin.updateUserById(target.id, { ban_duration: '876000h' });
    if (banError) {
      console.error('The staff profile was disabled, but its Auth account could not be blocked.', banError.message);
      return jsonResponse(500, { error: 'The account is disabled in the app, but sign-in could not be blocked. Contact your platform administrator.' }, headers);
    }
  } else if (action === 'approve') {
    const { data: updatedProfiles, error: profileError } = await serviceClient
      .from('profiles')
      .update({ is_active: true, approval_status: 'approved' })
      .eq('id', target.id)
      .eq('organization_id', actor.organization_id)
      .eq('role', 'enumerator')
      .eq('is_active', false)
      .eq('approval_status', 'pending')
      .select('id');
    if (profileError || !updatedProfiles?.length) {
      console.error('Unable to approve the Screening Faculty account.', profileError?.message ?? 'No pending account was updated.');
      return jsonResponse(409, { error: 'The account could not be approved because its status has changed. Refresh and try again.' }, headers);
    }
  } else {
    const { error: unbanError } = await serviceClient.auth.admin.updateUserById(target.id, { ban_duration: 'none' });
    if (unbanError) {
      console.error('Unable to reactivate the Auth account.', unbanError.message);
      return jsonResponse(500, { error: 'The account could not be reactivated.' }, headers);
    }
    const { error: profileError } = await serviceClient
      .from('profiles')
      .update({ is_active: true })
      .eq('id', target.id)
      .eq('organization_id', actor.organization_id);
    if (profileError) {
      console.error('The Auth account was unblocked, but its staff profile could not be activated.', profileError.message);
      return jsonResponse(500, { error: 'The login was restored, but the staff profile is still inactive. Contact your platform administrator.' }, headers);
    }
  }

  const { error: auditError } = await serviceClient.from('audit_logs').insert({
    organization_id: actor.organization_id,
    actor_id: authData.user.id,
    action,
    record_type: 'profiles',
    record_id: target.id,
    metadata: {},
  });
  if (auditError) {
    console.error('The staff account action succeeded, but its audit record was not written.', auditError.message);
    return jsonResponse(200, {
      success: true,
      warning: 'The account action succeeded, but its audit record could not be written. Contact your administrator.',
    }, headers);
  }

  return jsonResponse(200, { success: true }, headers);
});
