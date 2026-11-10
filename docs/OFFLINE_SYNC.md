# Offline synchronization

Student screening submissions created without connectivity are retained in IndexedDB and synchronized through the signed-in Supabase client when connectivity returns. The client never uses a service-role key; existing authentication and row-level security policies continue to apply.

Each queued submission has a stable UUID used as its `student_screenings.id` on every attempt. The database primary key and existing `(organization_id, si_number)` unique constraint protect against duplicate inserts. When Supabase reports a duplicate, the app performs organization-scoped reads subject to RLS:

- If the row with the saved UUID matches the queued submission, the retry is treated as already saved.
- If that UUID now identifies different data, the item is marked as a **server record changed** conflict.
- If the SI number identifies different data, the item is marked as an **SI number conflict**.
- If RLS prevents verification, the item remains an **unverified conflict**; it is not treated as synced.

Conflicts are preserved in IndexedDB and are not retried automatically. The registration page shows local and readable server details. An enumerator may explicitly acknowledge the server version; this marks the local item resolved but retains its local payload and does not send or overwrite either record. If the correct choice is uncertain, leave the conflict unresolved and ask an organization administrator to review it.

Temporary network and server errors remain retryable with exponential backoff. Validation, authorization, and conflict errors are not retried automatically. A successful response or verified exact duplicate is required before a queued item is marked synced.

The current flow handles new student submissions, not offline editing. No database migration or RLS policy change is required for this behavior.
