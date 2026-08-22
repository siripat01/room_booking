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
  - **Backend**: ตรวจสอบ Typescript ด้วย `tsc` และสร้าง Prisma Client
  - **Frontend**: ตรวจสอบการ build ของโปรเจกต์ด้วย `pnpm run build`

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

หากจำเป็นต้องใช้งาน GitHub Actions คุณสามารถใส่ไฟล์ `.github/workflows/main.yml` เพื่อให้เช็คโค้ดก่อน Merge:
- รัน Prisma Generate ใน CI ด้วยการใช้ URL จำลอง (Dummy URL) เพื่อไม่ให้ติดปัญหาการเชื่อมต่อ Database จริง
- ใช้คำสั่งตรวจประเภทข้อมูลใน API: `tsc --noEmit --ignoreDeprecations 6.0`
- ใช้คำสั่ง build ใน Web: `pnpm run build`

## Product Scope

RoomFlow is primarily an internal physical-resource management system for a school or organization. The existing individual Free/Pro subscription remains available for compatibility, but billing is not part of the booking correctness boundary.

There is currently a positioning mismatch between the internal organization workflow and individual SaaS billing. A future SaaS version should introduce organizations, tenant isolation, organization membership, and organization-level billing as a separate project.

## Booking Correctness (Phase 1)

Every implemented booking creation path uses `BookingPolicyService`:

- Authenticated user and admin bookings
- Kiosk walk-in bookings
- Waitlist promotion

Recurring bookings are not implemented yet. When added, each occurrence must call the same policy service.

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

## Tests

```bash
cd api
bun test

# Requires an isolated database with all migrations applied
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/room_booking_test \
  bun run test:integration
```

Automated tests never require notification credentials or contact real providers.
Integration tests cover concurrent booking exclusion, QR room
binding/expiry/grace/replay, device credential rotation and revocation, pairing
single-use behavior, audited walk-ins, concurrent database rate limiting,
notification idempotency, multi-worker claiming, retries, duplicate reminder
prevention, and LINE link-code consumption.

## Known Limitations and Roadmap

- Notification outbox cleanup/retention and operational dashboards can be added
  with the Phase 4 job infrastructure.
- Multi-instance-safe scheduling for non-notification jobs and the admin audit
  timeline are Phase 4.
- Full API/frontend/E2E quality gates are Phase 5.
- Recurring bookings, SSE room status, and smart alternatives are Phase 6.
- Smart occupancy remains optional and feature-flagged for a later project.
