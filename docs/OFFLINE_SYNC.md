# Offline synchronization status

**Offline submission and synchronization are not implemented on `integration`.** Production student screening writes use the signed-in Supabase client and require network access. The application does not queue production submissions in IndexedDB, retry them in the background, or provide offline conflict resolution. Do not use this application to collect real student records while disconnected.

The optional local test sign-in is a separate development-only mode. Its test records are stored in browser storage and are not production data or an offline synchronization queue.

The local schema includes active profiles, ownership metadata, multi-enumerator session assignments, and manual SI-number reservations. Those online safeguards do not implement offline submission. The reservation RPC requires a signed-in caller, a target session, the manually entered SI number, an idempotency key, and (for edits) the student record ID. An offline client cannot safely assume an SI reservation or a successful write.

The collaborator offline queue is not included. Before a future offline feature is enabled, its local storage, student-data-at-rest, device-loss, account-switch/logout retention, retry/idempotency, manual SI reservation, conflict resolution, and authorization behavior must be redesigned and tested against the current schema and RLS. Do not advertise offline support until that work ships and is verified.
