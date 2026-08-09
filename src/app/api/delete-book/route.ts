import { NextRequest, NextResponse } from "next/server";
import { deleteBook, getBook, isTursoConfigured } from "@/lib/turso";
import { deleteFile, isBlobConfigured } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/delete-book
 * Body: { slug: string }
 *
 * Deletes a book (or cover) from Turso + Vercel Blob.
 * Also deletes the PDF and all associated thumbnails from Blob.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug: string = body?.slug ?? "";

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "slug is required" },
        { status: 400 }
      );
    }

    // Get the book record first (to find Blob URLs for deletion)
    let pdfUrl: string | null = null;
    let thumbBaseUrl: string | null = null;

    if (isTursoConfigured()) {
      const book = await getBook(slug);
      if (book) {
        pdfUrl = book.url;
        // Construct thumbnail base URL
        if (pdfUrl && pdfUrl.startsWith("http")) {
          const blobBase = pdfUrl.replace(/\/pdfs\/.*$/, "");
          thumbBaseUrl = `${blobBase}/thumbnails/${slug}`;
        }
      }
    }

    // Delete PDF from Blob
    if (pdfUrl && pdfUrl.startsWith("http") && isBlobConfigured()) {
      try {
        await deleteFile(pdfUrl);
      } catch {
        // non-fatal
      }
    }

    // Delete thumbnails from Blob (if we know the base URL and page count)
    if (thumbBaseUrl && isBlobConfigured()) {
      const book = await getBook(slug);
      if (book) {
        for (let i = 1; i <= book.pages; i++) {
          try {
            await deleteFile(`${thumbBaseUrl}/page-${i}.png`);
          } catch {
            // non-fatal
          }
        }
      }
    }

    // Delete from Turso
    if (isTursoConfigured()) {
      await deleteBook(slug);
    }

    return NextResponse.json({
      success: true,
      slug,
      message: `Deleted "${slug}" from database and storage`,
    });
  } catch (err) {
    console.error("[/api/delete-book] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
