# RoomFlow

RoomFlow is a room and physical-resource management platform for schools and
organizations. It combines room discovery, policy-enforced booking, approvals,
waitlists, QR check-in, paired room kiosks, notifications, operational jobs,
audit history, reports, and an existing individual Free/Pro subscription flow.

The repository is a domain-oriented modular monolith. The API and web client are
deployed independently, while PostgreSQL remains the source of truth for booking
correctness, concurrency control, durable jobs, and audit history.

## Product scope

The primary product is an internal school or organization platform. The existing
individual Free/Pro and Stripe behavior is retained for compatibility and is
isolated from core booking correctness.

This creates a known positioning mismatch:

- Primary direction: internal organization resource management.
- Existing billing model: individual SaaS subscriptions.

RoomFlow is not currently multi-tenant. A future SaaS repositioning should add
organizations, tenant isolation, membership, and organization-level billing as a
separate project. It should not extend the current individual billing model into
the booking domain.

## Implemented features

| Area | Status | Highlights |
| --- | --- | --- |
| Phase 1 — Booking correctness | Implemented | Shared booking policy, Bangkok calendar rules, state machine, PostgreSQL overlap constraints, history |
| Phase 2 — QR, kiosk, and device security | Implemented | Room-bound single-use QR, hashed device credentials, secure pairing, audited walk-ins, database rate limits |
| Phase 3 — Notifications | Implemented | Resend email, LINE Messaging API, preferences, transactional outbox, retries and idempotency |
| Phase 4 — Background jobs and audit | Implemented | PostgreSQL job queue, `SKIP LOCKED` workers, stale-lock recovery, audit timeline |
| Phase 5 — Automated quality | Implemented | Unit, PostgreSQL integration, component, migration, route-compilation, Docker startup, and build gates |
| Phase 6 — High-value features | Implemented | Pro weekly recurrence, SSE room status, deterministic smart alternatives |
| Smart occupancy | Not implemented | Optional future feature; normal booking does not require hardware |

Additional implemented workflows include room opening hours and closures,
role-based room access, admin approval, waitlist promotion, reminders, Stripe
webhook deduplication, device revocation and rotation, and administrative reports.

## Architecture

```mermaid
flowchart LR
  User[User or admin browser] --> Web[React + TanStack web app]
  Kiosk[Paired room kiosk] --> API[Bun + Elysia API]
  Web --> API
  API --> Auth[Better Auth]
  API --> Domains[Domain services]
  Domains --> Policy[BookingPolicyService<br/>CheckInPolicyService]
  Domains --> DB[(PostgreSQL)]
  DB --> Constraints[GiST exclusion constraints]
  DB --> Jobs[Background and notification jobs]
  DB --> Audit[BookingEvent and AuditLog]
  Worker[In-process workers] --> Jobs
  Jobs --> Providers[Resend and LINE Messaging API]
  API --> SSE[Database-backed SSE]
  SSE --> Web
  SSE --> Kiosk
```

The workers run inside API instances, but coordination is database-backed. A
unique job key prevents duplicate scheduling and workers claim rows with
`FOR UPDATE SKIP LOCKED`. No external broker is required for the current load and
operational model.

### Repository map

```text
apps/
├── api/                       Bun, Elysia, Prisma, PostgreSQL
│   ├── prisma/                Schema and reviewed migrations
│   ├── scripts/               Migration entrypoint
│   ├── src/
│   │   ├── booking/           Policy, state machine, series, alternatives
│   │   ├── check-in/          Shared QR and kiosk check-in policy
│   │   ├── device/            Pairing, credentials, heartbeat, walk-ins
│   │   ├── notification/      Providers, outbox, LINE linking
│   │   ├── jobs/              Durable scheduling and workers
│   │   ├── audit/             Append-only audit service
│   │   └── realtime/          PostgreSQL-backed SSE
│   └── test/                  Unit and PostgreSQL integration tests
├── web/                       React, Vite, TanStack Router and Query
├── docs/                      Operational setup guides
└── .github/workflows/         CI/CD quality and deployment gates
```

