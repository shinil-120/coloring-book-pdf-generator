/**
 * scripts/regenerate-pdfs-no-covers.ts
 *
 * Main pipeline:
 *   For each book in BOOKS:
 *     For each item:
 *       - Process raw B&W → clean B&W (threshold 100, erode 30%)
 *       - Auto-colorize the clean B&W using natural palette
 *     Build PDF with PDFKit (one page per item, exact layout)
 *     Generate thumbnails with pdf-to-img (scale 1.2, resize 280px wide)
 *   Write metadata JSON (coloring-books.json) with actual page counts + timestamps
 *
 * Usage:
 *   bun run scripts/regenerate-pdfs-no-covers.ts            # all books
 *   bun run scripts/regenerate-pdfs-no-covers.ts dinosaurs  # one book (by slug, case-insensitive)
 *   bun run scripts/regenerate-pdfs-no-covers.ts Dinosaurs  # one book (by category)
 *
 * NOTE: This script does NOT generate the raw B&W images via the AI SDK.
 *       That is the job of scripts/generate-images.ts. If a raw image is
 *       missing, a deterministic placeholder line-art image is generated
 *       so the pipeline still produces a valid, colorizable PDF.
 */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { pdf as pdfToImg } from "pdf-to-img";
import {
  BOOKS,
  type ColoringBook,
  type ColoringBookMeta,
} from "../src/lib/coloring-data";
import {
  processItem,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  REF_SIZE,
  REF_X,
  REF_Y,
  BW_SIZE,
  BW_X,
  BW_Y,
  TITLE_Y,
  PAGE_NUM_X,
  PAGE_NUM_Y,
} from "./image-pipeline";

