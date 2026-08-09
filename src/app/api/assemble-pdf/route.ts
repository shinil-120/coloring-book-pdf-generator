import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { listBooks, type BookMeta } from "@/lib/turso";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 8.5 × 11 inches @ 72 dpi
const BLANK_W = 612;
const BLANK_H = 792;

/**
 * POST /api/assemble-pdf
 * Body: {
 *   pdfData?: string,     // base64 PDF (optional, for backward compat)
 *   slug?: string,        // book slug — server fetches PDF from Blob/Turso
 *   pageOrder: number[]   // -1 = blank, >=0 = page index
 * }
 *
 * Returns: { success, pdf: data-uri, pages, blankPages, contentPages }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pdfDataB64: string | undefined = body?.pdfData;
    const slug: string | undefined = body?.slug;
    const pageOrder: number[] = body?.pageOrder;

    if (!Array.isArray(pageOrder) || pageOrder.length === 0) {
      return NextResponse.json(
        { success: false, error: "pageOrder must be a non-empty array" },
        { status: 400 }
      );
    }

    // ── Load the source PDF ────────────────────────────────────────────
    let srcBytes: Buffer;

    if (slug) {
      // Fetch PDF from Turso → Blob URL (avoids sending 5MB base64 over HTTP)
      let pdfUrl: string | null = null;
      try {
        const allBooks = await listBooks();
        const book = allBooks.find((b: BookMeta) => b.slug === slug);
        if (book) pdfUrl = book.url;
      } catch {
        // ignore
      }

      if (!pdfUrl) {
        // Fallback to local
        const localPath = path.join(process.cwd(), "public", "downloads", `${slug}-Coloring-Book.pdf`);
        if (fs.existsSync(localPath)) {
          srcBytes = fs.readFileSync(localPath);
        } else {
          return NextResponse.json(
            { success: false, error: `Book not found: ${slug}` },
            { status: 404 }
          );
        }
      } else if (pdfUrl.startsWith("http")) {
        // Fetch from Blob with cache-busting
        const res = await fetch(pdfUrl + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) {
          return NextResponse.json(
            { success: false, error: `Failed to fetch PDF: HTTP ${res.status}` },
            { status: 404 }
          );
        }
        srcBytes = Buffer.from(await res.arrayBuffer());
      } else {
        // Local URL
        const localPath = path.join(process.cwd(), "public", pdfUrl.replace(/^\//, ""));
        if (!fs.existsSync(localPath)) {
          return NextResponse.json(
            { success: false, error: `PDF not found: ${pdfUrl}` },
            { status: 404 }
          );
        }
        srcBytes = fs.readFileSync(localPath);
      }
    } else if (pdfDataB64) {
      // Backward compat: use client-sent base64
      srcBytes = Buffer.from(pdfDataB64, "base64");
    } else {
      return NextResponse.json(
        { success: false, error: "Either slug or pdfData is required" },
        { status: 400 }
      );
    }

    const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
    const srcPages = srcDoc.getPages();

    // Create output doc
    const outDoc = await PDFDocument.create();

    // Copy all needed pages in bulk
    const neededIndices = pageOrder.filter((n) => n >= 0);
    let copiedPages: Awaited<ReturnType<typeof outDoc.copyPages>> = [];
    if (neededIndices.length > 0) {
      copiedPages = await outDoc.copyPages(srcDoc, neededIndices);
    }
    const indexToCopied = new Map<number, (typeof copiedPages)[number]>();
    neededIndices.forEach((srcIdx, i) => {
      indexToCopied.set(srcIdx, copiedPages[i]);
    });

    let blankCount = 0;
    let contentCount = 0;

    for (const entry of pageOrder) {
      if (entry === -1) {
        outDoc.addPage([BLANK_W, BLANK_H]);
        blankCount++;
      } else if (entry >= 0 && entry < srcPages.length) {
        const copied = indexToCopied.get(entry);
        if (copied) {
          outDoc.addPage(copied);
          contentCount++;
        }
      }
    }

    const outBytes = await outDoc.save();
    const dataUri = `data:application/pdf;base64,${Buffer.from(outBytes).toString("base64")}`;

    return NextResponse.json({
      success: true,
      pdf: dataUri,
      pages: pageOrder.length,
      blankPages: blankCount,
      contentPages: contentCount,
    });
  } catch (err) {
    console.error("[/api/assemble-pdf] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
