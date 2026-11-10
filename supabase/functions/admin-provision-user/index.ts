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
    return jsonResponse(500, { error: 'The staff invitation service is not configured.' }, headers);
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
    .select('organization_id, role')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (actorError) {
    console.error('Unable to verify the administrator profile.', actorError.message);
    return jsonResponse(500, { error: 'Unable to verify administrator access.' }, headers);
  }
  if (!actor || actor.role !== 'organization_admin') {
    return jsonResponse(403, { error: 'Only organization administrators can invite staff.' }, headers);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'A valid JSON request body is required.' }, headers);
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return jsonResponse(400, { error: 'A valid staff invitation request is required.' }, headers);
  }
  const input = payload as {
    fullName?: unknown;
    email?: unknown;
    role?: unknown;
    districtId?: unknown;
  };
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const role = input.role;
  const districtId = typeof input.districtId === 'string' ? input.districtId.trim() : '';
  if (fullName.length < 2 || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return jsonResponse(400, { error: 'Enter a valid staff name and email address.' }, headers);
  }
  if (role !== 'district_manager' && role !== 'enumerator') {
    return jsonResponse(400, { error: 'Only district manager and enumerator accounts can be invited.' }, headers);
  }
  if (!districtId) {
    return jsonResponse(400, { error: 'Select a district for this staff member.' }, headers);
  }

  const { data: district, error: districtError } = await serviceClient
    .from('districts')
    .select('id')
    .eq('id', districtId)
    .eq('organization_id', actor.organization_id)
    .eq('status', 'active')
    .maybeSingle();
  if (districtError) {
    console.error('Unable to verify the selected district.', districtError.message);
    return jsonResponse(500, { error: 'Unable to verify the selected district.' }, headers);
  }
  if (!district) {
    return jsonResponse(400, { error: 'Select an active district in your organization.' }, headers);
  }

  const { data: invitation, error: invitationError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (invitationError || !invitation.user) {
    return jsonResponse(400, { error: invitationError?.message ?? 'The invitation could not be created.' }, headers);
  }

  const { error: profileError } = await serviceClient.from('profiles').insert({
    id: invitation.user.id,
    organization_id: actor.organization_id,
    email,
    full_name: fullName,
    role,
    district_id: districtId,
  });
  if (profileError) {
    const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(invitation.user.id);
    if (cleanupError) {
      console.error('Unable to clean up an Auth user after profile creation failed.', cleanupError.message);
    }
    return jsonResponse(400, {
      error: cleanupError
        ? 'The profile could not be created and the pending Auth user needs administrator cleanup.'
        : profileError.message,
    }, headers);
  }

  const { error: auditError } = await serviceClient.from('audit_logs').insert({
    organization_id: actor.organization_id,
    actor_id: authData.user.id,
    action: 'invite',
    record_type: 'profiles',
    record_id: invitation.user.id,
    metadata: { role, district_id: districtId },
  });
  if (auditError) {
    console.error('Staff invitation succeeded, but its audit record was not written.', auditError.message);
    return jsonResponse(200, {
      invited: true,
      warning: 'The invitation was sent, but the audit record could not be written. Contact your administrator.',
    }, headers);
  }

  return jsonResponse(200, { invited: true }, headers);
});
