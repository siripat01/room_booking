# RoomFlow Project Handoff

This file is the durable context for future engineering sessions. Read it before
making changes, then verify the current branch, working tree, recent commits, and
README because this document can become stale. Update this file whenever a phase
is completed, merged, or materially redesigned.

## Product

RoomFlow is an internal room and physical-resource management platform for a
school or organization. It supports room discovery, bookings and approvals,
waitlists, reminders, QR check-in, paired room kiosks, device administration,
reports, and an existing individual Free/Pro subscription flow.

There is a deliberate product-positioning mismatch:

- Primary direction: an internal school/organization platform.
- Existing behavior: individual SaaS plans and Stripe subscriptions.

Do not expand monetization or remove existing billing without approval. Keep
billing isolated from booking correctness. If RoomFlow is later repositioned as
SaaS, organization membership, tenant isolation, and organization-level billing
should be a separate future project.

## Architecture and Repository Map

Keep the existing domain-oriented modular monolith. Do not split it into
microservices or add Kubernetes, Kafka, or an external broker without a proven
requirement.

- `api/`: Bun, Elysia, Prisma, PostgreSQL, Better Auth, Stripe, email, cron jobs.
- `api/src/booking/`: booking policy, state transitions, and booking APIs.
- `api/src/check-in/`: the shared QR and kiosk check-in policy.
- `api/src/device/`: device credentials, pairing, kiosk status, scans, walk-ins,
  heartbeat, rotation, and revocation.
- `api/src/cron/`: in-process expiration, checkout, reminder, and waitlist jobs.
- `api/prisma/`: schema and reviewed migrations, including raw PostgreSQL SQL.
- `api/test/`: PostgreSQL integration and concurrency tests.
- `web/`: React, Vite, TanStack Router/Query, Tailwind CSS.
- `.github/workflows/main.yml`: current CI workflow.
- `README.md`: user-facing scope, setup, implemented behavior, and roadmap.

API production deploys to Fly.io and runs `bun run migrate` as its release
command. The web application deploys to Vercel.

## Current Phase Status

The improvement roadmap contains six required phases plus one optional flagship
phase. Reporting and documentation are cross-cutting workstreams.

### Phase 1: Booking Correctness — Implemented and merged

Phase 1 is on `main`. Important commits include `0bc7c426` and `148ea7eb`.

- All currently implemented booking creation paths use `BookingPolicyService`:
  normal user/admin booking, kiosk walk-in, and waitlist promotion.
- Rules cover valid/future intervals, active rooms, capacity, configurable
  duration, opening `TimeSlot`, `RoomClosure`, room roles, user/room overlap,
  advance limits, and active-booking limits.
- Business calendar rules explicitly use `Asia/Bangkok`; database timestamps
  remain UTC `TIMESTAMPTZ` values. Do not introduce locale-string round trips.
- PostgreSQL GiST exclusion constraints prevent overlapping active room and user
  bookings. Application checks remain for readable errors.
- Creation uses serializable transactions and retries retryable database errors.
- The booking state machine and `BookingEvent` history are enforced.

State machine:

```text
PENDING    -> CONFIRMED | REJECTED | CANCELLED
CONFIRMED  -> CHECKED_IN | CANCELLED | EXPIRED
CHECKED_IN -> COMPLETED
```

`COMPLETED`, `CANCELLED`, `REJECTED`, and `EXPIRED` are terminal.

Recurring bookings do not exist yet. When introduced in Phase 6, every generated
occurrence must call the same booking policy inside a correct transaction.

Migration: `20260819000000_booking_correctness_phase1`.

### Phase 2: QR, Kiosk, and Device Security — Implemented and merged

Phase 2 was merged into `main` through PR #78 at merge commit `3520f789`.

- `CheckInPolicyService` is the single source of truth for this inclusive window:

  ```text
  startTime - 10 minutes <= check-in <= startTime + 12 minutes
  ```

- QR credentials are random, short-lived, single-use, SHA-256 hashed, and bound
  to the correct booking room and authenticated kiosk device.
- The ordinary authenticated-user endpoint cannot bypass the kiosk/device check.
- Kiosk camera availability comes from the backend check-in window.
- Device keys are random and stored hashed. Plaintext is returned only at create,
  pair, rotate, or reactivate time.
- Rotation invalidates old credentials; revocation disables the device and live
  pairing codes; reactivation always issues a new credential.
- Pairing codes are HMAC-hashed, expire after ten minutes, are atomically
  single-use, and resist brute-force attempts through PostgreSQL-backed limits.
