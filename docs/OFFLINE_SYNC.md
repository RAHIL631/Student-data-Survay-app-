# Offline synchronization design

**Implementation status on `integration`: not implemented.** This document describes a proposed offline-first workflow; it is not evidence that the current application queues or synchronizes submissions.

The current `integration` branch writes student screenings through `src/lib/dataService.ts` directly to Supabase. Local test mode stores its own test records in browser storage, but production submissions do not use an offline queue. The offline-sync implementation on `chore/project-structure` is not compatible with the current schema: it depends on profile `is_active`, owner-scoped columns, SI reservation tables, and a reservation RPC that are absent from the `integration` migrations and hosted project.

Do not advertise offline submission or merge that implementation until its schema dependencies, RLS policies, idempotency behavior, privacy controls, and migrations have been redesigned and tested against the current schema.