## Booking correctness

Every implemented creation path calls `BookingPolicyService`:

- Normal authenticated-user and admin bookings
- Kiosk walk-ins
- Waitlist promotion
- Recurring preview, creation, and edits

The server validates:

- `startTime < endTime` and start time is not in the past
- Room existence, active state, capacity, and allowed roles
- Configurable duration, advance-booking, and active-booking limits
- Active room `TimeSlot` opening hours
- Full-day and partial `RoomClosure` periods
- Overlapping active bookings for both the user and room
- Explicit `Asia/Bangkok` business dates and weekdays

Timestamps are stored as UTC PostgreSQL `TIMESTAMPTZ` values. Calendar rules use
explicit timezone conversion and never use locale-string round trips.

Application checks return readable errors. PostgreSQL GiST exclusion constraints
are the final concurrency guarantee for active `PENDING`, `CONFIRMED`, and
`CHECKED_IN` room and user ranges. Serializable transactions retry recognized
serialization and deadlock failures.

### Booking state machine

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> CONFIRMED
  PENDING --> REJECTED
  PENDING --> CANCELLED
  CONFIRMED --> CHECKED_IN
  CONFIRMED --> CANCELLED
  CONFIRMED --> EXPIRED
  CHECKED_IN --> COMPLETED
  REJECTED --> [*]
  CANCELLED --> [*]
  EXPIRED --> [*]
  COMPLETED --> [*]
```

Terminal states cannot return to active states. Each creation and transition
writes a correlated `BookingEvent`; cross-domain administrative activity is also
recorded in `AuditLog` with safe metadata.

## QR, kiosk, and device flow

All entry points use this inclusive check-in window:

```text
startTime - 10 minutes <= check-in <= startTime + 12 minutes
```

```mermaid
sequenceDiagram
  participant User
  participant API
  participant Kiosk
  participant DB as PostgreSQL

  User->>API: Request QR inside check-in window
  API->>DB: Store SHA-256 token hash and short expiry
  API-->>User: Return plaintext QR once
  User->>Kiosk: Present QR
  Kiosk->>API: Device ID + device key + QR token
  API->>DB: Verify device, room, booking, window, status, and unused hash
  DB-->>API: Atomically consume token and transition booking
  API-->>Kiosk: CHECKED_IN booking or safe rejection
