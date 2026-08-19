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

## Migration Process

```bash
cd api
bun install --frozen-lockfile
bun run prisma generate
bun run prisma migrate deploy
```

The Phase 1 migration performs a preflight check and stops if existing active bookings overlap or contain invalid ranges. It never deletes or rewrites conflicting bookings automatically; resolve reported production data explicitly before retrying.

## Tests

```bash
cd api
bun test

# Requires an isolated database with all migrations applied
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/room_booking_test \
  bun run test:integration
```

Automated tests never require notification credentials. The concurrency integration test sends two simultaneous requests and verifies that exactly one active booking is committed.

## Known Limitations and Roadmap

- QR/device hardening and the unified `-10/+12 minute` check-in window are Phase 2.
- LINE Notify replacement and durable notification jobs are Phase 3.
- Multi-instance-safe scheduling and the admin audit timeline are Phase 4.
- Full API/frontend/E2E quality gates are Phase 5.
- Recurring bookings, SSE room status, and smart alternatives are Phase 6.
- Smart occupancy remains optional and feature-flagged for a later project.
