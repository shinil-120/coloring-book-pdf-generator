import { NextResponse } from "next/server";
import { listBooks, isTursoConfigured } from "@/lib/turso";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/books
 *
 * Returns all coloring book metadata.
 * - If Turso is configured: reads from Turso database
 * - Fallback: reads from public/downloads/coloring-books.json (local file)
 *
 * Returns: { success, books: BookMeta[], source: "turso" | "local" }
 */
export async function GET() {
  try {
    // Try Turso first
    if (isTursoConfigured()) {
      const books = await listBooks();
      return NextResponse.json({
        success: true,
        books,
        source: "turso",
      });
    }

    // Fallback: read local JSON
    const jsonPath = path.join(
      process.cwd(),
      "public",
      "downloads",
      "coloring-books.json"
    );
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const books = JSON.parse(raw);
      return NextResponse.json({
        success: true,
        books: Array.isArray(books) ? books : books.books ?? [],
        source: "local",
      });
    }

    // No books found
    return NextResponse.json({
      success: true,
      books: [],
      source: "none",
    });
  } catch (err) {
    console.error("[/api/books] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        books: [],
      },
      { status: 500 }
    );
  }
}
