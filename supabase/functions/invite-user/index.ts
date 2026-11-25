import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import type { Database } from '../../../src/lib/database.types.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import { classifyInvitationState } from './invitation-state.js';

type InvitationRole = 'district_manager' | 'enumerator';
type InvitationAction =
  | {
      action: 'invite';
      email: string;
      role: InvitationRole;
      districtId: string;
      idempotencyKey: string;
    }
  | {
      action: 'cancel';
      invitationId: string;
    };

type InvitationRequestRow = {
  invitation_id: string | null;
  created: boolean;
  result_code: string;
};

type ExistingInvitationState = {
  status: string;
  auth_status: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const defaultDevelopmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const defaultInvitationRedirectOrigin = 'https://student-data-survay-app.vercel.app';

function getAllowedOrigins(): Set<string> {
  const configuredOrigins = Deno.env.get('INVITE_ALLOWED_ORIGINS');
  return new Set(
    (configuredOrigins ? configuredOrigins.split(',') : defaultDevelopmentOrigins)
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function jsonResponse(
  body: Record<string, string>,
  status: number,
  origin: string | null,
  allowedOrigins: Set<string>,
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Headers', 'authorization, apikey, x-client-info, content-type');
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): InvitationAction | null {
  if (!isRecord(value) || typeof value.action !== 'string') return null;

  if (value.action === 'invite'
    && typeof value.email === 'string'
    && typeof value.role === 'string'
    && (value.role === 'district_manager' || value.role === 'enumerator')
    && typeof value.districtId === 'string'
    && uuidPattern.test(value.districtId)
    && typeof value.idempotencyKey === 'string'
    && uuidPattern.test(value.idempotencyKey)) {
    const email = value.email.trim().toLowerCase();
    if (
      email.length <= 320
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return {
        action: 'invite',
        email,
        role: value.role,
        districtId: value.districtId,
        idempotencyKey: value.idempotencyKey,
      };
    }
    return null;
  }

  if (
    value.action === 'cancel'
    && typeof value.invitationId === 'string'
    && uuidPattern.test(value.invitationId)
  ) {
    return { action: 'cancel', invitationId: value.invitationId };
  }

  return null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required runtime configuration: ${name}`);
  return value;
}

async function handleInvitation(
  action: InvitationAction,
  callerClient: SupabaseClient<Database>,
  serviceClient: SupabaseClient<Database>,
  origin: string | null,
  allowedOrigins: Set<string>,
): Promise<Response> {
  if (action.action === 'cancel') {
    const { data, error } = await callerClient.rpc('cancel_user_invitation', {
      target_invitation_id: action.invitationId,
    });
    if (error) {
      return jsonResponse({ code: 'cancellation_unavailable' }, 503, origin, allowedOrigins);
    }
    if (data !== true) {
      return jsonResponse({ code: 'invitation_unavailable' }, 404, origin, allowedOrigins);
    }
    return jsonResponse({ status: 'cancelled' }, 200, origin, allowedOrigins);
  }

  const { data: requestRows, error: requestError } = await callerClient.rpc(
    'request_user_invitation',
    {
      requested_email: action.email,
      requested_role: action.role,
      requested_district_id: action.districtId,
      request_idempotency_key: action.idempotencyKey,
    },
  );
  if (requestError) {
    if (requestError.code === '42501') {
      return jsonResponse({ code: 'not_authorized' }, 403, origin, allowedOrigins);
    }
    if (requestError.code === '22023') {
      return jsonResponse({ code: 'invalid_district' }, 400, origin, allowedOrigins);
    }
    return jsonResponse({ code: 'service_unavailable' }, 503, origin, allowedOrigins);
  }

  const request: InvitationRequestRow | undefined = requestRows?.[0];
  if (request?.result_code === 'invalid_request') {
    return jsonResponse({ code: 'invalid_invitation_request' }, 400, origin, allowedOrigins);
  }
  if (!request || request.result_code === 'conflict' || !request.invitation_id) {
    return jsonResponse({ code: 'invitation_conflict' }, 409, origin, allowedOrigins);
  }

  if (!request.created) {
    const { data: existing, error: existingError } = await serviceClient
      .from('user_invitations')
      .select('status, auth_status')
      .eq('id', request.invitation_id)
      .maybeSingle();
    if (existingError || !existing) {
      return jsonResponse({ code: 'invitation_outcome_unknown' }, 503, origin, allowedOrigins);
    }

    const existingState = classifyInvitationState(existing as ExistingInvitationState);
    if (existingState !== 'claimable') {
      return jsonResponse({ status: existingState }, 200, origin, allowedOrigins);
    }
  }

  const { data: claimed, error: claimError } = await serviceClient.rpc(
    'claim_user_invitation_auth_request',
    { target_invitation_id: request.invitation_id },
  );
  if (claimError) {
    return jsonResponse({ code: 'invitation_outcome_unknown' }, 503, origin, allowedOrigins);
  }
  if (claimed !== true) {
    const { data: latest, error: latestError } = await serviceClient
      .from('user_invitations')
      .select('status, auth_status')
      .eq('id', request.invitation_id)
      .maybeSingle();
    if (latestError || !latest) {
      return jsonResponse({ code: 'invitation_outcome_unknown' }, 503, origin, allowedOrigins);
    }
    const latestState = classifyInvitationState(latest as ExistingInvitationState);
    return jsonResponse(
      { status: latestState === 'claimable' ? 'outcome_unknown' : latestState },
      latestState === 'already_processing' ? 202 : 200,
      origin,
      allowedOrigins,
    );
  }

  if (!origin) {
    return jsonResponse({ code: 'origin_not_allowed' }, 400, origin, allowedOrigins);
  }
  const redirectOrigin = Deno.env.get('INVITE_REDIRECT_ORIGIN')?.trim() || defaultInvitationRedirectOrigin;
  const redirectUrl = new URL('/accept-invitation', redirectOrigin);
  redirectUrl.searchParams.set('invitation_id', request.invitation_id);
  let resultingAuthUserId: string | null = null;
  let authRequestError: { status?: number } | null = null;
  try {
    const { data: existingAuthUserId, error: lookupError } = await serviceClient.rpc(
      'existing_auth_user_for_invitation',
      { target_invitation_id: request.invitation_id },
    );
    if (lookupError) throw lookupError;

    if (existingAuthUserId) {
      // Existing Auth identities receive a recovery link for this exact
      // invitation. This preserves their UID and avoids duplicate Auth users.
      const result = await serviceClient.auth.resetPasswordForEmail(action.email, {
        redirectTo: redirectUrl.toString(),
      });
      authRequestError = result.error;
      if (!result.error) resultingAuthUserId = existingAuthUserId;
    } else {
      const result = await serviceClient.auth.admin.inviteUserByEmail(
        action.email,
        { redirectTo: redirectUrl.toString() },
      );
      authRequestError = result.error;
      const authUser = result.data?.user;
      if (authUser?.id && authUser.email && normalizeEmail(authUser.email) === action.email) {
        resultingAuthUserId = authUser.id;
      }
    }
  } catch {
    const { data: recorded, error: recordError } = await serviceClient.rpc(
      'record_user_invitation_auth_result',
      {
        target_invitation_id: request.invitation_id,
        result_status: 'unknown',
      },
    );
    if (recordError || recorded !== true) {
      return jsonResponse({ code: 'invitation_outcome_unknown' }, 503, origin, allowedOrigins);
    }
    return jsonResponse({ status: 'outcome_unknown' }, 202, origin, allowedOrigins);
  }

  if (authRequestError) {
    const definitiveRejection = typeof authRequestError.status === 'number'
      && authRequestError.status >= 400
      && authRequestError.status < 500;
    const resultStatus = definitiveRejection ? 'rejected_by_auth' : 'unknown';
    const { data: recorded, error: recordError } = await serviceClient.rpc(
      'record_user_invitation_auth_result',
      {
        target_invitation_id: request.invitation_id,
        result_status: resultStatus,
        safe_failure_code: definitiveRejection ? 'auth_rejected' : null,
      },
    );
    if (recordError || recorded !== true) {
      return jsonResponse({ code: 'invitation_outcome_unknown' }, 503, origin, allowedOrigins);
    }
    return definitiveRejection
      ? jsonResponse({ code: 'auth_rejected' }, 409, origin, allowedOrigins)
      : jsonResponse({ status: 'outcome_unknown' }, 202, origin, allowedOrigins);
  }

  if (!resultingAuthUserId) {
    const { data: recorded, error: recordError } = await serviceClient.rpc(
      'record_user_invitation_auth_result',
      {
        target_invitation_id: request.invitation_id,
        result_status: 'unknown',
      },
    );
    if (recordError || recorded !== true) {
      return jsonResponse({ code: 'invitation_outcome_unknown' }, 503, origin, allowedOrigins);
    }
    return jsonResponse({ status: 'outcome_unknown' }, 202, origin, allowedOrigins);
  }

  const { data: recorded, error: recordError } = await serviceClient.rpc(
    'record_user_invitation_auth_result',
    {
      target_invitation_id: request.invitation_id,
      result_status: 'accepted_by_auth',
      resulting_auth_user_id: resultingAuthUserId,
    },
  );
  if (recordError || recorded !== true) {
    return jsonResponse({ code: 'invitation_outcome_unknown' }, 503, origin, allowedOrigins);
  }

  return jsonResponse(
    { invitationId: request.invitation_id, status: 'auth_request_accepted' },
    201,
    origin,
    allowedOrigins,
  );
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins();

  if (request.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) {
      return jsonResponse({ code: 'origin_not_allowed' }, 403, origin, allowedOrigins);
    }
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
        'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Cache-Control': 'no-store',
        Vary: 'Origin',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ code: 'method_not_allowed' }, 405, origin, allowedOrigins);
  }
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ code: 'origin_not_allowed' }, 403, origin, allowedOrigins);
  }

  const authorization = request.headers.get('Authorization');
  const tokenMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    return jsonResponse({ code: 'unauthorized' }, 401, origin, allowedOrigins);
  }

  let action: InvitationAction | null;
  try {
    action = parseRequest(await request.json());
  } catch {
    action = null;
  }
  if (!action) {
    return jsonResponse({ code: 'invalid_request' }, 400, origin, allowedOrigins);
  }
  if (action.action === 'invite' && !origin) {
    return jsonResponse({ code: 'origin_not_allowed' }, 400, origin, allowedOrigins);
  }

  try {
    const supabaseUrl = getEnvironment('SUPABASE_URL');
    const anonKey = getEnvironment('SUPABASE_ANON_KEY');
    const serviceRoleKey = getEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const callerClient = createClient<Database>(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${tokenMatch[1]}` } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser(tokenMatch[1]);
    if (userError || !user) {
      return jsonResponse({ code: 'unauthorized' }, 401, origin, allowedOrigins);
    }

    const serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return await handleInvitation(
      action,
      callerClient,
      serviceClient,
      origin,
      allowedOrigins,
    );
  } catch {
    return jsonResponse({ code: 'service_unavailable' }, 503, origin, allowedOrigins);
  }
});
