/**
 * Turso (libSQL) data access layer for coloring book metadata.
 *
 * Uses Prisma Client with the libSQL adapter. All book metadata (name,
 * slug, category, pages, items, PDF URL) is stored in Turso. The actual
 * PDF and thumbnail files are stored in Vercel Blob (see blob-storage.ts).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

// Singleton Prisma client (avoid multiple instances in dev hot reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient | null {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    // No Turso configured — return null (app falls back to local JSON)
    return null;
  }
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const directUrl = process.env.TURSO_DIRECT_URL || url;

  const libsql = createClient({ url: directUrl, authToken });
  const adapter = new PrismaLibSql(libsql);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}

// ────────────────────────────────────────────────────────────────────────
// Book metadata types (mirror the JSON format for backward compatibility)
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
// CRUD operations
// ────────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatReadableUTC(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = d.getUTCHours();
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ap = hh < 12 ? "AM" : "PM";
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${pad(h12)}:${pad(d.getUTCMinutes())} ${ap} UTC`;
}

/** Convert a Prisma ColoringBook record to the BookMeta format. */
function toBookMeta(b: {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  pages: number;
  sizeBytes: number;
  pdfUrl: string;
  items: string;
  createdAt: Date;
}): BookMeta {
  let items: string[] = [];
  try {
    items = JSON.parse(b.items);
  } catch {
    items = [];
  }
  return {
    id: b.id,
    name: b.name,
    url: b.pdfUrl,
    slug: b.slug,
    size: formatBytes(b.sizeBytes),
    sizeBytes: b.sizeBytes,
    pages: b.pages,
    category: b.category,
    timestamp: b.createdAt.toISOString(),
    readableTime: formatReadableUTC(b.createdAt),
    description: b.description,
    items,
  };
}

/** List all coloring books, newest first. */
export async function listBooks(): Promise<BookMeta[]> {
  if (!prisma) return [];
  const books = await prisma.coloringBook.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return books.map(toBookMeta);
}

/** Get a single book by slug. */
export async function getBook(slug: string): Promise<BookMeta | null> {
  if (!prisma) return null;
  const book = await prisma.coloringBook.findUnique({ where: { slug } });
  return book ? toBookMeta(book) : null;
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
  if (!prisma) throw new Error("Turso not configured");

  // Delete existing (if any) then create — simpler than upsert with all fields
  await prisma.coloringBook.deleteMany({ where: { slug: meta.slug } });
  const book = await prisma.coloringBook.create({
    data: {
      slug: meta.slug,
      name: meta.name,
      category: meta.category,
      description: meta.description,
      pages: meta.pages,
      sizeBytes: meta.sizeBytes,
      pdfUrl: meta.pdfUrl,
      items: JSON.stringify(meta.items),
    },
  });
  return toBookMeta(book);
}

/** Delete a book by slug. */
export async function deleteBook(slug: string): Promise<void> {
  if (!prisma) return;
  await prisma.coloringBook.deleteMany({ where: { slug } });
}

/** Check if Turso is configured. */
export function isTursoConfigured(): boolean {
  return !!process.env.TURSO_DATABASE_URL;
}
