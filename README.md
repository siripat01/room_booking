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
