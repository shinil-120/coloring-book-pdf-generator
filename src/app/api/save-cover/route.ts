import { NextRequest, NextResponse } from "next/server";
import { upsertBook, isTursoConfigured } from "@/lib/turso";
import { uploadCover, isBlobConfigured } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/save-cover
 * Body: { pdfData: string (data-uri), title, author, pageCount, fileName }
 *
 * Uploads the cover PDF to Vercel Blob and creates a Turso record
 * so it appears in the generated books list (for merging with interiors).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pdfData: string = body?.pdfData;
    const title: string = (body?.title ?? "Cover").trim();
    const author: string = (body?.author ?? "").trim();
    const pageCount: number = body?.pageCount ?? 100;
    const fileName: string = body?.fileName ?? "cover.pdf";

    if (!pdfData) {
      return NextResponse.json(
        { success: false, error: "pdfData is required" },
        { status: 400 }
      );
    }

    // Strip data-uri prefix
    const b64 = pdfData.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(b64, "base64");

    // Upload to Vercel Blob (or local fallback)
    const { url: pdfUrl } = await uploadCover(fileName, buffer);

    // Create a Turso record so it appears in the book list
    // Use slug: "Cover-{title}" to distinguish from interior books
    const safeTitle = title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
    const slug = `Cover-${safeTitle}`;

    if (isTursoConfigured()) {
      await upsertBook({
        slug,
        name: `${title} — Cover`,
        category: "Cover",
        description: `Cover PDF · ${pageCount}p interior · by ${author}`,
        pages: 1,
        sizeBytes: buffer.length,
        pdfUrl,
        items: [title],
      });
    }

    return NextResponse.json({
      success: true,
      url: pdfUrl,
      slug,
      fileName,
    });
  } catch (err) {
    console.error("[/api/save-cover] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