- Pairing, scans, walk-ins, and heartbeat endpoints use database-backed rate
  limiting that works across API instances.
- Device online status derives from heartbeat freshness: kiosk heartbeat every
  30 seconds, considered online for 90 seconds.
- Each kiosk has a dedicated system/walk-in principal. Walk-ins require requester
  metadata, become `CHECKED_IN` atomically, and create auditable booking events.

Migration: `20260819010000_device_and_qr_security_phase2`.

The Phase 2 migration intentionally retains scrubbed legacy credential columns
for rolling-deploy compatibility. Add a later cleanup migration only after every
deployed API instance uses the new hashed columns.

### Phase 3: Notification Replacement — Implemented and locally validated; awaiting commit/merge

Implementation is on `agent/notification-phase3`.

- `EmailNotificationProvider` and `LineMessagingProvider` implement one provider
  abstraction; `WebPushProvider` remains an optional future extension.
- LINE Notify code, token storage, routes, and UI were removed. LINE Messaging
  identities are linked through a signed webhook and an HMAC-hashed, expiring,
  atomically single-use bot code. Only the LINE user ID is stored.
- A PostgreSQL outbox stores notification jobs with unique idempotency keys,
  bounded retries, lock ownership, safe errors, and provider message IDs.
- Workers claim jobs with `FOR UPDATE SKIP LOCKED`. Resend idempotency keys and
  LINE retry keys reduce duplicate provider delivery after worker failures.
- User preferences cover channels and booking/reminder/waitlist event classes.
- Booking transitions enqueue after core transactions and catch enqueue failures;
  provider delivery is always asynchronous and cannot roll back bookings.
- Reminder scans remain safe if multiple instances run because job keys are
  unique and sent markers are updated only after successful enqueue.
- Automated tests suppress real provider delivery when `NODE_ENV=test` or
  `NOTIFICATIONS_DISABLED=true`.
- `.env.example` documents placeholder-only notification and Stripe variables.

Migration: `20260821000000_notification_phase3`. It intentionally scrubs obsolete
LINE Notify tokens because they cannot be converted to Messaging API user IDs.
The constrained empty legacy column remains for one rolling deployment and should
be dropped only after all API machines run Phase 3. Users must link the bot again.

### Phase 4: Safe Jobs and Auditability — Not started; event foundation exists

`BookingEvent` exists from Phase 1 and notification retry jobs exist from Phase 3,
but the phase is not complete.

- Replace per-instance `setInterval` execution with PostgreSQL advisory locks or
  a database-backed job table using `FOR UPDATE SKIP LOCKED`.
- Make expiration, automatic checkout, and scheduled waitlist promotion safe
  across multiple application instances. Notification retries and reminder job
  deduplication are already database-backed from Phase 3.
- Prevent duplicate reminders and make job execution observable/retryable.
- Complete audit coverage for booking, device, room, and job events with actors,
  targets, previous/new status, safe metadata, and correlation IDs.
- Add an admin-only booking timeline.

### Phase 5: Automated Quality — Partially implemented

Existing coverage includes booking policy, check-in policy, notification template,
LINE signature/link hashing unit tests, PostgreSQL booking-concurrency tests,
Phase 2 device-security tests, and Phase 3 notification worker/idempotency/retry
integration tests. This does not yet satisfy the full phase.

Still required:

- Reliable CI test database and migration validation.
- Full API tests for RBAC, ownership, waitlist, reminders, and Stripe webhook
  idempotency.
- Frontend component tests for critical states.
- Optional Playwright E2E for the primary booking-to-completion flow.
- Lint and format commands.
- CI gates for lint, type-check, unit/integration tests, migration validation,
  frontend/backend builds, and Docker build.
- Correct cache keys for actual lockfiles and pinned important runtime/container
  versions instead of `latest`.
- A professional health response if it is still informal.

Required E2E flow:

```text
User signs in
-> searches an available room
-> creates booking
-> admin approves
-> user generates QR in the valid window
-> the correct kiosk checks in
-> booking completes
```

### Phase 6: High-Value Features — Not started

Begin only after booking correctness, device security, safe jobs, and critical
tests are complete.

1. `BookingSeries` with weekly recurrence, conflict preview, occurrence/future/
   whole-series edits and cancellations, and clear conflict alternatives.
2. Real-time room status using SSE unless WebSockets become necessary; keep
   polling fallback with backoff.
3. Deterministic smart alternatives ranked by nearby time, equivalent room, and
   combined room/time fit. Do not use AI for availability selection.

