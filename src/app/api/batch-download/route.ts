import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { listBooks, type BookMeta } from "@/lib/turso";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/batch-download
 * Body: { slugs: string[] }
 *
 * Returns a ZIP archive containing all the requested coloring book PDFs.
 * Fetches PDFs from Vercel Blob (production) or local filesystem (dev).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slugs: string[] = Array.isArray(body?.slugs) ? body.slugs : [];

    if (slugs.length === 0) {
      return NextResponse.json(
        { success: false, error: "slugs array is required" },
        { status: 400 }
      );
    }

    // Load metadata from Turso (or local JSON fallback)
    let books: BookMeta[] = [];
    try {
      books = await listBooks();
    } catch {
      // try local JSON
      const jsonPath = path.join(process.cwd(), "public", "downloads", "coloring-books.json");
      if (fs.existsSync(jsonPath)) {
        const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        books = Array.isArray(raw) ? raw : raw.books ?? [];
      }
    }

    const zip = new JSZip();
    const added: string[] = [];
    const skipped: string[] = [];

    for (const slug of slugs) {
      const book = books.find((b) => b.slug === slug);
      const url = book?.url ?? `/downloads/${slug}-Coloring-Book.pdf`;

      let buffer: Buffer | null = null;

      if (url.startsWith("http://") || url.startsWith("https://")) {
        // Fetch from Vercel Blob
        const res = await fetch(url);
        if (!res.ok) {
          skipped.push(slug);
          continue;
        }
        buffer = Buffer.from(await res.arrayBuffer());
      } else {
        // Local filesystem
        const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
        if (!fs.existsSync(filePath)) {
          skipped.push(slug);
          continue;
        }
        buffer = fs.readFileSync(filePath);
      }

      if (buffer) {
        const fileName = `${slug}-Coloring-Book.pdf`;
        zip.file(fileName, buffer);
        added.push(fileName);
      }
    }

    if (added.length === 0) {
      return NextResponse.json(
        { success: false, error: "No PDFs found", skipped },
        { status: 404 }
      );
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="coloring-books-${timestamp}.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err) {
    console.error("[/api/batch-download] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