const PROJECT_ROOT = process.cwd();
const DOWNLOADS_DIR = path.join(PROJECT_ROOT, "public", "downloads");
const COLORING_BOOKS_DIR = path.join(PROJECT_ROOT, "coloring-books");

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatReadableUTC(d: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())} ${pad(d.getUTCHours() < 12 ? "AM" : "PM")} UTC`.replace(
    /(\d{2}):(\d{2}) (AM|PM)/,
    (_, h: string, m: string, ap: string) => {
      const hh = parseInt(h, 10);
      const h12 = hh % 12 === 0 ? 12 : hh % 12;
      return `${pad(h12)}:${m} ${ap}`;
    }
  );
}

function slugify(s: string): string {
  return s
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─────────────────────────────────────────────────────────────────────────
// Build a single PDF for one book
// ─────────────────────────────────────────────────────────────────────────

async function buildBookPdf(
  book: ColoringBook,
  items: string[]
): Promise<{ pdfPath: string; pageCount: number; sizeBytes: number }> {
  const slug = book.slug;
  const categoryDir = path.join(COLORING_BOOKS_DIR, slug);
  ensureDir(categoryDir);

  const pdfPath = path.join(DOWNLOADS_DIR, `${slug}-Coloring-Book.pdf`);
  ensureDir(path.dirname(pdfPath));

  // Process all items first
  console.log(`  [${slug}] processing ${items.length} items…`);
  const processed: { item: string; bwPath: string; colorPath: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    process.stdout.write(`    (${i + 1}/${items.length}) ${item}… `);
    try {
      const { bwPath, colorPath } = await processItem(categoryDir, item, book.category);
      processed.push({ item, bwPath, colorPath });
      console.log("ok");
    } catch (e) {
      console.log(`FAILED: ${e instanceof Error ? e.message : e}`);
      // skip this item
    }
  }

  if (processed.length === 0) {
    throw new Error(`No items processed for ${book.name}`);
  }

  // Build PDF
  console.log(`  [${slug}] building PDF…`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: book.name,
        Author: "Coloring Book Studio",
        Subject: "Amazon KDP Coloring Book",
      },
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    processed.forEach((p, i) => {
      if (i > 0) doc.addPage();

      // 1. Colored reference (86×86 at top-left)
      try {
        doc.image(fs.readFileSync(p.colorPath), REF_X, REF_Y, {
          width: REF_SIZE,
          height: REF_SIZE,
        });
      } catch {
        // draw a grey box if image fails
        doc
          .fillColor("#CCCCCC")
          .rect(REF_X, REF_Y, REF_SIZE, REF_SIZE)
          .fill();
      }

      // 2. B&W coloring image (380×380 centered)
      try {
        doc.image(fs.readFileSync(p.bwPath), BW_X, BW_Y, {
          width: BW_SIZE,
          height: BW_SIZE,
        });
      } catch {
        // draw a light border box if image fails
        doc
          .fillColor("#F5F5F5")
          .rect(BW_X, BW_Y, BW_SIZE, BW_SIZE)
          .fill()
          .strokeColor("#DDDDDD")
          .lineWidth(1)
          .rect(BW_X, BW_Y, BW_SIZE, BW_SIZE)
          .stroke();
      }

      // 3. Title (24pt Helvetica-Bold, #333333, centered, y=527)
      doc
        .fillColor("#333333")
        .font("Helvetica-Bold")
        .fontSize(24)
        .text(p.item, 0, TITLE_Y, {
          width: PAGE_WIDTH,
          align: "center",
          lineBreak: false,
        });

      // 4. Page number (10pt Helvetica, #CCCCCC, right-aligned at 546,740)
      doc
        .fillColor("#CCCCCC")
        .font("Helvetica")
        .fontSize(10)
        .text(String(i + 1), PAGE_NUM_X - 30, PAGE_NUM_Y, {
          width: 30,
          align: "right",
          lineBreak: false,
        });
    });

    doc.end();

    stream.on("finish", () => {
      const sizeBytes = fs.statSync(pdfPath).size;
      resolve({ pdfPath, pageCount: processed.length, sizeBytes });
    });
    stream.on("error", reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Generate thumbnails with pdf-to-img + sharp
// ─────────────────────────────────────────────────────────────────────────

async function generateThumbnails(
  pdfPath: string,
  slug: string,
  pageCount: number
): Promise<void> {
  const thumbDir = path.join(DOWNLOADS_DIR, "thumbnails", slug);
  ensureDir(thumbDir);

  console.log(`  [${slug}] generating ${pageCount} thumbnails…`);

  // pdf-to-img: named export `pdf`, returns an async iterable
  const pages = await pdfToImg(pdfPath, { scale: 1.2 });

  let i = 1;
  for await (const pageBuffer of pages) {
    if (i > pageCount) break;
    const outPath = path.join(thumbDir, `page-${i}.png`);
    await sharp(pageBuffer)
      .resize({ width: 280, withoutEnlargement: true })
      .png()
      .toFile(outPath);
    i++;
  }
  console.log(`  [${slug}] thumbnails done (${i - 1} pages)`);
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const filter = argv.find((a) => !a.startsWith("--"))?.toLowerCase().trim();
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.slice(8), 10) : undefined;

  let booksToProcess = BOOKS;
  if (filter) {
    booksToProcess = BOOKS.filter(
      (b) =>
        b.slug.toLowerCase().includes(filter) ||
        b.category.toLowerCase().includes(filter) ||
        b.name.toLowerCase().includes(filter)
    );
    if (booksToProcess.length === 0) {
      console.error(`No books match filter "${filter}"`);
      process.exit(1);
    }
  }

  console.log(`\n🎨 Coloring Book PDF Generator`);
  console.log(`   Processing ${booksToProcess.length} book(s): ${booksToProcess.map((b) => b.slug).join(", ")}`);
  if (limit) console.log(`   Limit: first ${limit} item(s) per book`);
  console.log("");

  ensureDir(DOWNLOADS_DIR);
  ensureDir(COLORING_BOOKS_DIR);

  // Load existing metadata so we can MERGE (max 10 books)
  const jsonPath = path.join(DOWNLOADS_DIR, "coloring-books.json");
  let existing: ColoringBookMeta[] = [];
  try {
    if (fs.existsSync(jsonPath)) {
      const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      existing = Array.isArray(raw) ? raw : raw.books ?? [];
    }
  } catch {
    existing = [];
  }

  const results: ColoringBookMeta[] = [];

  for (const book of booksToProcess) {
    let items = book.items;
    if (limit && limit > 0) {
      items = items.slice(0, limit);
    }
    console.log(`\n📖 ${book.name} (${items.length} items)`);
    const now = new Date();

    const { pdfPath, pageCount, sizeBytes } = await buildBookPdf(book, items);

    await generateThumbnails(pdfPath, book.slug, pageCount);

    const url = `/downloads/${book.slug}-Coloring-Book.pdf`;
    results.push({
      name: book.name,
      url,
      slug: book.slug,
      size: formatBytes(sizeBytes),
      sizeBytes,
      pages: pageCount,
      category: book.category,
      timestamp: now.toISOString(),
      readableTime: formatReadableUTC(now),
      description: items.length === book.items.length
        ? book.description
        : `${items.length} pages — no covers, no blanks`,
      items,
    });

    console.log(`  ✅ ${book.name}: ${pageCount} pages, ${formatBytes(sizeBytes)}`);
  }

  // Merge: replace books we just regenerated, keep others, cap at 10
  const justSlugs = new Set(results.map((r) => r.slug));
  const kept = existing.filter((m) => !justSlugs.has(m.slug));
  const merged = [...results, ...kept]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2));
  console.log(`\n📝 Wrote ${jsonPath}`);
  console.log(`   ${merged.length} book(s) in metadata (max 10)\n`);
  console.log(`✨ Done!`);
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
