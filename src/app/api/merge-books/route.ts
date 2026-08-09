import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { listBooks, type BookMeta } from "@/lib/turso";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MergeSpec {
  slug: string;
  pages: number;
}

/**
 * POST /api/merge-books
 * Body: { books: [{ slug, pages }], addBlanks?: boolean }
 *
 * Assembles a compilation PDF from multiple source PDFs.
 * Fetches source PDFs from Vercel Blob (production) or local filesystem (dev).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const specs: MergeSpec[] = Array.isArray(body?.books) ? body.books : [];
    const addBlanks: boolean = !!body?.addBlanks;

    if (specs.length === 0) {
      return NextResponse.json(
        { success: false, error: "books array is required" },
        { status: 400 }
      );
    }

    // Load metadata from Turso (or local JSON)
    let books: BookMeta[] = [];
    try {
      books = await listBooks();
    } catch {
      const jsonPath = path.join(process.cwd(), "public", "downloads", "coloring-books.json");
      if (fs.existsSync(jsonPath)) {
        const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        books = Array.isArray(raw) ? raw : raw.books ?? [];
      }
    }

    const outDoc = await PDFDocument.create();

    interface LoadedBook {
      slug: string;
      doc: PDFDocument;
      pageCount: number;
    }
    const loaded: LoadedBook[] = [];

    // Load all source PDFs
    for (const spec of specs) {
      const book = books.find((b) => b.slug === spec.slug);
      const url = book?.url ?? `/downloads/${spec.slug}-Coloring-Book.pdf`;

      let fileBuffer: Buffer;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        // Fetch from Vercel Blob
        const res = await fetch(url);
        if (!res.ok) {
          return NextResponse.json(
            { success: false, error: `Failed to fetch PDF for "${spec.slug}": HTTP ${res.status}` },
            { status: 404 }
          );
        }
        fileBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        // Local filesystem
        const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
        if (!fs.existsSync(filePath)) {
          return NextResponse.json(
            { success: false, error: `PDF not found for slug "${spec.slug}"` },
            { status: 404 }
          );
        }
        fileBuffer = fs.readFileSync(filePath);
      }

      const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      loaded.push({ slug: spec.slug, doc: srcDoc, pageCount: srcDoc.getPageCount() });
    }

    // Determine which source pages to copy
    const pageRefs: { slug: string; srcIndex: number }[] = [];
    for (const spec of specs) {
      const book = loaded.find((b) => b.slug === spec.slug);
      if (!book) continue;
      const take = Math.min(spec.pages, book.pageCount);
      for (let i = 0; i < take; i++) {
        pageRefs.push({ slug: spec.slug, srcIndex: i });
      }
    }

    if (pageRefs.length === 0) {
      return NextResponse.json(
        { success: false, error: "No pages to merge" },
        { status: 400 }
      );
    }

    // Copy pages
    const BLANK_W = 612;
    const BLANK_H = 792;
    let contentCount = 0;
    let blankCount = 0;

    for (const ref of pageRefs) {
      if (addBlanks) {
        outDoc.addPage([BLANK_W, BLANK_H]);
        blankCount++;
      }
      const book = loaded.find((b) => b.slug === ref.slug)!;
      const [copied] = await outDoc.copyPages(book.doc, [ref.srcIndex]);
      outDoc.addPage(copied);
      contentCount++;
    }

    const outBytes = await outDoc.save();
    const dataUri = `data:application/pdf;base64,${Buffer.from(outBytes).toString("base64")}`;

    const slugsPart = specs.map((s) => s.slug).join("-").slice(0, 60);
    const fileName = `compilation-${slugsPart}.pdf`;

    return NextResponse.json({
      success: true,
      pdf: dataUri,
      pages: contentCount + blankCount,
      contentPages: contentCount,
      blankPages: blankCount,
      fileName,
    });
  } catch (err) {
    console.error("[/api/merge-books] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
