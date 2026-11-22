# Migration deployment plan

Use the detailed hosted runbook in [hosted-supabase-migration-plan.md](../deployment/hosted-supabase-migration-plan.md). That document contains the recorded hosted baseline, seven forward-only migration order, backup and preflight requirements, data/Auth boundaries, post-deploy verification SQL, rollback considerations, and manual Auth/Vercel/Edge Function setup.

## Current status

- Local branch: `integration`; intended remote is `friend`.
- Local Supabase has the full migration chain through `20261128000000_fix_si_reservation_parameter_ambiguity.sql`.
- Hosted Supabase was last inspected read-only at 11 applied migrations (`001`–`009`, `20261120175954`, `20261121100000`). Recheck immediately before any future deployment.
- All seven migrations after that baseline are prepared locally only. No hosted migration, Auth setting, Edge Function, data transfer, Vercel deployment, commit, or push was performed.
- A fresh full hosted backup and explicit deployment approval are required before any hosted write.

## Safety rules

Never reset hosted Supabase, replay/rename an applied migration, directly modify `auth.users`, delete local records, or put service-role credentials in the frontend. If migration history or preflight results differ from the runbook, stop and review the discrepancy before proceeding.
