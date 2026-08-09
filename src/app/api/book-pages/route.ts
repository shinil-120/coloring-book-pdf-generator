import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageData {
  index: number;       // 0-based page index
  pageNumber: number;  // 1-based
  label: string;       // item name or "Page N"
  thumbnail: string;   // /downloads/thumbnails/{slug}/page-N.png
}

/**
 * POST /api/book-pages
 * Body: { slug: string }  or  { pdfPath: string }
 *
 * Returns all page thumbnails + labels for a book, for the preview modal.
 * Reads labels from coloring-books.json (best-effort).
 *
 * Returns: { success, slug, pageCount, pages: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug: string = body?.slug ?? "";
    const pdfPath: string = body?.pdfPath ?? "";

    if (!slug && !pdfPath) {
      return NextResponse.json(
        { success: false, error: "slug or pdfPath is required" },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const downloadsDir = path.join(projectRoot, "public", "downloads");

    // Resolve slug from pdfPath if needed
    let resolvedSlug = slug;
    if (!resolvedSlug && pdfPath) {
      const fileName = path.basename(pdfPath);
      resolvedSlug = fileName.replace(/-Coloring-Book\.pdf$/i, "").replace(/\.pdf$/i, "");
    }

    // Thumbnail directory
    const thumbDir = path.join(downloadsDir, "thumbnails", resolvedSlug);
    if (!fs.existsSync(thumbDir)) {
      return NextResponse.json(
        { success: false, error: `No thumbnails found for slug "${resolvedSlug}"` },
        { status: 404 }
      );
    }

    // List page-N.png files (1-indexed)
    const files = fs
      .readdirSync(thumbDir)
      .filter((f) => /^page-\d+\.png$/i.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)![0], 10);
        const nb = parseInt(b.match(/\d+/)![0], 10);
        return na - nb;
      });

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No page thumbnails found" },
        { status: 404 }
      );
    }

    // Load labels from metadata JSON (best-effort)
    let itemLabels: string[] | null = null;
    try {
      const jsonPath = path.join(downloadsDir, "coloring-books.json");
      if (fs.existsSync(jsonPath)) {
        const meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        const arr = Array.isArray(meta) ? meta : meta.books ?? [];
        const book = arr.find(
          (b: { slug?: string; url?: string }) =>
            b.slug === resolvedSlug ||
            (pdfPath && b.url === pdfPath)
        );
        if (book && Array.isArray(book.items) && book.items.length > 0) {
          itemLabels = book.items;
        }
      }
    } catch {
      // ignore
    }

    const pages: PageData[] = files.map((file, i) => {
      const pageNumber = parseInt(file.match(/\d+/)![0], 10);
      const label =
        itemLabels && itemLabels[i] ? itemLabels[i] : `Page ${pageNumber}`;
      return {
        index: i,
        pageNumber,
        label,
        thumbnail: `/downloads/thumbnails/${resolvedSlug}/${file}`,
      };
    });

    return NextResponse.json({
      success: true,
      slug: resolvedSlug,
      pageCount: pages.length,
      pages,
    });
  } catch (err) {
    console.error("[/api/book-pages] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
