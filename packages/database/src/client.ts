import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Singleton PrismaClient
//
// In development, Next.js and other tools with hot-reload can cause the module
// to be evaluated multiple times, exhausting the database connection pool.
// We attach the instance to `globalThis` so it survives across re-evaluations.
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prismaClient;
}

/** Primary export — use `db` throughout the codebase. */
export const db = prismaClient;

/** Alias for `db` — useful when the name `prisma` is more expressive. */
export const prisma = prismaClient;
