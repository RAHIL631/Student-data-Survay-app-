# `invite-user` Edge Function

This function creates and cancels invitations using the existing invitation database functions. It is not deployed by this change.

## Security boundary

- JWT verification is enabled in `supabase/config.toml`. The function also verifies the bearer token with Supabase Auth before handling a request.
- Invitation scope and role authorization are enforced by `request_user_invitation` in PostgreSQL using the caller's authenticated identity. Organization and district IDs from the request are not trusted.
- The service-role key is read only from the Edge Function runtime. It is never sent to or used by the browser.
- A database claim must succeed before `inviteUserByEmail` is called. Retried requests cannot issue another Auth request for the same invitation.
- Cancellation uses the caller's JWT and `cancel_user_invitation`; PostgreSQL checks the caller's current role and scope.
- The acceptance RPC provisions a profile only for the exact Auth user recorded against the invitation, after confirmed email verification. It rejects cancelled invitations.
- The SPA invitation page requires the recipient to choose and confirm a password. It updates the Auth account through `auth.updateUser` before calling the acceptance RPC; passwords are never written to application tables.
- Invitation acceptance and cancellation do not delete orphaned Auth accounts. Resend and operator reconciliation are not implemented.

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

## Hosted rollout requirements

Before any hosted rollout, an owner must separately approve and perform the migration and function deployment. Configure the production SPA origin in `INVITE_ALLOWED_ORIGINS` and the Supabase Auth redirect allowlist first. Verify Auth email delivery, invitation-link expiration, monitoring, and rollback procedures in the hosted project. No hosted project was accessed or changed.
