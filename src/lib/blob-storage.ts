/**
 * Vercel Blob storage helper for uploading generated PDFs and thumbnails.
 *
 * In production (Vercel), files are uploaded to Vercel Blob and served via
 * CDN URLs. In local development (no BLOB_READ_WRITE_TOKEN), falls back to
 * writing to public/downloads/ (local filesystem).
 */
import { put, del, head } from "@vercel/blob";
import fs from "fs";
import path from "path";

/** Check if Vercel Blob is configured. */
export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Slugify an item name (e.g. "T-Rex" → "T-Rex", "Hot Air Balloon" → "Hot-Air-Balloon"). */
export function slugify(s: string): string {
  return s
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Build the canonical blob path for a coloring-page image. */
export function coloringPageKey(slug: string, itemName: string): string {
  return `coloring-books/${slug}/bw/${slugify(itemName)}.png`;
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
      allowOverwrite: true,
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

/**
 * Upload a generated black-and-white coloring-page image.
 * Path: `coloring-books/{slug}/bw/{itemSlug}.png` (resumable, allowOverwrite).
 */
export async function uploadColoringPage(
  slug: string,
  itemName: string,
  buffer: Buffer
): Promise<{ url: string; isLocal: boolean; key: string }> {
  const key = coloringPageKey(slug, itemName);
  const result = await uploadFile(key, buffer);
  return { ...result, key };
}

/**
 * Check if a coloring-page image already exists in Blob/local storage.
 * Returns the URL and size in bytes (size = 0 if not found).
 *
 * Used for resumable batches: if an image already exists and is bigger
 * than the 5 KB threshold, the generate endpoint will skip re-generation.
 */
export async function coloringPageExists(
  slug: string,
  itemName: string
): Promise<{ exists: boolean; sizeBytes: number; url: string | null }> {
  const key = coloringPageKey(slug, itemName);

  if (isBlobConfigured()) {
    try {
      const blob = await head(key);
      return { exists: true, sizeBytes: blob.size ?? 0, url: blob.url };
    } catch {
      return { exists: false, sizeBytes: 0, url: null };
    }
  }

  // Local fallback
  const localPath = path.join(process.cwd(), "public", "downloads", key);
  if (fs.existsSync(localPath)) {
    try {
      const stat = fs.statSync(localPath);
      return { exists: true, sizeBytes: stat.size, url: `/downloads/${key}` };
    } catch {
      return { exists: false, sizeBytes: 0, url: null };
    }
  }
  return { exists: false, sizeBytes: 0, url: null };
}
