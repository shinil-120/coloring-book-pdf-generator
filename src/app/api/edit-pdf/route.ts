import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EditPage {
  index: number;
  width: number;
  height: number;
  label: string;
  thumbnail: string;
}

/**
 * POST /api/edit-pdf
 * Body: { pdfPath: string }   e.g. "/downloads/Dinosaurs-Coloring-Book.pdf"
 *
 * Returns:
 *   { success, fileName, pageCount, pages: [...], pdfData: base64 }
 *
 * Simple 1:1 mapping: page i → items[i] → thumbnail page-(i+1).png
 * No cover/blank detection — every page is one content item.
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

    // Resolve to filesystem path under the project root.
    // pdfPath looks like "/downloads/Dinosaurs-Coloring-Book.pdf"
    const projectRoot = process.cwd();
    const filePath = path.join(projectRoot, "public", pdfPath.replace(/^\//, ""));

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        {
          success: false,
          error: `PDF not found: ${pdfPath}`,
          resolvedPath: filePath,
        },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    const pages = pdfDoc.getPages();

    // Derive the slug & thumbnail directory.
    const fileName = path.basename(filePath);
    const slug = fileName
      .replace(/-Coloring-Book\.pdf$/i, "")
      .replace(/\.pdf$/i, "");

    // Build page list with labels + thumbnails.
    const pageList: EditPage[] = [];

    // Try to load labels from metadata JSON (best-effort).
    let itemLabels: string[] | null = null;
    try {
      const jsonPath = path.join(
        projectRoot,
        "public",
        "downloads",
        "coloring-books.json"
      );
      if (fs.existsSync(jsonPath)) {
        const meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        const arr = Array.isArray(meta) ? meta : meta.books ?? [];
        const book = arr.find(
          (b: { slug?: string; url?: string }) =>
            b.slug === slug || b.url === pdfPath
        );
        if (book && Array.isArray(book.items) && book.items.length > 0) {
          itemLabels = book.items;
        }
      }
    } catch {
      // ignore — fall back to "Page N"
    }

    for (let i = 0; i < pageCount; i++) {
      const p = pages[i];
      const { width, height } = p.getSize();
      const label =
        itemLabels && itemLabels[i] ? itemLabels[i] : `Page ${i + 1}`;
      // Thumbnail URL: /downloads/thumbnails/{slug}/page-(i+1).png (1-indexed)
      const thumbnail = `/downloads/thumbnails/${slug}/page-${i + 1}.png`;
      pageList.push({
        index: i,
        width,
        height,
        label,
        thumbnail,
      });
    }

    // Return the source PDF as base64 so the client can send it back to
    // /api/assemble-pdf without re-fetching it.
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
