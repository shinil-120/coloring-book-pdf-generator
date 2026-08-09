/**
 * Turso (libSQL) data access layer for coloring book metadata.
 *
 * Uses @libsql/client directly (no Prisma driver adapter needed). All book
 * metadata (name, slug, category, pages, items, PDF URL) is stored in
 * Turso. The actual PDF and thumbnail files are stored in Vercel Blob.
 *
 * This module exports a typed data-access API. If Turso is not configured
 * (no TURSO_DATABASE_URL), `getClient()` returns null and the app falls
 * back to reading the local JSON file.
 */
import { createClient, type Client } from "@libsql/client";

// Singleton client (avoid multiple instances in dev hot reload)
const globalForTurso = globalThis as unknown as { tursoClient?: Client | null };

function createTursoClient(): Client | null {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    return null; // Turso not configured — app falls back to local JSON
  }
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return createClient({ url, authToken });
}

export const turso: Client | null =
  globalForTurso.tursoClient ?? createTursoClient();

if (process.env.NODE_ENV !== "production" && turso) {
  globalForTurso.tursoClient = turso;
}

/** Check if Turso is configured. */
export function isTursoConfigured(): boolean {
  return !!process.env.TURSO_DATABASE_URL && !!turso;
}

// ────────────────────────────────────────────────────────────────────────
// Book metadata types
// ────────────────────────────────────────────────────────────────────────

export interface BookMeta {
  id?: string;
  name: string;
  url: string;          // PDF URL (Blob or local /downloads/...)
  slug: string;
  size: string;         // human-readable, e.g. "4.2 MB"
  sizeBytes: number;
  pages: number;
  category: string;
  timestamp: string;    // ISO
  readableTime: string; // human-readable UTC
  description: string;
  items?: string[];
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatReadableIST(d: Date): string {
  // Indian Standard Time = UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffset);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = istDate.getUTCHours();
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ap = hh < 12 ? "AM" : "PM";
  return `${months[istDate.getUTCMonth()]} ${istDate.getUTCDate()}, ${istDate.getUTCFullYear()}, ${pad(h12)}:${pad(istDate.getUTCMinutes())} ${ap} IST`;
}

interface DbRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  pages: number;
  sizeBytes: number;
  pdfUrl: string;
  thumbnailUrl: string | null;
  items: string;
  createdAt: string;
}

function toBookMeta(row: DbRow): BookMeta {
  let items: string[] = [];
  try {
    items = JSON.parse(row.items);
  } catch {
    items = [];
  }
  return {
    id: row.id,
    name: row.name,
    url: row.pdfUrl,
    slug: row.slug,
    size: formatBytes(row.sizeBytes),
    sizeBytes: row.sizeBytes,
    pages: row.pages,
    category: row.category,
    timestamp: new Date(row.createdAt).toISOString(),
    readableTime: formatReadableIST(new Date(row.createdAt)),
    description: row.description,
    items,
  };
}

// ────────────────────────────────────────────────────────────────────────
// CRUD operations
// ────────────────────────────────────────────────────────────────────────

/** List all coloring books, newest first. */
export async function listBooks(): Promise<BookMeta[]> {
  if (!turso) return [];
  const result = await turso.execute({
    sql: "SELECT * FROM ColoringBook ORDER BY createdAt DESC LIMIT 10",
    args: [],
  });
  return result.rows.map((row) => toBookMeta(row as unknown as DbRow));
}

/** Get a single book by slug. */
export async function getBook(slug: string): Promise<BookMeta | null> {
  if (!turso) return null;
  const result = await turso.execute({
    sql: "SELECT * FROM ColoringBook WHERE slug = ?",
    args: [slug],
  });
  if (result.rows.length === 0) return null;
  return toBookMeta(result.rows[0] as unknown as DbRow);
}

/** Create or update a book record (upsert by slug). */
export async function upsertBook(meta: {
  slug: string;
  name: string;
  category: string;
  description: string;
  pages: number;
  sizeBytes: number;
  pdfUrl: string;
  items: string[];
}): Promise<BookMeta> {
  if (!turso) throw new Error("Turso not configured");

  // Delete existing (if any) then create
  await turso.execute({
    sql: "DELETE FROM ColoringBook WHERE slug = ?",
    args: [meta.slug],
  });

  const id = crypto.randomUUID();
  await turso.execute({
    sql: `INSERT INTO ColoringBook (id, slug, name, category, description, pages, sizeBytes, pdfUrl, items, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      meta.slug,
      meta.name,
      meta.category,
      meta.description,
      meta.pages,
      meta.sizeBytes,
      meta.pdfUrl,
      JSON.stringify(meta.items),
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  });

  return (await getBook(meta.slug))!;
}

/** Delete a book by slug. */
export async function deleteBook(slug: string): Promise<void> {
  if (!turso) return;
  await turso.execute({
    sql: "DELETE FROM ColoringBook WHERE slug = ?",
    args: [slug],
  });
}

// ────────────────────────────────────────────────────────────────────────
// Prisma re-export for backward compatibility (db.ts imports this)
// ────────────────────────────────────────────────────────────────────────
export { turso as prisma };
