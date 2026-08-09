import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import { listBooks, type BookMeta } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface EditPage {
  index: number;
  width: number;
  height: number;
  label: string;
  thumbnail: string;
}

/**
 * POST /api/edit-pdf
 * Body: { pdfPath: string }
 *   - Local: "/downloads/Pets-Coloring-Book.pdf"
 *   - Blob:  "https://xxx.public.blob.vercel-storage.com/pdfs/Pets-Coloring-Book.pdf"
 *
 * Returns:
 *   { success, fileName, slug, pageCount, pages: [...], pdfData: base64 }
 *
 * Handles both local filesystem files and remote Vercel Blob URLs.
 * Thumbnails are returned as Blob URLs (if the book is from Turso) or
 * local paths (if from the local JSON fallback).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pdfPath: string = body?.pdfPath;

    if (!pdfPath || typeof pdfPath !== "string") {
      return NextResponse.json(
        { success: false, error: "pdfPath is required" },
        { status: 400 }
      );
    }

    // ── Load the PDF (local file or remote Blob URL) ──────────────────
    let fileBuffer: Buffer;
    let fileName: string;
    let slug: string;

    if (pdfPath.startsWith("http://") || pdfPath.startsWith("https://")) {
      // Remote URL (Vercel Blob) — fetch it with cache-busting
      const cacheBustUrl = pdfPath + (pdfPath.includes("?") ? "&" : "?") + "t=" + Date.now();
      const res = await fetch(cacheBustUrl, { cache: "no-store" });
      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `Failed to fetch PDF: HTTP ${res.status}` },
          { status: 404 }
        );
      }
      fileBuffer = Buffer.from(await res.arrayBuffer());
      // Extract slug from URL: .../pdfs/Pets-Coloring-Book.pdf → Pets
      fileName = pdfPath.split("/").pop() ?? "book.pdf";
      slug = fileName
        .replace(/-Coloring-Book\.pdf$/i, "")
        .replace(/\.pdf$/i, "");
    } else {
      // Local filesystem path
      const projectRoot = process.cwd();
      const filePath = path.join(projectRoot, "public", pdfPath.replace(/^\//, ""));
      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { success: false, error: `PDF not found: ${pdfPath}` },
          { status: 404 }
        );
      }
      fileBuffer = fs.readFileSync(filePath);
      fileName = path.basename(filePath);
      slug = fileName
        .replace(/-Coloring-Book\.pdf$/i, "")
        .replace(/\.pdf$/i, "");
    }

    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    const pages = pdfDoc.getPages();

    // ── Load labels + thumbnail URLs from Turso (or local JSON) ────────
    let itemLabels: string[] | null = null;
    let thumbnailBaseUrl: string | null = null; // e.g. "https://xxx.blob.vercel-storage.com/thumbnails/Pets"

    // Try Turso first
    try {
      const allBooks = await listBooks();
      const book = allBooks.find((b: BookMeta) => b.slug === slug || b.url === pdfPath);
      if (book) {
        if (book.items && book.items.length > 0) {
          itemLabels = book.items;
        }
        // If the book URL is a Blob URL, thumbnails are also on Blob
        if (book.url && book.url.startsWith("http")) {
          // Extract the base Blob URL for thumbnails
          // e.g. https://xxx.blob.vercel-storage.com/pdfs/Pets-Coloring-Book.pdf
          //    → https://xxx.blob.vercel-storage.com/thumbnails/Pets
          const blobBase = book.url.replace(/\/pdfs\/.*$/, "");
          thumbnailBaseUrl = `${blobBase}/thumbnails/${slug}`;
        }
      }
    } catch {
      // ignore — fall back to local
    }

    // Fallback: local JSON for labels
    if (!itemLabels) {
      try {
        const projectRoot = process.cwd();
        const jsonPath = path.join(projectRoot, "public", "downloads", "coloring-books.json");
        if (fs.existsSync(jsonPath)) {
          const meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
          const arr = Array.isArray(meta) ? meta : meta.books ?? [];
          const book = arr.find(
            (b: { slug?: string; url?: string }) => b.slug === slug || b.url === pdfPath
          );
          if (book && Array.isArray(book.items) && book.items.length > 0) {
            itemLabels = book.items;
          }
        }
      } catch {
        // ignore
      }
    }

    // ── Build page list ────────────────────────────────────────────────
    // Cache-bust token for Blob thumbnails (prevents browser showing stale images)
    const cacheBust = thumbnailBaseUrl ? `?t=${Date.now()}` : "";
    const pageList: EditPage[] = [];
    for (let i = 0; i < pageCount; i++) {
      const p = pages[i];
      const { width, height } = p.getSize();
      const label = itemLabels && itemLabels[i] ? itemLabels[i] : `Page ${i + 1}`;

      // Thumbnail URL: Blob URL (if from Turso) or local path
      let thumbnail: string;
      if (thumbnailBaseUrl) {
        thumbnail = `${thumbnailBaseUrl}/page-${i + 1}.png${cacheBust}`;
      } else {
        thumbnail = `/downloads/thumbnails/${slug}/page-${i + 1}.png`;
      }

      pageList.push({ index: i, width, height, label, thumbnail });
    }

    // Return the source PDF as base64
    const pdfData = fileBuffer.toString("base64");

    return NextResponse.json({
      success: true,
      fileName,
      slug,
      pageCount,
      pages: pageList,
      pdfData,
    });
  } catch (err) {
    console.error("[/api/edit-pdf] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
