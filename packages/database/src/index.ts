// Re-export the Prisma-generated client types and utilities so consumers of
// @openbadge/database never need to import from @prisma/client directly.
export * from "@prisma/client";

// Re-export the singleton client instances.
export { db, prisma } from "./client.js";