### Optional Flagship: Smart Occupancy — Not started and not required

Keep this feature-flagged so booking works without hardware. Future work may add
authenticated sensor telemetry, retention/downsampling, actual-versus-reserved
usage, no-show detection, early-release suggestions, and occupancy alerts. Never
cancel a booking from one sensor reading; use a configurable confirmation window
and audit every decision.

## Reporting and Documentation Workstreams

Reports currently exist but remain basic. Future reporting should use booking
time, not creation time, where appropriate and add duration-based occupancy,
no-show and cancellation rates, approval latency, average duration, capacity
utilization, actual versus reserved use, device uptime, Bangkok peak hours, and
room/floor/date-range breakdowns.

The README has Phase 1/2 and setup notes, but still needs the complete architecture
diagram, full environment reference, detailed QR/device flows, CI/CD explanation,
demo and screenshot placeholders, trade-offs, limitations, and an accurate
implemented-versus-roadmap inventory. Never claim unimplemented features as done.

## Development and Validation

Use a direct PostgreSQL connection or session pooler on port 5432 for interactive
transactions. Do not use a transaction pooler such as port 6543.

```bash
# API
cd api
bun install --frozen-lockfile
bun run prisma generate
bun run migrate
bun test

# PostgreSQL integration tests: use a dedicated disposable database
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/room_booking_test \
  bun run test:integration

# API type-check (TypeScript may be supplied by the web workspace locally)
../web/node_modules/.bin/tsc -p tsconfig.json --noEmit

# Web
cd ../web
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm run build
```

Never point integration tests at production or a shared development database.
Never send real notifications in tests. Do not print `.env`, credentials, tokens,
pairing codes, QR plaintext, or Fly/Vercel/GitHub secrets.

## Last Verified Results

Before the Phase 2 commit, all 25 tests passed against a fresh PostgreSQL 16
database, including concurrency, QR room/expiry/grace/replay, credential rotation,
revocation/reactivation/pairing, audited walk-ins, and atomic database rate limits.
Prisma validation, backend/frontend type-checks, frontend build, all migrations,
and the production Docker build passed.

After merging current `main` into the Phase 2 branch:

- 20 unit tests passed and 0 failed.
- 5 PostgreSQL integration tests were skipped because `TEST_DATABASE_URL` was not
  provided in that validation run; they had passed before the merge.
- Backend and frontend type-checks passed.
- Frontend production build passed with only the existing large-chunk warning.
- A merge-tree check against `origin/main` reported no remaining conflict.

During Phase 3 local validation:

- All 13 migrations applied from an empty PostgreSQL 16.10 database. The same
  migration chain also passed on local PGlite with `pgcrypto` and `btree_gist`.
- All 37 tests passed and 0 failed on PostgreSQL 16.10, including 9 integration
  tests for
  booking concurrency, device security, notification idempotency, multi-worker
  claiming, retry, duplicate reminder prevention, and single-use LINE linking.
- Backend and frontend type-checks passed.
- Frontend production build passed with only the existing large-chunk warning.
- Prisma schema validation and generation passed.
- The Docker socket remained inaccessible, but a pinned PostgreSQL 16.10 Podman
  container provided production-engine migration and integration validation.

Re-run the relevant checks instead of relying only on this historical result.

## Working Rules for Future Sessions

1. Inspect the repository and current branch before modifying it.
2. Read this file and `README.md`, then inspect any newer repository instructions.
3. Preserve unrelated changes. Never use broad staging in a mixed working tree.
4. Keep the modular-monolith and domain-oriented structure.
5. Route every booking creation path through the shared booking policy.
6. Route every QR/kiosk check-in path through the shared check-in policy.
7. Keep Bangkok calendar logic explicit and UTC storage unchanged.
8. Keep database constraints even when application validation exists.
9. Work in small phases with stated acceptance criteria and proportional tests.
10. Do not commit or push without explicit user authorization.
11. Never expose secrets or use production data for tests.
12. Do not expand billing while working on core resource-management correctness.

At this handoff, top-level untracked `package.json` and `bun.lock` files existed in
the working tree. They were not part of Phase 1 or Phase 2 and must be treated as
user-owned unless the user explicitly places them in scope.

## Recommended Next Session

1. Review and commit the validated Phase 3 changes without staging the unrelated
   top-level `package.json` and `bun.lock` files.
2. Configure a test LINE Messaging channel and signed webhook only for manual
   staging verification; never use real provider credentials in automated tests.
3. Merge `agent/notification-phase3` before beginning Phase 4.
4. Update this file and README when the phase status changes.
