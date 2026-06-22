import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const migrations = [
  `ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "allowedRoles" TEXT[] NOT NULL DEFAULT '{}'`,
];

for (const sql of migrations) {
  console.log("Running:", sql.slice(0, 60));
  await client.query(sql);
}

console.log("Migrations done.");
await client.end();
process.exit(0);