```

- QR tokens use 32 random bytes, are short-lived, stored hashed, room-bound, and
  atomically single-use.
- User check-in cannot bypass the correct paired room device.
- Device keys use 32 random bytes and are stored only as hashes. Plaintext is
  shown once when a device is created, paired, rotated, or reactivated.
- Pairing codes are HMAC-hashed, expire after ten minutes, are single-use, and
  are protected by PostgreSQL-backed brute-force limits.
- Revocation disables the device and active pairing codes. Rotation invalidates
  the old credential immediately. Reactivation always issues a new credential.
- Online status is derived from heartbeat freshness: kiosks heartbeat every 30
  seconds and are considered online for 90 seconds.
- Walk-ins use a dedicated system principal per kiosk and require auditable
  requester metadata. Successful creation enters `CHECKED_IN`; the UI does not
  report a pending booking as checked in.

## Recurring bookings, real-time status, and alternatives

Weekly recurrence is available only while an individual Pro entitlement is
active. A series supports preview, atomic creation, one/future/whole-series edits,
and one/future/entire cancellation. Conflicting dates and deterministic
alternatives are returned before creation. Free users can list and cancel their
existing series but cannot create or edit recurrence.

When Stripe schedules cancellation at period end, recurring access remains until
`planExpiresAt`. A durable expiry job then downgrades the user and cancels active
series plus future active occurrences. An immediately inactive subscription does
the same inside the idempotent webhook transaction.

Safe room and device changes are published through database-backed Server-Sent
Events. Clients reconnect with exponential backoff and retain polling as a
fallback. Smart alternatives are explainable and ordered as follows:

1. The same room at a nearby time.
2. Another suitable room at the same time.
3. The closest valid room-and-time combination.

Every alternative is revalidated by `BookingPolicyService`; no AI is used to
decide availability.

## Notifications and background jobs

Notification delivery uses a PostgreSQL outbox and does not run inside booking
transactions. Failures therefore cannot roll back a booking.

- `EmailNotificationProvider` uses Resend idempotency keys.
- `LineMessagingProvider` uses LINE Messaging API and `X-Line-Retry-Key`.
- LINE Notify is obsolete and is not used.
- Users store a linked LINE user ID, not a LINE Notify token.
- User preferences control channels, booking updates, reminders, and waitlist
  promotion.
- Workers persist retries with bounded exponential backoff and safe errors.
- Tests disable real provider delivery.

Required durable jobs include booking expiration, automatic checkout, reminder
enqueueing, waitlist promotion, notification retries, terminal-job retention,
and Pro-entitlement expiration. See
[`docs/line-messaging-setup.md`](docs/line-messaging-setup.md) for provider setup.

## Local development

### Prerequisites

- Bun `1.3.14`
- Node.js `22`
- pnpm `11.0.9`
- PostgreSQL `17` recommended; the included Compose service provides PostgreSQL
- Docker or another OCI-compatible engine for local PostgreSQL and image checks

### 1. Start PostgreSQL

```bash
cd api
docker compose up -d postgres
```

The development Compose file exposes PostgreSQL on `localhost:5432`. Use a
direct connection or session pooler. Do not use a transaction pooler for booking
transactions because the API uses interactive serializable transactions.

### 2. Run the API

```bash
cd api
cp .env.example .env
bun install --frozen-lockfile
bun run prisma generate
bun run migrate
bun run dev
```

Configure `DATABASE_URL` for the local database before migration. The API listens
on `http://localhost:3000`; health is available at
`http://localhost:3000/api/health`.

### 3. Run the web application

```bash
cd web
cp .env.example .env
pnpm install --frozen-lockfile
pnpm run dev
```

The web application listens on `http://localhost:3001`.

## Environment variables

Committed examples contain placeholders only. Never commit real credentials.

