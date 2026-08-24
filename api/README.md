# RoomFlow API

The RoomFlow API is a Bun and Elysia modular monolith backed by Prisma and
PostgreSQL. Domain services enforce booking and check-in rules; PostgreSQL
constraints and durable job tables provide concurrency and multi-instance safety.

See the [project README](../README.md) for product scope, architecture, complete
environment reference, booking rules, security model, and CI/CD behavior.

## Development

```bash
cp .env.example .env
docker compose up -d postgres
bun install --frozen-lockfile
bun run prisma generate
bun run migrate
bun run dev
```

The API listens on `http://localhost:3000` with routes under `/api`.

Do not use a PostgreSQL transaction pooler for the API connection. Booking
creation uses interactive transactions with serializable isolation; use a direct
connection or session pooler on port `5432`.

## Commands

```bash
bun run dev               # Development server with watch mode
bun run start             # Production-style server process
bun run lint              # Biome lint
bun run format            # Biome formatting
bun run typecheck         # TypeScript without output
bun run test:unit         # Database-independent unit tests
bun run test:routes       # Compile the complete Elysia route graph
bun run test:integration  # PostgreSQL integration tests
bun run migrate           # Committed Prisma migrations with bounded retry
```

Integration tests require `TEST_DATABASE_URL` pointing to a migrated disposable
database. Never use production or shared development data. Set
`NOTIFICATIONS_DISABLED=true` so tests cannot contact notification providers.

## Production lifecycle

The Docker image starts `bun src/index.ts`. Fly.io runs `bun run migrate` as a
release command before replacing application machines, then checks
`GET /api/health`. Application startup does not apply schema changes itself.

The migration wrapper runs `prisma migrate deploy` and retries transient DNS or
database availability failures with bounded exponential backoff. Migrations must
be generated and reviewed during development and committed under
`prisma/migrations/`. Never use `prisma db push` in production.

## Operational endpoints

- `GET /api/health`: public database readiness and application version.
- `GET /api/operations/jobs/health`: admin-only durable job health.
- OpenAPI documentation is composed from the Elysia application routes.

Secrets, device credentials, pairing codes, QR plaintext, and provider tokens
must never be logged or returned by normal list endpoints.
