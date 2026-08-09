/**
 * Prisma client — re-exports from turso.ts for backward compatibility.
 *
 * In production: uses Turso (libSQL) via @prisma/adapter-libsql.
 * In local dev without Turso configured: returns null (falls back to
 * local JSON file storage).
 *
 * Use `import { prisma } from '@/lib/turso'` for the typed client.
 * Use `import { db } from '@/lib/db'` for backward compatibility.
 */
export { prisma as db } from "@/lib/turso";
