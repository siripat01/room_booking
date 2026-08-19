const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1_000;
const TRANSIENT_DATABASE_ERROR =
  /P1001|P1002|P1017|EAI_AGAIN|ESERVFAIL|ECONNREFUSED|ECONNRESET|ETIMEDOUT|connection (?:closed|reset)|server closed/i;

async function runMigration(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    console.log(`Running Prisma migrations (attempt ${attempt}/${MAX_ATTEMPTS})...`);

    const childProcess = Bun.spawn(
      ["bun", "node_modules/.bin/prisma", "migrate", "deploy"],
      {
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const [exitCode, stdout, stderr] = await Promise.all([
      childProcess.exited,
      new Response(childProcess.stdout).text(),
      new Response(childProcess.stderr).text(),
    ]);

    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());

    if (exitCode === 0) {
      console.log("Database migrations completed successfully.");
      return;
    }

    const output = `${stdout}\n${stderr}`;
    const shouldRetry =
      attempt < MAX_ATTEMPTS && TRANSIENT_DATABASE_ERROR.test(output);

    if (!shouldRetry) {
      throw new Error(`Prisma migrate deploy failed with exit code ${exitCode}.`);
    }

    const delayMs = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
    console.warn(`Transient database error detected; retrying in ${delayMs}ms.`);
    await Bun.sleep(delayMs);
  }
}

await runMigration();

export {};
