import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/final-assembly
 * Body: {
 *   interiorSlug: string,   // e.g. "Pets" → loads public/downloads/Pets-Coloring-Book.pdf
 *   coverData?: string,     // base64 or data-uri of a generated cover PDF (optional)
 *   coverSlug?: string,     // OR: slug of an existing book to use as cover source (optional)
 *   title: string,
 *   author: string,
 *   subject: string,
 *   keywords: string,
 * }
 *
 * Combines the cover PDF (first page) + interior PDF (all pages) into one
 * final KDP-ready file, with document metadata (Title, Author, Subject,
 * Keywords) injected.
 *
 * If no cover is provided, the final file is just the interior with metadata.
 *
 * Returns: { success, pdf: data-uri, pages, fileName }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const interiorSlug: string = body?.interiorSlug ?? "";
    const coverData: string | undefined = body?.coverData;
    const title: string = (body?.title ?? "Coloring Book").trim();
    const author: string = (body?.author ?? "Unknown").trim();
    const subject: string = (body?.subject ?? "Amazon KDP Coloring Book").trim();
    const keywords: string = (body?.keywords ?? "coloring book, KDP, kids").trim();

    if (!interiorSlug) {
      return NextResponse.json(
        { success: false, error: "interiorSlug is required" },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const downloadsDir = path.join(projectRoot, "public", "downloads");
    const interiorPath = path.join(downloadsDir, `${interiorSlug}-Coloring-Book.pdf`);

    if (!fs.existsSync(interiorPath)) {
      return NextResponse.json(
        { success: false, error: `Interior PDF not found: ${interiorSlug}` },
        { status: 404 }
      );
    }

    // Create the final document
    const finalDoc = await PDFDocument.create();

    // ── Add cover (if provided) ──────────────────────────────────────
    let coverPageCount = 0;
    if (coverData) {
      try {
        // Strip data-uri prefix if present
        const b64 = coverData.replace(/^data:application\/pdf;base64,/, "");
        const coverBytes = Buffer.from(b64, "base64");
        const coverDoc = await PDFDocument.load(coverBytes, { ignoreEncryption: true });
        const coverPages = await finalDoc.copyPages(coverDoc, coverDoc.getPageIndices());
        coverPages.forEach((p) => finalDoc.addPage(p));
        coverPageCount = coverPages.length;
      } catch (e) {
        console.error("[/api/final-assembly] cover load error:", e);
        // continue without cover
      }
    }

    // ── Add interior pages ───────────────────────────────────────────
    const interiorBytes = fs.readFileSync(interiorPath);
    const interiorDoc = await PDFDocument.load(interiorBytes, { ignoreEncryption: true });
    const interiorPages = await finalDoc.copyPages(interiorDoc, interiorDoc.getPageIndices());
    interiorPages.forEach((p) => finalDoc.addPage(p));

    // ── Inject metadata ──────────────────────────────────────────────
    finalDoc.setTitle(title);
    finalDoc.setAuthor(author);
    finalDoc.setSubject(subject);
    finalDoc.setKeywords(keywords.split(",").map((k) => k.trim()).filter(Boolean));
    finalDoc.setProducer("Coloring Book Studio");
    finalDoc.setCreator("Coloring Book PDF Generator");
    const now = new Date();
    finalDoc.setCreationDate(now);
    finalDoc.setModificationDate(now);

    const outBytes = await finalDoc.save();
    const dataUri = `data:application/pdf;base64,${Buffer.from(outBytes).toString("base64")}`;

    const safeTitle = title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    const fileName = `${safeTitle || "coloring-book"}-final.pdf`;

    return NextResponse.json({
      success: true,
      pdf: dataUri,
      pages: coverPageCount + interiorPages.length,
      coverPages: coverPageCount,
      interiorPages: interiorPages.length,
      fileName,
    });
  } catch (err) {
    console.error("[/api/final-assembly] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