### API

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Direct/session PostgreSQL connection used by Prisma |
| `TEST_DATABASE_URL` | Tests | Dedicated disposable integration-test database |
| `NODE_ENV` | Yes | Runtime mode: `development`, `test`, or `production` |
| `APP_VERSION` | Recommended | Version returned by `/api/health` |
| `FRONTEND_URL` | Yes | Allowed production CORS origin |
| `BETTER_AUTH_URL` | Yes | Public API/auth base URL |
| `BETTER_AUTH_SECRET` | Yes | Better Auth and pairing-code HMAC secret, at least 32 characters |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth credentials |
| `BOOKING_MAX_DURATION_MINUTES` | No | Maximum booking duration; default `240` |
| `BOOKING_FREE_ADVANCE_DAYS` | No | Free-user advance window; default `3` |
| `BOOKING_PRO_ADVANCE_DAYS` | No | Pro advance window; default `30` |
| `BOOKING_USER_ACTIVE_LIMIT` | No | Default active-booking limit; default `3` |
| `BOOKING_TEACHER_ACTIVE_LIMIT` | No | Teacher active limit; default `5` |
| `BOOKING_PRO_ACTIVE_LIMIT` | No | Pro active limit; default `10` |
| `BOOKING_SERIES_MAX_OCCURRENCES` | No | Recurring occurrence limit; default `26` |
| `BOOKING_SERIES_MAX_SPAN_DAYS` | No | Recurring series span; default `366` |
| `NOTIFICATIONS_DISABLED` | No | Must be `true` in tests that must not contact providers |
| `NOTIFICATION_MAX_ATTEMPTS` | No | Notification retry limit; default `5` |
| `NOTIFICATION_WORKER_INTERVAL_MS` | No | Notification worker polling interval |
| `NOTIFICATION_JOB_RETENTION_DAYS` | No | Sent/cancelled job retention; default `90` |
| `FAILED_NOTIFICATION_JOB_RETENTION_DAYS` | No | Failed job retention; default `180` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Production email | Resend credentials and verified sender |
| `LINE_CHANNEL_ACCESS_TOKEN` | Production LINE | LINE Messaging channel token |
| `LINE_CHANNEL_SECRET` | Production LINE | LINE webhook signature secret |
| `LINE_BOT_BASIC_ID` | Production LINE | Bot ID shown to users during linking |
| `BACKGROUND_JOB_SCHEDULE_INTERVAL_MS` | No | Durable scheduler interval |
| `BACKGROUND_JOB_LOCK_TIMEOUT_MS` | No | Stale worker-lock timeout |
| `BACKGROUND_JOB_MAX_ATTEMPTS` | No | Background-job retry limit |
| `BACKGROUND_JOB_RETENTION_DAYS` | No | Completed-job retention; default `30` |
| `JOB_HEALTH_MAX_DUE_AGE_MS` | No | Oldest-due readiness threshold |
| `JOB_HEALTH_BACKGROUND_FAILED_THRESHOLD` | No | Background failure alert threshold |
| `JOB_HEALTH_NOTIFICATION_FAILED_THRESHOLD` | No | Notification failure alert threshold |
| `JOB_HEALTH_LOG_INTERVAL_MS` | No | Structured degraded-health log interval |
| `REALTIME_POLL_INTERVAL_MS` | No | PostgreSQL-backed SSE polling; default `2000` |
| `STRIPE_SECRET_KEY` | Existing billing | Stripe server credential |
| `STRIPE_PRICE_ID` | Existing billing | Individual Pro price |
| `STRIPE_WEBHOOK_SECRET` | Existing billing | Stripe webhook signature secret |
| `WEB_URL` | Existing billing | Browser return URL for Stripe flows |

See [`api/.env.example`](api/.env.example) for safe example values.

### Web

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin used by Eden Treaty, for example `http://localhost:3000` |
| `VITE_BACKEND_URL` | Backend origin used by authentication |
| `VITE_FRONTEND_URL` | Public web origin |

See [`web/.env.example`](web/.env.example).

## Migration process

```bash
cd api
bun install --frozen-lockfile
bun run prisma generate
bun run migrate
bun run prisma migrate status
```

`bun run migrate` runs committed `prisma migrate deploy` migrations and retries
only transient database/DNS failures with bounded backoff. Fly.io runs this as a
release command before replacing machines. Never use `prisma db push` in
production.

Several migrations contain reviewed PostgreSQL SQL for exclusion constraints,
range operations, backfills, and durable-job checks that Prisma cannot express.
Phase 1 migration preflight intentionally stops instead of deleting or rewriting
invalid or overlapping production bookings.

## Tests and quality commands

```bash
# API: database-independent checks
cd api
bun run lint
bun run typecheck
bun run test:unit
bun run test:routes

# API: requires a migrated, disposable PostgreSQL database
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/room_booking_test \
  bun run test:integration

# Web
cd ../web
pnpm run lint
pnpm test
pnpm exec tsc --noEmit
pnpm run build
```

Never point integration tests at production or a shared development database.
Automated tests set `NOTIFICATIONS_DISABLED=true` and do not contact Resend, LINE,
or Stripe delivery endpoints.

Backend coverage includes capacity, opening hours, closures, user and room
overlap, simultaneous booking requests, RBAC and ownership, QR wrong-room/time/
replay cases, waitlist promotion, duplicate reminders, device rotation, Stripe
webhook idempotency, recurring transactions, and safe SSE delivery. Frontend
component tests cover critical booking timeline and destructive-device states.

## CI/CD

