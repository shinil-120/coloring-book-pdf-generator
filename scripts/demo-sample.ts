/**
 * scripts/demo-sample.ts
 *
 * Creates small SAMPLE coloring book PDFs (5 pages each) for testing the UI,
 * WITHOUT calling the AI image API in bulk.
 *
 * For each book, it takes the FIRST 5 items and:
 *   1. Generates a deterministic placeholder line-art image (via Sharp SVG)
 *   2. Cleans it to B&W (threshold + erode)
 *   3. Auto-colorizes it with the natural palette (flood-fill)
 *   4. Builds a 5-page PDF with the exact KDP layout
 *   5. Generates thumbnails
 *
 * Writes/merges metadata into public/downloads/coloring-books.json (max 10).
 *
 * Usage:
 *   bun run scripts/demo-sample.ts              # all 10 books, 5 pages each
 *   bun run scripts/demo-sample.ts 3            # first 3 books
 *   bun run scripts/demo-sample.ts dinosaurs    # one book by slug
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
  cleanBwImage,
  colorizeImage,
  generatePlaceholderLineArt,
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
import { getPalette } from "../src/lib/coloring-data";

const PROJECT_ROOT = process.cwd();
const DOWNLOADS_DIR = path.join(PROJECT_ROOT, "public", "downloads");
const COLORING_BOOKS_DIR = path.join(PROJECT_ROOT, "coloring-books");

const PAGES_PER_BOOK = 5;

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
  const hh = d.getUTCHours();
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ap = hh < 12 ? "AM" : "PM";
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${pad(
    h12
  )}:${pad(d.getUTCMinutes())} ${ap} UTC`;
}

interface ProcessedItem {
  item: string;
  bwPath: string;
  colorPath: string;
}

async function processItemForDemo(
  categoryDir: string,
  item: string,
  category: string
): Promise<ProcessedItem> {
  const bwDir = path.join(categoryDir, "bw");
  const cleanDir = path.join(categoryDir, "clean");
  ensureDir(bwDir);
  ensureDir(cleanDir);

  const rawBw = path.join(bwDir, `${item}.png`);
  const cleanBw = path.join(cleanDir, `${item}-bw.png`);
  const colorImg = path.join(cleanDir, `${item}-color.png`);

  // Always regenerate placeholder line art for the demo (deterministic)
  await generatePlaceholderLineArt(rawBw, item, category);

  // Clean B&W
  await cleanBwImage(rawBw, cleanBw);

  // Colorize with natural palette
  const palette = getPalette(item, category);
  await colorizeImage(cleanBw, colorImg, palette);

  return { item, bwPath: cleanBw, colorPath: colorImg };
}

function buildPdf(
  book: ColoringBook,
  processed: ProcessedItem[],
  pdfPath: string
): Promise<{ sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: book.name,
        Author: "Coloring Book Studio",
        Subject: "Amazon KDP Coloring Book (Demo)",
      },
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    processed.forEach((p, i) => {
      if (i > 0) doc.addPage();

      // 1. Colored reference (86×86 top-left)
      try {
        doc.image(fs.readFileSync(p.colorPath), REF_X, REF_Y, {
          width: REF_SIZE,
          height: REF_SIZE,
        });
      } catch {
        doc.fillColor("#CCCCCC").rect(REF_X, REF_Y, REF_SIZE, REF_SIZE).fill();
      }

      // 2. B&W coloring image (380×380 centered)
      try {
        doc.image(fs.readFileSync(p.bwPath), BW_X, BW_Y, {
          width: BW_SIZE,
          height: BW_SIZE,
        });
      } catch {
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
      resolve({ sizeBytes });
    });
    stream.on("error", reject);
  });
}

async function generateThumbnails(
  pdfPath: string,
  slug: string,
  pageCount: number
): Promise<void> {
  const thumbDir = path.join(DOWNLOADS_DIR, "thumbnails", slug);
  ensureDir(thumbDir);

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
}

async function main() {
  const arg = process.argv[2]?.trim();

  let books = BOOKS;
  if (arg) {
    if (/^\d+$/.test(arg)) {
      const n = parseInt(arg, 10);
      books = BOOKS.slice(0, n);
    } else {
      books = BOOKS.filter(
        (b) =>
          b.slug.toLowerCase().includes(arg.toLowerCase()) ||
          b.category.toLowerCase().includes(arg.toLowerCase())
      );
    }
    if (books.length === 0) {
      console.error(`No books match "${arg}"`);
      process.exit(1);
    }
  }

  console.log(`\n🎨 Demo Sample Generator`);
  console.log(`   ${books.length} book(s), ${PAGES_PER_BOOK} pages each (no AI calls)\n`);

  ensureDir(DOWNLOADS_DIR);
  ensureDir(COLORING_BOOKS_DIR);

  // Load existing metadata to merge
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

  for (const book of books) {
    console.log(`\n📖 ${book.name}`);
    const now = new Date();
    const categoryDir = path.join(COLORING_BOOKS_DIR, book.slug);
    ensureDir(categoryDir);

    // Take first PAGES_PER_BOOK items
    const items = book.items.slice(0, PAGES_PER_BOOK);
    console.log(`   processing ${items.length} items: ${items.join(", ")}`);

    const processed: ProcessedItem[] = [];
    for (const item of items) {
      process.stdout.write(`   • ${item}… `);
      try {
        const p = await processItemForDemo(categoryDir, item, book.category);
        processed.push(p);
        console.log("ok");
      } catch (e) {
        console.log(`FAIL: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (processed.length === 0) {
      console.log(`   ⚠️  no items processed, skipping`);
      continue;
    }

    // Build PDF
    const pdfPath = path.join(DOWNLOADS_DIR, `${book.slug}-Coloring-Book.pdf`);
    console.log(`   building PDF…`);
    const { sizeBytes } = await buildPdf(book, processed, pdfPath);

    // Thumbnails
    console.log(`   generating thumbnails…`);
    await generateThumbnails(pdfPath, book.slug, processed.length);

    const url = `/downloads/${book.slug}-Coloring-Book.pdf`;
    results.push({
      name: book.name,
      url,
      slug: book.slug,
      size: formatBytes(sizeBytes),
      sizeBytes,
      pages: processed.length,
      category: book.category,
      timestamp: now.toISOString(),
      readableTime: formatReadableUTC(now),
      description: `${processed.length} pages — no covers, no blanks`,
      items,
    });

    console.log(`   ✅ ${processed.length} pages, ${formatBytes(sizeBytes)}`);
  }

  // Merge: replace regenerated, keep others, cap at 10
  const justSlugs = new Set(results.map((r) => r.slug));
  const kept = existing.filter((m) => !justSlugs.has(m.slug));
  const merged = [...results, ...kept]
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 10);

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2));
  console.log(`\n📝 Wrote ${jsonPath}`);
  console.log(`   ${merged.length} book(s) in metadata (max 10)`);
  console.log(`\n✨ Demo sample ready! Open the app to view.\n`);
}

main().catch((err) => {
  console.error("\n❌ Fatal:", err);
  process.exit(1);
});
