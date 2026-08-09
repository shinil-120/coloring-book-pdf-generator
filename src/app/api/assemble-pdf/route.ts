import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Set body size limit for large base64 PDFs
export const fetchCache = "force-no-store";

// 8.5 × 11 inches @ 72 dpi
const BLANK_W = 612;
const BLANK_H = 792;

/**
 * POST /api/assemble-pdf
 * Body: { pdfData: base64, pageOrder: number[] }
 *   pageOrder entries: -1 = blank page, >=0 = page index from source PDF
 *
 * Returns:
 *   { success, pdf: data-uri, pages, blankPages, contentPages }
 *
 * Uses pdf-lib to copy pages from the source PDF in the specified order,
 * inserting blank 612×792 pages wherever pageOrder[i] === -1.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pdfDataB64: string = body?.pdfData;
    const pageOrder: number[] = body?.pageOrder;

    if (!pdfDataB64 || typeof pdfDataB64 !== "string") {
      return NextResponse.json(
        { success: false, error: "pdfData (base64) is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(pageOrder) || pageOrder.length === 0) {
      return NextResponse.json(
        { success: false, error: "pageOrder must be a non-empty array" },
        { status: 400 }
      );
    }

    // Decode source PDF
    const srcBytes = Buffer.from(pdfDataB64, "base64");
    const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
    const srcPages = srcDoc.getPages();

    // Create output doc
    const outDoc = await PDFDocument.create();
    const helvetica = await outDoc.embedFont(StandardFonts.Helvetica);

    // Cache copied page indices (pdf-lib copyPages returns array)
    // We'll copy in bulk to be efficient: collect all needed indices.
    const neededIndices = pageOrder.filter((n) => n >= 0);
    let copiedPages: Awaited<ReturnType<typeof outDoc.copyPages>> = [];
    if (neededIndices.length > 0) {
      // copyPages takes 0-based indices into the source document
      copiedPages = await outDoc.copyPages(srcDoc, neededIndices);
    }
    // Map sourceIndex → copied page
    const indexToCopied = new Map<number, (typeof copiedPages)[number]>();
    neededIndices.forEach((srcIdx, i) => {
      indexToCopied.set(srcIdx, copiedPages[i]);
    });

    let blankCount = 0;
    let contentCount = 0;

    for (const entry of pageOrder) {
      if (entry === -1) {
        // Blank page: 612 × 792, plain white
        const blank = outDoc.addPage([BLANK_W, BLANK_H]);
        // Draw a subtle "blank page" marker? Spec says plain blank, so leave
        // it empty (no ink) — that's the whole point for bleed-through.
        void blank;
        void helvetica;
        blankCount++;
      } else if (entry >= 0 && entry < srcPages.length) {
        const copied = indexToCopied.get(entry);
        if (copied) {
          outDoc.addPage(copied);
          contentCount++;
        }
      } else {
        // invalid index — skip
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
