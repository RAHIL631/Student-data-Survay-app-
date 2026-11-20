# Backup and recovery

## Current verification status

The repository does not establish that the hosted Supabase project has automated backups, point-in-time recovery (PITR), or a particular retention period. The project is treated as production, and no hosted dashboard or project settings were accessed for this work. The project owner must verify the active plan, backup schedule, retention, and restore options in the Supabase Dashboard before relying on them.

The local Supabase database is a development environment, not a production backup. Git migrations and seed files are not backups of user data.

## Owner verification checklist

In the hosted project's Supabase Dashboard, have an authorized owner:

1. Open **Project Settings → Infrastructure/Compute** and verify whether the current plan supports PITR.
2. Open **Database → Backups** and record the latest successful backup, scheduled frequency, retention window, and any PITR range.
3. Confirm who is authorized to request and execute a restore, and how the team will be notified.
4. Confirm whether storage objects and Auth users are covered by the available recovery procedure; database backups alone may not restore external objects or provider configuration.
5. Record the results and a restore contact in the team's approved operations documentation. Do not record credentials, tokens, recovery codes, or secret keys there.

Until this is verified, backup and PITR status must be treated as **unknown**, not configured.

## Recovery procedure

1. Declare the incident and identify the affected project and approximate recovery point. Do not run destructive commands or migrations as an improvised recovery.
2. Ask the project owner to review the available backup/PITR points and approve the target.
3. Prefer restoring to a separate recovery project first. Verify migrations, RLS, Auth users, storage objects, and a representative application workflow there.
4. Compare the recovered data and operational impact with the incident window. Preserve the original project for investigation.
5. Promote a recovered project or restore production only after explicit owner approval, a communication plan, and a rollback plan.
6. Record the restore point, operator, approvals, validation evidence, and any data loss interval without including personal data or secrets.

Do not use `supabase db reset`, `supabase db push --linked`, or any production restore command as a backup/recovery test. Hosted recovery was not performed or verified as part of this repository work.

## Environment and secret handling

- Browser configuration contains only `VITE_SUPABASE_URL` and the public anon key. These are not service-role credentials.
- The Edge Function uses the runtime-provided `SUPABASE_SERVICE_ROLE_KEY` server-side. Never add it to `.env.example`, browser variables, source control, or client requests.
- Local Supabase supplies local-only credentials to its Edge Function runtime. Hosted function secrets and origins require separate owner configuration and approval.
- Rotate credentials through the appropriate Supabase project controls if exposure is suspected; do not paste them into issues, logs, or chat.

## Monitoring

No hosted monitoring configuration was verified. The project owner should confirm database/Auth/Edge Function logs, alerting ownership, log-retention settings, and escalation contacts in the Dashboard. Application errors should be monitored without logging student records, invitation links, access tokens, passwords, or raw invitation-provider responses.
