/**
 * scripts/generate-images.ts
 *
 * Generates raw B&W line-art images via the z-ai-web-dev-sdk (backend only).
 *
 *   - Batches of 5 concurrent requests
 *   - Retry on 429: wait 15 × attempt seconds, up to 4 attempts
 *   - Skips images that already exist (>5KB)
 *
 * Usage:
 *   bun run scripts/generate-images.ts                     # all books, all items
 *   bun run scripts/generate-images.ts dinosaurs           # one book by slug
 *   bun run scripts/generate-images.ts Dinosaurs "T-Rex"   # one book + one item
 *
 * ⚠️  WARNING: This calls the AI image API in bulk (300 images for all books).
 *     For quick testing, prefer scripts/demo-sample.ts which uses placeholder
 *     line-art and produces 5-page sample PDFs without any AI calls.
 *
 * NOTE: z-ai-web-dev-sdk MUST be used in the backend only. This script runs
 *       under Bun/Node, never in the browser.
 */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import {
  BOOKS,
  categorySuffix,
} from "../src/lib/coloring-data";

const PROJECT_ROOT = process.cwd();
const COLORING_BOOKS_DIR = path.join(PROJECT_ROOT, "coloring-books");

const CONCURRENCY = 5;
const MAX_RETRIES = 4;

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function buildPrompt(item: string, category: string): string {
  const suffix = categorySuffix(category);
  return `Black and white line drawing coloring page for kids of a ${item} ${suffix}. Simple clean outline, no shading, no gray tones, thick black lines on white background, suitable for children coloring book, cartoon style, cute and friendly, single subject centered on page, full body visible`;
}

async function generateOne(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  item: string,
  category: string,
  outPath: string
): Promise<boolean> {
  // Skip if exists and >5KB
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) {
    return true;
  }

  const prompt = buildPrompt(item, category);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await zai.images.generations.create({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
      });

      const b64 = result?.data?.[0]?.b64_json;
      const url = result?.data?.[0]?.url;

      if (b64) {
        ensureDir(path.dirname(outPath));
        fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
        return true;
      } else if (url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch url: HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        ensureDir(path.dirname(outPath));
        fs.writeFileSync(outPath, buf);
        return true;
      }
      throw new Error("No image data in response");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429") || /rate.?limit/i.test(msg);
      if (is429 && attempt < MAX_RETRIES) {
        const wait = 15 * attempt;
        console.log(`    429 rate-limited, waiting ${wait}s (attempt ${attempt}/${MAX_RETRIES})…`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      console.error(`    ✗ FAILED ${item}: ${msg}`);
      return false;
    }
  }
  return false;
}

// Run a queue with limited concurrency
async function runQueue<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number
) {
  let idx = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const myIdx = idx++;
      await worker(items[myIdx]);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const filter = process.argv[2]?.trim();
  const itemFilter = process.argv[3]?.trim();

  let books = BOOKS;
  if (filter) {
    books = BOOKS.filter(
      (b) =>
        b.slug.toLowerCase().includes(filter.toLowerCase()) ||
        b.category.toLowerCase().includes(filter.toLowerCase())
    );
    if (books.length === 0) {
      console.error(`No books match "${filter}"`);
      process.exit(1);
    }
  }

  console.log(`\n🖼️  AI Image Generation`);
  console.log(`   Books: ${books.map((b) => b.slug).join(", ")}`);
  console.log(`   Concurrency: ${CONCURRENCY}\n`);

  const zai = await ZAI.create();

  for (const book of books) {
    const bwDir = path.join(COLORING_BOOKS_DIR, book.slug, "bw");
    ensureDir(bwDir);

    let items = book.items;
    if (itemFilter) {
      items = items.filter((i) =>
        i.toLowerCase().includes(itemFilter.toLowerCase())
      );
    }

    console.log(`\n📖 ${book.name} — ${items.length} items`);

    const tasks = items.map((item) => ({ item, book, bwDir }));
    let done = 0;
    let failed = 0;

    await runQueue(tasks, async ({ item, book, bwDir }) => {
      const outPath = path.join(bwDir, `${item}.png`);
      const ok = await generateOne(zai, item, book.category, outPath);
      done++;
      if (!ok) failed++;
      process.stdout.write(
        `\r  [${done}/${items.length}] ${ok ? "✓" : "✗"} ${item}      `
      );
    });

    console.log(`\n  ${book.slug}: ${done - failed} ok, ${failed} failed`);
  }

  console.log(`\n✨ Image generation complete.`);
  console.log(`   Run: bun run scripts/regenerate-pdfs-no-covers.ts\n`);
}

main().catch((err) => {
  console.error("\n❌ Fatal:", err);
  process.exit(1);
});
