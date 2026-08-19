# Elysia with Bun runtime

## Getting Started
To get started with this template, simply paste this command into your terminal:
```bash
bun create elysia ./elysia-example
```

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

## Database migrations

Run committed Prisma migrations with:

```bash
bun run migrate
```

The command uses `prisma migrate deploy` and retries transient database or DNS
failures with bounded exponential backoff. Fly.io runs it once through the
`release_command` before replacing application machines. The application
container itself does not run migrations during startup.

Migration files must be generated and reviewed during development, then
committed under `prisma/migrations/`. Do not use `prisma db push` in production.
