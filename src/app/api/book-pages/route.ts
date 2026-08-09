import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { listBooks, type BookMeta } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageData {
  index: number;
  pageNumber: number;
  label: string;
  thumbnail: string;
}

/**
 * POST /api/book-pages
 * Body: { slug: string }
 *
 * Returns all page thumbnails + labels for a book (for the preview modal).
 *
 * In production (Turso): reads book metadata from Turso, constructs Blob URLs.
 * In local dev (no Turso): reads from local filesystem + JSON.
 *
 * Returns: { success, slug, pageCount, pages: [...] }
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

    // ── Try Turso first ────────────────────────────────────────────────
    let book: BookMeta | null = null;
    try {
      const allBooks = await listBooks();
      book = allBooks.find((b) => b.slug === slug) ?? null;
    } catch {
      // ignore
    }

    if (book) {
      // Construct Blob thumbnail URLs from the book's PDF URL
      // PDF URL: https://xxx.blob.vercel-storage.com/pdfs/Pets-Coloring-Book.pdf
      // Thumb:   https://xxx.blob.vercel-storage.com/thumbnails/Pets/page-N.png
      let thumbnailBaseUrl: string;
      if (book.url && book.url.startsWith("http")) {
        const blobBase = book.url.replace(/\/pdfs\/.*$/, "");
        thumbnailBaseUrl = `${blobBase}/thumbnails/${slug}`;
      } else {
        // Local URL
        thumbnailBaseUrl = `/downloads/thumbnails/${slug}`;
      }

      const pageCount = book.pages;
      const items = book.items ?? [];
      const pages: PageData[] = [];
      for (let i = 0; i < pageCount; i++) {
        pages.push({
          index: i,
          pageNumber: i + 1,
          label: items[i] ?? `Page ${i + 1}`,
          thumbnail: `${thumbnailBaseUrl}/page-${i + 1}.png`,
        });
      }

      return NextResponse.json({
        success: true,
        slug,
        pageCount: pages.length,
        pages,
      });
    }

    // ── Fallback: local filesystem ─────────────────────────────────────
    const projectRoot = process.cwd();
    const thumbDir = path.join(projectRoot, "public", "downloads", "thumbnails", slug);
    if (fs.existsSync(thumbDir)) {
      const files = fs
        .readdirSync(thumbDir)
        .filter((f) => /^page-\d+\.png$/i.test(f))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)![0], 10);
          const nb = parseInt(b.match(/\d+/)![0], 10);
          return na - nb;
        });

      if (files.length > 0) {
        // Load labels from local JSON
        let itemLabels: string[] | null = null;
        try {
          const jsonPath = path.join(projectRoot, "public", "downloads", "coloring-books.json");
          if (fs.existsSync(jsonPath)) {
            const meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
            const arr = Array.isArray(meta) ? meta : meta.books ?? [];
            const localBook = arr.find((b: { slug?: string }) => b.slug === slug);
            if (localBook && Array.isArray(localBook.items)) {
              itemLabels = localBook.items;
            }
          }
        } catch {
          // ignore
        }

        const pages: PageData[] = files.map((file, i) => {
          const pageNumber = parseInt(file.match(/\d+/)![0], 10);
          return {
            index: i,
            pageNumber,
            label: itemLabels?.[i] ?? `Page ${pageNumber}`,
            thumbnail: `/downloads/thumbnails/${slug}/${file}`,
          };
        });

        return NextResponse.json({
          success: true,
          slug,
          pageCount: pages.length,
          pages,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: `No thumbnails found for slug "${slug}"` },
      { status: 404 }
    );
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
