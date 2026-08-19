import type { Prisma, PrismaClient } from "../../generated/prisma/client";

const RETRYABLE_DATABASE_CODES = new Set(["P2034", "40001", "40P01"]);

function findDatabaseCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const candidate = current as Record<string, unknown>;
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

export function isRetryableTransactionError(error: unknown): boolean {
  return RETRYABLE_DATABASE_CODES.has(findDatabaseCode(error) ?? "");
}

export function isExclusionConstraintError(error: unknown): boolean {
  if (findDatabaseCode(error) === "23P01") return true;
  if (!error || typeof error !== "object") return false;
  let serialized = String(error);
  try {
    serialized += JSON.stringify(error);
  } catch {
    // Some driver errors contain circular references; the string form still
    // carries PostgreSQL's constraint name and SQLSTATE.
  }
  return serialized.includes("23P01") || serialized.includes("no_active_overlap");
}

export async function withSerializableRetry<T>(
  prisma: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
    }
  }

  throw lastError;
}
