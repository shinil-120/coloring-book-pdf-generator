import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { listBooks, type BookMeta } from "@/lib/turso";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/final-assembly
 * Body: { interiorSlug, coverData?, title, author, subject, keywords }
 *
 * Combines cover PDF + interior PDF into one final KDP-ready file with metadata.
 * Fetches interior from Vercel Blob (production) or local filesystem (dev).
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

    // Find the interior PDF URL from Turso (or local JSON)
    let interiorUrl: string | null = null;
    try {
      const allBooks = await listBooks();
      const book = allBooks.find((b: BookMeta) => b.slug === interiorSlug);
      if (book) {
        interiorUrl = book.url;
      }
    } catch {
      // ignore
    }

    // Fallback to local path
    if (!interiorUrl) {
      interiorUrl = `/downloads/${interiorSlug}-Coloring-Book.pdf`;
    }

    // Load interior PDF buffer
    let interiorBuffer: Buffer;
    if (interiorUrl.startsWith("http://") || interiorUrl.startsWith("https://")) {
      const res = await fetch(interiorUrl);
      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `Failed to fetch interior PDF: HTTP ${res.status}` },
          { status: 404 }
        );
      }
      interiorBuffer = Buffer.from(await res.arrayBuffer());
    } else {
      const interiorPath = path.join(process.cwd(), "public", interiorUrl.replace(/^\//, ""));
      if (!fs.existsSync(interiorPath)) {
        return NextResponse.json(
          { success: false, error: `Interior PDF not found: ${interiorSlug}` },
          { status: 404 }
        );
      }
      interiorBuffer = fs.readFileSync(interiorPath);
    }

    const finalDoc = await PDFDocument.create();

    // Add cover (if provided)
    let coverPageCount = 0;
    if (coverData) {
      try {
        const b64 = coverData.replace(/^data:application\/pdf;base64,/, "");
        const coverBytes = Buffer.from(b64, "base64");
        const coverDoc = await PDFDocument.load(coverBytes, { ignoreEncryption: true });
        const coverPages = await finalDoc.copyPages(coverDoc, coverDoc.getPageIndices());
        coverPages.forEach((p) => finalDoc.addPage(p));
        coverPageCount = coverPages.length;
      } catch (e) {
        console.error("[/api/final-assembly] cover load error:", e);
      }
    }

    // Add interior pages
    const interiorDoc = await PDFDocument.load(interiorBuffer, { ignoreEncryption: true });
    const interiorPages = await finalDoc.copyPages(interiorDoc, interiorDoc.getPageIndices());
    interiorPages.forEach((p) => finalDoc.addPage(p));

    // Inject metadata
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
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
