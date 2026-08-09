/**
 * Vercel Blob storage helper for uploading generated PDFs and thumbnails.
 *
 * In production (Vercel), files are uploaded to Vercel Blob and served via
 * CDN URLs. In local development (no BLOB_READ_WRITE_TOKEN), falls back to
 * writing to public/downloads/ (local filesystem).
 */
import { put, del } from "@vercel/blob";
import fs from "fs";
import path from "path";

/** Check if Vercel Blob is configured. */
export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Upload a file to Vercel Blob. If Blob is not configured (local dev),
 * writes to public/downloads/ instead and returns a local URL.
 *
 * @param key    - Blob path, e.g. "pdfs/Pets-Coloring-Book.pdf"
 * @param buffer - File content
 * @returns Public URL to access the file
 */
export async function uploadFile(
  key: string,
  buffer: Buffer
): Promise<{ url: string; isLocal: boolean }> {
  if (isBlobConfigured()) {
    const blob = await put(key, buffer, {
      access: "public",
      addRandomSuffix: false,
    });
    return { url: blob.url, isLocal: false };
  }

  // Local fallback: write to public/downloads/
  const localPath = path.join(process.cwd(), "public", "downloads", key);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return { url: `/downloads/${key}`, isLocal: true };
}

/**
 * Upload a PDF file. Key is the blob path (e.g. "pdfs/Pets-Coloring-Book.pdf").
 */
export async function uploadPdf(
  slug: string,
  buffer: Buffer
): Promise<{ url: string; isLocal: boolean }> {
  return uploadFile(`pdfs/${slug}-Coloring-Book.pdf`, buffer);
}

/**
 * Upload a thumbnail image. Key includes slug and page number.
 */
export async function uploadThumbnail(
  slug: string,
  pageNumber: number,
  buffer: Buffer
): Promise<{ url: string; isLocal: boolean }> {
  return uploadFile(`thumbnails/${slug}/page-${pageNumber}.png`, buffer);
}

/**
 * Upload a cover PDF.
 */
export async function uploadCover(
  fileName: string,
  buffer: Buffer
): Promise<{ url: string; isLocal: boolean }> {
  return uploadFile(`covers/${fileName}`, buffer);
}

/**
 * Delete a file from Blob (or local filesystem in dev).
 */
export async function deleteFile(url: string): Promise<void> {
  if (url.startsWith("/downloads/")) {
    // Local file
    const localPath = path.join(process.cwd(), "public", url);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    return;
  }
  if (isBlobConfigured()) {
    try {
      await del(url);
    } catch (e) {
      console.error("[blob] delete failed:", e);
    }
  }
}

/**
 * Read a file from a URL (Blob or local). Returns a Buffer.
 * For Blob URLs, fetches the content. For local URLs, reads from disk.
 */
export async function readFile(url: string): Promise<Buffer> {
  if (url.startsWith("/downloads/")) {
    const localPath = path.join(process.cwd(), "public", url);
    return fs.readFileSync(localPath);
  }
  // Blob URL — fetch it
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
