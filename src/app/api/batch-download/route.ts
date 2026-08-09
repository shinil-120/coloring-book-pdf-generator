import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/batch-download
 * Body: { slugs: string[] }  e.g. ["Pets", "Dinosaurs"]
 *
 * Returns a ZIP archive containing all the requested coloring book PDFs.
 * The response is a binary zip file (application/zip).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slugs: string[] = Array.isArray(body?.slugs) ? body.slugs : [];

    if (slugs.length === 0) {
      return NextResponse.json(
        { success: false, error: "slugs array is required" },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const downloadsDir = path.join(projectRoot, "public", "downloads");

    // Load metadata to get nice filenames
    let meta: Array<{ slug?: string; name?: string; url?: string }> = [];
    try {
      const jsonPath = path.join(downloadsDir, "coloring-books.json");
      if (fs.existsSync(jsonPath)) {
        const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        meta = Array.isArray(raw) ? raw : raw.books ?? [];
      }
    } catch {
      // ignore
    }

    const zip = new JSZip();
    const added: string[] = [];
    const skipped: string[] = [];

    for (const slug of slugs) {
      // Find the book's URL from metadata
      const book = meta.find((b) => b.slug === slug);
      const url = book?.url ?? `/downloads/${slug}-Coloring-Book.pdf`;
      const filePath = path.join(
        projectRoot,
        "public",
        url.replace(/^\//, "")
      );

      if (!fs.existsSync(filePath)) {
        skipped.push(slug);
        continue;
      }

      const buffer = fs.readFileSync(filePath);
      const fileName = url.split("/").pop() ?? `${slug}-Coloring-Book.pdf`;
      zip.file(fileName, buffer);
      added.push(fileName);
    }

    if (added.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No PDFs found for the requested slugs",
          skipped,
        },
        { status: 404 }
      );
    }

    // Generate the zip
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Return as binary zip
    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="coloring-books-${timestamp}.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err) {
    console.error("[/api/batch-download] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
