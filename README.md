# Room Booking System (ระบบจองห้องประชุม)

โปรเจกต์นี้เป็นระบบจองห้องประชุม (Room Booking System) ที่ออกแบบมาเป็น Monorepo โดยแบ่งส่วนการทำงานออกเป็น **Backend (API)** และ **Frontend (Web)**

---

## 🛠️ Tech Stack & Architecture

### 1. Backend (โฟลเดอร์ `/api`)
ระบบหลังบ้านพัฒนาด้วยเทคโนโลยีที่เน้นประสิทธิภาพและความเร็วในการทำงานสูง:
- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Elysia.js](https://elysiajs.com/) (Fast, type-friendly web framework)
- **Database ORM**: [Prisma](https://www.prisma.io/) (PostgreSQL)
- **Authentication**: [Better Auth](https://www.better-auth.com/)
- **Documentation**: OpenAPI Spec / Swagger
- **Deployment**: รองรับ Docker และ Fly.io (`fly.toml`)

### 2. Frontend (โฟลเดอร์ `/web`)
ระบบหน้าบ้านพัฒนาด้วยเว็บแอปพลิเคชันยุคใหม่:
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Framework**: [React](https://react.dev/) + [TanStack Start](https://tanstack.com/router/latest/docs/start/overview) (Full-stack routing & SSR capability)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **Data Fetching**: [TanStack Query (React Query)](https://tanstack.com/query)
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/)
- **Package Manager**: [pnpm](https://pnpm.io/)

### 3. CI/CD (GitHub Actions)
- มีระบบ Workflow ตรวจสอบโค้ดอัตโนมัติเมื่อทำการ `push` หรือสร้าง `pull_request` ไปยังสาขา `main` และ `development`
  - **Backend**: lint, migration validation, unit/integration tests, TypeScript, and Docker build
  - **Frontend**: lint, component tests, TypeScript, and production build

---

## 🚀 Getting Started (เริ่มต้นใช้งาน)

ก่อนเริ่มต้นตรวจสอบให้มั่นใจว่าเครื่องของคุณมี:
- [Bun](https://bun.sh/) ติดตั้งอยู่สำหรับรัน API
- [Node.js](https://nodejs.org/) & [pnpm](https://pnpm.io/) ติดตั้งอยู่สำหรับรัน Web Frontend

### 1. ตั้งค่าและรัน Backend (API)
1. เข้าไปยังโฟลเดอร์ `api`:
   ```bash
   cd api
   ```
2. ติดตั้ง Dependencies:
   ```bash
   bun install
   ```
3. คัดลอกและตั้งค่า Environment Variables (ถ้ายังไม่มี):
   ```bash
   cp .env.example .env   # ตั้งค่า DATABASE_URL และ AUTH variables ใน .env
   ```
4. สร้างโมเดลฐานข้อมูลของ Prisma:
   ```bash
   bun --bun run prisma generate
   ```
5. รันเซิร์ฟเวอร์แบบ Development:
   ```bash
   bun run dev
   ```
   *เซิร์ฟเวอร์หลังบ้านจะทำงานที่: `http://localhost:3000`*

---

### 2. ตั้งค่าและรัน Frontend (Web)
1. เข้าไปยังโฟลเดอร์ `web`:
   ```bash
   cd web
   ```
2. ติดตั้ง Dependencies:
   ```bash
   pnpm install
   ```
3. รันเซิร์ฟเวอร์หน้าบ้านแบบ Development:
   ```bash
   pnpm run dev
   ```
   *หน้าเว็บจะทำงานที่: `http://localhost:3001`*

---

## ⚙️ CI/CD Workflow (GitHub Actions)

`.github/workflows/main.yml` is the merge and deployment quality gate. Backend CI
starts an isolated PostgreSQL 17.6 service, applies the complete migration history
to an empty database, checks migration status, and runs unit, PostgreSQL integration,
and type-check suites with provider delivery disabled. Frontend CI type-checks and
builds the Vite application. A separate Buildx job verifies the production API
Dockerfile before Fly deployment is allowed. Dependency caches use the actual
`api/bun.lock` and `web/pnpm-lock.yaml` files.

CI also compiles the complete Elysia route graph, migrates a fresh PostgreSQL
database from the production image, starts that exact image, and requires a
healthy `/api/health` response. This catches route-composition and startup errors
that static type-checking or a Docker build alone cannot detect. Fly deployment
is followed by a public readiness check, and production web deployment starts
only after the deployed API passes that check.

Fly deployment runs only after backend and Docker gates pass on `main`. Vercel
preview/production deployment remains separate from booking correctness. Bun,
PostgreSQL, Fly CLI, Vercel CLI, Elysia, and TypeScript versions are pinned to
avoid unexpected `latest` upgrades in the critical path.

## Product Scope

RoomFlow is primarily an internal physical-resource management system for a school or organization. The existing individual Free/Pro subscription remains available for compatibility, but billing is not part of the booking correctness boundary.

There is currently a positioning mismatch between the internal organization workflow and individual SaaS billing. A future SaaS version should introduce organizations, tenant isolation, organization membership, and organization-level billing as a separate project.

## Booking Correctness (Phase 1)

Every implemented booking creation path uses `BookingPolicyService`:

- Authenticated user and admin bookings
- Kiosk walk-in bookings
- Waitlist promotion
- Every occurrence created or edited through `BookingSeriesService`

Weekly recurring bookings use the same policy and serializable transaction as
single bookings. A series is created atomically only when every occurrence is
valid; PostgreSQL exclusion constraints remain the final overlap guarantee.

The server enforces:

- A valid future `[startTime, endTime)` interval
- Active room and room capacity
- Configurable duration, advance-booking, and active-booking limits
- Room role restrictions
- Active `TimeSlot` opening hours
- Full-day and partial `RoomClosure` periods
- User and room overlap checks
- Explicit `Asia/Bangkok` calendar rules with UTC instants stored as PostgreSQL `TIMESTAMPTZ`

PostgreSQL GiST exclusion constraints independently prevent active room and user overlaps for `PENDING`, `CONFIRMED`, and `CHECKED_IN` bookings. Application checks remain in place for readable errors, and serializable transactions retry retryable PostgreSQL failures.

## Booking State Machine

```text
PENDING   -> CONFIRMED | REJECTED | CANCELLED
CONFIRMED -> CHECKED_IN | CANCELLED | EXPIRED
CHECKED_IN -> COMPLETED
```

`COMPLETED`, `CANCELLED`, `REJECTED`, and `EXPIRED` are terminal. Each creation and transition writes a `BookingEvent` in the same database transaction with actor, previous/new status, safe metadata, timestamp, and request correlation ID.

## QR, Kiosk, and Device Security (Phase 2)

RoomFlow uses one `CheckInPolicyService` for the booking API, kiosk device API,
kiosk camera window, and booking-expiration job:

```text
startTime - 10 minutes <= check-in <= startTime + 12 minutes
```

- QR tokens use 32 random bytes, expire after at most two minutes, are single-use,
  and are stored only as SHA-256 hashes.
- QR generation is available only inside the check-in window. Check-in requires
  an active, non-revoked device assigned to the booking room; authenticated users
  cannot bypass the kiosk requirement.
- Device credentials use 32 random bytes and are stored only as SHA-256 hashes.
  Plaintext is returned once when created, paired, rotated, or reactivated.
- Rotation invalidates the previous credential immediately. Revocation disables
  the device and invalidates outstanding pairing codes. Reactivation always
  issues a new credential.
- Pairing codes are HMAC-hashed, expire after ten minutes, are atomically
  single-use, and rotate the device credential when consumed.
- Pairing, QR scans, walk-ins, and heartbeats use PostgreSQL-backed rate limits,
  so limits remain effective across multiple API instances.
- Device online status is derived server-side from heartbeat freshness. Kiosks
  heartbeat every 30 seconds and are considered online for 90 seconds.
- Walk-ins use a dedicated system principal per kiosk, require requester metadata,
  enter `CHECKED_IN` state atomically, and record correlated `BookingEvent` entries.

## Durable Notifications (Phase 3)

Notification delivery is isolated from booking transactions through a
PostgreSQL-backed outbox:

- `EmailNotificationProvider` sends through Resend and uses provider idempotency
  keys.
- `LineMessagingProvider` uses LINE Messaging API with `X-Line-Retry-Key`; the
  discontinued LINE Notify API is not used.
- Users link a LINE identity by sending a random, HMAC-hashed, single-use,
  ten-minute code to the configured RoomFlow bot. The signed LINE webhook stores
  only the resulting LINE user ID.
- User preferences control email, LINE, booking updates, 30-minute reminders,
  check-in reminders, and waitlist promotion.
- Jobs have unique idempotency keys, bounded exponential retries, safe error
  details, and PostgreSQL `FOR UPDATE SKIP LOCKED` claiming across API instances.
- Provider failures happen after booking commits and cannot roll back a booking.
- Concurrent reminder scanners may run on multiple instances; database
  idempotency prevents duplicate jobs.
- `NODE_ENV=test` or `NOTIFICATIONS_DISABLED=true` suppresses all real provider
  calls during automated tests.

Required production notification variables are documented in `api/.env.example`:
`RESEND_API_KEY`, `EMAIL_FROM`, `LINE_CHANNEL_ACCESS_TOKEN`,
`LINE_CHANNEL_SECRET`, and `LINE_BOT_BASIC_ID`. Configure the LINE Developers
webhook URL as `https://<api-host>/api/line/webhook`.

For the exact LINE Official Account, LINE Developers Console, Fly secret,
webhook, manual verification, and credential-rotation steps, see
[`docs/line-messaging-setup.md`](docs/line-messaging-setup.md).

## Safe Background Jobs and Auditability (Phase 4)

Scheduled maintenance uses PostgreSQL as the durable coordination layer. Each
API instance may wake the scheduler, but a unique time-bucketed `job_key` creates
only one persisted job per task and interval. Workers claim different rows with
`FOR UPDATE SKIP LOCKED`:

```text
API instances
  -> idempotent background_jobs scheduler
  -> SKIP LOCKED workers
  -> booking state machine / notification outbox / waitlist policy
  -> append-only audit_logs
```

The job types are booking expiration, automatic checkout, reminder enqueueing,
waitlist promotion, and terminal-job retention. Jobs have bounded exponential
retry, stale-lock recovery, safe errors, structured results, and 30-day completed
history by default. Sent/cancelled notification jobs default to 90-day retention;
failed notification jobs default to 180 days. Audit history is not removed by job
retention. Notification delivery continues to use its dedicated outbox.

Waitlist promotion periodically retries available future slots through
`BookingPolicyService`; entries whose start time has passed become `EXPIRED`.
Concurrent promotion remains protected by serializable transactions and the
booking exclusion constraints.

`AuditLog` records safe booking, room, device, waitlist, and job events with actor,
target, previous/new state, correlation ID, and `TIMESTAMPTZ` timestamp. Credential
hashes, plaintext device keys, pairing codes, and QR tokens are never audit
metadata. Booking state changes still write `BookingEvent` and `AuditLog` in the
same transaction. Admins can inspect a booking timeline from the booking table;
ordinary booking detail responses do not expose audit metadata.

Relevant settings are `BACKGROUND_JOB_SCHEDULE_INTERVAL_MS`,
`BACKGROUND_JOB_LOCK_TIMEOUT_MS`, `BACKGROUND_JOB_MAX_ATTEMPTS`, and
`BACKGROUND_JOB_RETENTION_DAYS`. Notification retention uses
`NOTIFICATION_JOB_RETENTION_DAYS` and `FAILED_NOTIFICATION_JOB_RETENTION_DAYS`.
Workers stop accepting timer wakeups and drain their in-flight run during graceful
`SIGTERM`/`SIGINT` shutdown.

## Migration Process

```bash
cd api
bun install --frozen-lockfile
bun run prisma generate
bun run migrate
```

The Phase 1 migration performs a preflight check and stops if existing active bookings overlap or contain invalid ranges. It never deletes or rewrites conflicting bookings automatically; resolve reported production data explicitly before retrying. The Phase 2 migration hashes existing QR and device credentials, scrubs legacy plaintext columns while retaining non-secret compatibility placeholders for one rolling deployment, and backfills one walk-in system principal per device. A later cleanup migration can drop the constrained legacy columns after all Phase 2 machines are deployed.

The Phase 3 migration creates preferences, LINE link codes, and notification jobs.
It scrubs obsolete LINE Notify tokens because they cannot be converted into LINE
Messaging user IDs. The constrained empty legacy column remains for one rolling
deployment and can be dropped after every API machine runs Phase 3. Existing users
must link the RoomFlow LINE bot again after deployment.

The Phase 4 migration creates constrained `background_jobs` and `audit_logs`
tables, adds `EXPIRED` waitlist state, and backfills existing `BookingEvent` rows
into the generic audit timeline. The API also merges any event written by an older
rolling-deployment instance that has not yet been mirrored into `AuditLog`.

The Phase 5 migration creates `stripe_webhook_events`. The Stripe event ID is the
primary key and is inserted in the same transaction as local plan changes, making
concurrent webhook retries idempotent for RoomFlow database side effects.

The Phase 6 migration creates `booking_series`, links occurrences through
`series_id` and a Bangkok `occurrence_date`, and adds the durable
`EXPIRE_PRO_ACCESS` job type. The migration contains reviewed PostgreSQL checks
for valid dates, times, weekdays, attendee counts, and one occurrence per date.

## High-Value Features (Phase 6)

### Weekly recurring bookings

`BookingSeriesService` supports conflict preview, atomic weekly creation, editing
one occurrence, editing this and future occurrences through a series split,
editing the whole future series, and cancelling one/future/all occurrences. Past
or terminal occurrences remain immutable. Conflict responses list every affected
date and deterministic alternatives.

Recurring creation and edits require an active individual Pro plan. Free users
can still list and cancel historical series. When Stripe sets
`cancel_at_period_end`, Pro access and recurring controls remain active until
`planExpiresAt`. The PostgreSQL-backed `EXPIRE_PRO_ACCESS` job downgrades the user
and cancels active series plus future `PENDING`/`CONFIRMED` occurrences only when
that timestamp is reached. An immediately inactive/deleted Stripe subscription
performs the same cancellation inside the idempotent webhook transaction.

Settings: `BOOKING_SERIES_MAX_OCCURRENCES` (default 26) and
`BOOKING_SERIES_MAX_SPAN_DAYS` (default 366).

### Real-time room status

Authenticated pages consume `GET /api/realtime/events`; paired kiosks consume
`GET /api/devices/:deviceId/events` with the normal `X-Device-Key` header. Both
are Server-Sent Event streams backed by the append-only PostgreSQL audit history,
so separate API instances observe the same booking, check-in, room closure, room
status, and device lifecycle changes without a broker. Device online/offline
events are derived from heartbeat freshness. Stream payloads intentionally omit
audit metadata, user details, credentials, and tokens.

Clients reconnect with exponential backoff. User/admin pages invalidate TanStack
Query caches on safe events and fall back to backoff polling when streaming is
degraded. Kiosks keep their existing 30-second schedule polling as a fallback.
`REALTIME_POLL_INTERVAL_MS` controls the database-backed stream interval and
defaults to two seconds.

### Smart alternatives

Single and recurring conflicts use `BookingAlternativeService`. Candidates are
validated by `BookingPolicyService` and ranked deterministically:

1. The same room at nearby times.
2. Another active room at the same time with sufficient capacity and all requested-room amenities.
3. The closest valid room-and-time combination.

The response explains each rank and never uses AI to choose room availability.

## Automated Quality and Operations (Phase 5)

Both packages use Biome for linting and formatting. Correctness violations block
CI, while selected legacy unused-import and accessibility findings remain visible
as warnings for incremental cleanup. The frontend uses Vitest, Testing Library,
and jsdom for critical component states.

CI validates an empty PostgreSQL 17.6 database, migration status, backend unit and
integration tests, HTTP RBAC, concurrent booking and Stripe webhook behavior,
frontend component tests, TypeScript, the Vite build, and the production API
Dockerfile. Provider delivery is disabled during automated tests.

`GET /api/health` is a public database-readiness endpoint. Admins can inspect
`GET /api/operations/jobs/health` for persisted background/notification queue
counts, delayed work, retained failures, and stale processing locks. Thresholds
are configured with `JOB_HEALTH_MAX_DUE_AGE_MS`,
`JOB_HEALTH_BACKGROUND_FAILED_THRESHOLD`,
`JOB_HEALTH_NOTIFICATION_FAILED_THRESHOLD`, and
`JOB_HEALTH_LOG_INTERVAL_MS`.

## Tests

```bash
cd api
bun run lint
bun run test:unit

# Requires an isolated database with all migrations applied
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/room_booking_test \
  bun run test:integration

# Run every backend test directory
bun test

cd ../web
pnpm run lint
pnpm test
pnpm exec tsc --noEmit
pnpm run build
```

Automated tests never require notification credentials or contact real providers.
Integration tests cover concurrent booking exclusion, QR room
binding/expiry/grace/replay, device credential rotation and revocation, pairing
single-use behavior, audited walk-ins, concurrent database rate limiting,
notification idempotency, multi-worker claiming, retries, duplicate reminder
prevention, LINE link-code consumption, multi-instance scheduled-job claiming,
background-job retry and retention, booking ownership/timeline RBAC, and scheduled
waitlist promotion with correlated audit. Phase 5 adds HTTP route-level ownership
tests, concurrent Stripe webhook idempotency tests, job-health unit tests, and
frontend booking-timeline and destructive-confirmation component tests.
Phase 6 adds Pro entitlement/expiry cancellation, recurring atomicity and edit
scope tests, deterministic alternative ranking, Stripe end-of-period behavior,
and safe database-backed SSE delivery.

## Known Limitations and Roadmap

- Job health is available through an admin API and structured warnings, but an
  external metrics/alert sink and dedicated operational dashboard remain future
  improvements.
- Device online/offline is derived from heartbeat freshness and is not written as
  a high-volume audit event on every heartbeat.
- The full Playwright booking-to-completion E2E remains optional; unit,
  PostgreSQL integration, component, lint, type-check, migration, build, and
  Docker gates are implemented.
- Phase 6 recurring bookings, SSE room status, and smart alternatives are implemented.
- Smart occupancy remains optional and feature-flagged for a later project.
