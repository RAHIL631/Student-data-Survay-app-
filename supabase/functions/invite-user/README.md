# `invite-user` Edge Function

This function creates and cancels invitations using the existing invitation database functions. It is deployed to Supabase project `qghesdscscclbfevbypb`; the Vercel frontend is not deployed from this working tree.

## Security boundary

- JWT verification is enabled in `supabase/config.toml`. The function also verifies the bearer token with Supabase Auth before handling a request.
- Invitation scope and role authorization are enforced by `request_user_invitation` in PostgreSQL using the caller's authenticated identity. Organization and district IDs from the request are not trusted.
- The service-role key is read only from the Edge Function runtime. It is never sent to or used by the browser.
- A database claim must succeed before `inviteUserByEmail` is called. Retried requests cannot issue another Auth request for the same invitation.
- Cancellation uses the caller's JWT and `cancel_user_invitation`; PostgreSQL checks the caller's current role and scope.
- New Auth identities receive an invite email. If the email already belongs to an Auth identity with no application profile, a service-role-only database helper returns that existing UID and the function sends a recovery email for this exact invitation instead of creating a duplicate Auth user. Existing profiles remain a conflict.
- The acceptance RPC provisions a profile only for the exact Auth user recorded against the invitation, after confirmed email verification. It rejects cancelled invitations. Enumerator profiles start pending/inactive and require an organization administrator to approve them.
- The SPA invitation page requires the recipient to enter a full name and choose/confirm a password. It updates the existing Auth account through `auth.updateUser` before calling the acceptance RPC; passwords are never written to application tables. The RPC returns `pending_approval` or `approved` to match the frontend, and retries confirm the same accepted profile without creating duplicates.
- Invitation acceptance and cancellation do not delete Auth accounts. Re-invitation uses the existing UID and a recovery email; resend for an already-active invitation is not implemented.

## Local development

Run the local Supabase stack and frontend, then serve the function locally:

```powershell
npx supabase functions serve invite-user
npm run dev
```

By default, the function permits the local Vite origins `http://localhost:5173` and `http://127.0.0.1:5173`. To use another local origin, set `INVITE_ALLOWED_ORIGINS` in the Edge Function runtime environment to a comma-separated list of exact origins (scheme, host, and port; no paths).

Local Auth redirects must allow the SPA URL in the local Supabase configuration. The repository config permits the two standard local Vite origins. Hosted Auth redirect settings are separate and have not been changed.

## Request contract

Invitation creation:

```json
{
  "action": "invite",
  "email": "person@example.test",
  "role": "enumerator",
  "districtId": "00000000-0000-4000-8000-000000000001",
  "idempotencyKey": "00000000-0000-4000-8000-000000000002"
}
```

Cancellation:

```json
{
  "action": "cancel",
  "invitationId": "00000000-0000-4000-8000-000000000003"
}
```

The function returns only safe result codes. It does not disclose whether an Auth account already exists or log request emails, invitation links, tokens, credentials, or raw provider errors. A `202` result indicates an existing or uncertain operation; it is not confirmation of email delivery. Do not retry an uncertain Auth outcome or implement resend by calling `inviteUserByEmail` again.

## Hosted rollout and verification

The hosted project `qghesdscscclbfevbypb` has migrations `20261205000000` through `20261208000000` applied, and this function is deployed with JWT verification enabled. A no-credential endpoint check returned HTTP 401 as expected. The production SPA/Auth redirect allowlist and real email delivery have not been verified with a recipient link. The function defaults invitation redirects to `https://student-data-survay-app.vercel.app`; confirm that URL remains allowed in Supabase Auth before testing a real invitation. No Vercel deployment was performed.