```mermaid
flowchart TD
  Change[Push or pull request] --> Backend[Backend lint, schema, migrations,<br/>unit, integration, route graph, types]
  Change --> Frontend[Frontend lint, component tests,<br/>types and Vite build]
  Backend --> Image[Build production API image]
  Image --> Smoke[Migrate fresh PostgreSQL from image<br/>start image and require healthy API]
  Smoke --> Fly[Deploy API to Fly.io]
  Fly --> PublicHealth[Verify public /api/health]
  Frontend --> Vercel[Vercel production deploy]
  PublicHealth --> Vercel
```

The workflow uses lockfile-aware caches and pinned Bun, Node.js, pnpm,
PostgreSQL, Fly CLI, and Vercel CLI versions. Production deployment runs only on
`main`. Pull requests and `development` pushes still run the relevant quality
gates; preview deployment remains separate from production.

The full application route graph is compiled in CI because Elysia route conflicts
can pass TypeScript and Docker build checks but fail during server startup. CI
also starts the exact production image and requires a healthy database-backed
response before Fly deployment is allowed.

## Operations

- `GET /api/health` is public and returns database readiness, service name,
  version, and timestamp. It returns HTTP `503` when readiness is degraded.
- `GET /api/operations/jobs/health` is admin-only and exposes safe queue counts,
  delayed work, retained failures, and stale processing locks.
- Booking timelines are admin-only and correlate booking events with safe audit
  records.
- Fly.io keeps at least one API machine running and checks `/api/health` every 30
  seconds.

## Live demo and screenshots

- Web demo: `TBD — add the production Vercel URL`
- API health: [room-booking-api.fly.dev/api/health](https://room-booking-api.fly.dev/api/health)
- Screenshots: `TBD — add room search, booking approval, QR, kiosk, and admin timeline images`

Place future portfolio screenshots under `docs/screenshots/` and replace the
placeholders only after verifying the deployed flow.

## Trade-offs

- A modular monolith keeps transactions, booking policy, and audit consistency
  simple. Independent services would add operational cost without a current load
  requirement.
- PostgreSQL acts as both source of truth and durable coordination layer. This
  avoids a broker while providing concurrency constraints, idempotent jobs, and
  multi-instance workers.
- Notifications and jobs are at-least-once. Database idempotency plus Resend and
  LINE provider keys reduce duplicates, but a provider that accepts a request and
  loses the response can still create a narrow duplicate-delivery window.
- SSE is sufficient for one-way room-status updates and works with polling
  fallback. WebSockets are unnecessary for the implemented event model.
- Individual Pro billing is retained for compatibility even though the primary
  product direction is organization-internal resource management.

## Known limitations

- Organization tenancy and organization-level billing are not implemented.
- Reports exist, but the full operational metric set—duration-based occupancy,
  no-show rate, approval latency, actual-versus-reserved use, and device uptime—
  is not yet complete.
- The full Playwright sign-in-to-completion flow is not implemented. Current
  quality gates use unit, PostgreSQL integration, HTTP RBAC, component, migration,
  build, and production-image startup tests.
- External metrics/alert integration and a dedicated operations dashboard remain
  future work; an admin health API and structured warnings provide current
  visibility.
- Frontend production build has a known large main-chunk warning and would benefit
  from additional route-level code splitting.
- Smart occupancy and sensor telemetry are not implemented.

## Roadmap

1. Complete operational reports using booking time and `Asia/Bangkok` date
   boundaries: occupancy duration, no-show and cancellation rates, approval
   latency, capacity use, device uptime, and peak hours.
2. Add the deterministic Playwright booking-to-completion flow with isolated test
   identities and a paired kiosk fixture.
3. Add external metrics/alerts and improve frontend code splitting.
4. If product direction becomes SaaS, design organization tenancy and
   organization-level billing as a separate project.
5. Optionally design feature-flagged smart occupancy with authenticated telemetry,
   retention/downsampling, confirmation windows, and audited recommendations.

Smart occupancy must never cancel a booking from a single sensor reading, and the
normal booking system must continue to work without hardware.
