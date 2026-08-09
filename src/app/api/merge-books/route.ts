import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MergeSpec {
  slug: string;
  pages: number; // number of pages to take from this book (from the start)
}

/**
 * POST /api/merge-books
 * Body: { books: [{ slug, pages }, ...], addBlanks?: boolean }
 *
 * Assembles a compilation PDF by taking the first N pages from each
 * specified book, in order. Optionally inserts blank pages between
 * content pages (KDP bleed-through prevention).
 *
 * Returns: { success, pdf: data-uri, pages, contentPages, blankPages, fileName }
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

    const projectRoot = process.cwd();
    const downloadsDir = path.join(projectRoot, "public", "downloads");

    const outDoc = await PDFDocument.create();

    interface LoadedBook {
      slug: string;
      doc: PDFDocument;
      pageCount: number;
      taken: number;
    }
    const loaded: LoadedBook[] = [];

    // Load all source PDFs
    for (const spec of specs) {
      const filePath = path.join(
        downloadsDir,
        `${spec.slug}-Coloring-Book.pdf`
      );
      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { success: false, error: `PDF not found for slug "${spec.slug}"` },
          { status: 404 }
        );
      }
      const fileBuffer = fs.readFileSync(filePath);
      const srcDoc = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
      });
      loaded.push({
        slug: spec.slug,
        doc: srcDoc,
        pageCount: srcDoc.getPageCount(),
        taken: 0,
      });
    }

    // Determine which source pages to copy
    interface PageRef {
      slug: string;
      srcIndex: number; // 0-based index in source PDF
    }
    const pageRefs: PageRef[] = [];

    for (const spec of specs) {
      const book = loaded.find((b) => b.slug === spec.slug);
      if (!book) continue;
      const take = Math.min(spec.pages, book.pageCount);
      for (let i = 0; i < take; i++) {
        pageRefs.push({ slug: spec.slug, srcIndex: i });
      }
      book.taken = take;
    }

    if (pageRefs.length === 0) {
      return NextResponse.json(
        { success: false, error: "No pages to merge" },
        { status: 400 }
      );
    }

    // Copy pages in bulk per source book (pdf-lib requires grouped indices)
    const BLANK_W = 612;
    const BLANK_H = 792;
    let contentCount = 0;
    let blankCount = 0;

    for (const ref of pageRefs) {
      if (addBlanks) {
        // Insert a blank page before each content page
        outDoc.addPage([BLANK_W, BLANK_H]);
        blankCount++;
      }
      // Copy the source page
      const book = loaded.find((b) => b.slug === ref.slug)!;
      const [copied] = await outDoc.copyPages(book.doc, [ref.srcIndex]);
      outDoc.addPage(copied);
      contentCount++;
    }

    const outBytes = await outDoc.save();
    const dataUri = `data:application/pdf;base64,${Buffer.from(outBytes).toString(
      "base64"
    )}`;

    // Build a descriptive filename from the source slugs
    const slugsPart = specs
      .map((s) => s.slug)
      .join("-")
      .slice(0, 60);
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
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
