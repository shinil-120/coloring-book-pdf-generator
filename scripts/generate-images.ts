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
 *   bun run scripts/generate-images.ts                      # all books, all items
 *   bun run scripts/generate-images.ts pets                 # one book by slug
 *   bun run scripts/generate-images.ts pets --limit=5       # first 5 items of a book
 *   bun run scripts/generate-images.ts Dinosaurs "T-Rex"    # one book + one item (substring)
 *
 * ⚠️  WARNING: Without --limit, this calls the AI image API in bulk.
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
      // z-ai-web-dev-sdk image generation API (per the image-generation skill):
      //   response.data[0].base64  (NOT b64_json)
      //   params: { prompt, size }  (no model / n)
      const result = await zai.images.generations.create({
        prompt,
        size: "1024x1024",
      });

      const b64 = result?.data?.[0]?.base64
        ?? (result as { data?: Array<{ b64_json?: string }> })?.data?.[0]?.b64_json;
      const url = (result as { data?: Array<{ url?: string }> })?.data?.[0]?.url;

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
        console.log(`\n    429 rate-limited, waiting ${wait}s (attempt ${attempt}/${MAX_RETRIES})…`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      // Non-429 errors: retry up to MAX_RETRIES with a short backoff
      if (attempt < MAX_RETRIES) {
        const wait = 3 * attempt;
        console.log(`\n    error on "${item}" (attempt ${attempt}/${MAX_RETRIES}): ${msg.slice(0, 120)}… retrying in ${wait}s`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      console.error(`\n    ✗ FAILED ${item}: ${msg.slice(0, 200)}`);
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
  const n = Math.min(concurrency, items.length);
  const runners = Array.from({ length: n }, async () => {
    while (idx < items.length) {
      const myIdx = idx++;
      await worker(items[myIdx]);
    }
  });
  await Promise.all(runners);
}

function parseArgs(argv: string[]): {
  filter?: string;
  itemFilter?: string;
  limit?: number;
} {
  const positional: string[] = [];
  let limit: number | undefined;
  for (const a of argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice(8), 10);
      if (!Number.isNaN(n) && n > 0) limit = n;
    } else {
      positional.push(a);
    }
  }
  return { filter: positional[0], itemFilter: positional[1], limit };
}

async function main() {
  const { filter, itemFilter, limit } = parseArgs(process.argv);

  let books = BOOKS;
  if (filter) {
    books = BOOKS.filter(
      (b) =>
        b.slug.toLowerCase().includes(filter.toLowerCase()) ||
        b.category.toLowerCase().includes(filter.toLowerCase()) ||
        b.name.toLowerCase().includes(filter.toLowerCase())
    );
    if (books.length === 0) {
      console.error(`No books match "${filter}"`);
      process.exit(1);
    }
  }

  console.log(`\n🖼️  AI Image Generation (z-ai-web-dev-sdk)`);
  console.log(`   Books: ${books.map((b) => b.slug).join(", ")}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  if (limit) console.log(`   Limit: first ${limit} item(s) per book`);
  console.log("");

  const zai = await ZAI.create();

  let totalOk = 0;
  let totalFailed = 0;

  for (const book of books) {
    const bwDir = path.join(COLORING_BOOKS_DIR, book.slug, "bw");
    ensureDir(bwDir);

    let items = book.items;
    if (itemFilter) {
      items = items.filter((i) =>
        i.toLowerCase().includes(itemFilter.toLowerCase())
      );
    }
    if (limit && limit > 0) {
      items = items.slice(0, limit);
    }

    console.log(`\n📖 ${book.name} — ${items.length} items`);
    console.log(`   items: ${items.join(", ")}`);

    const tasks = items.map((item) => ({ item, category: book.category, bwDir }));
    let done = 0;
    let failed = 0;

    await runQueue(tasks, async (task) => {
      const { item, category, bwDir } = task;
      const outPath = path.join(bwDir, `${item}.png`);
      console.log(`   ▶ generating ${item}…`);
      const ok = await generateOne(zai, item, category, outPath);
      done++;
      if (!ok) failed++;
      console.log(`   ${ok ? "✓" : "✗"} ${item} [${done}/${items.length}]`);
    }, CONCURRENCY);

    console.log(`  ${book.slug}: ${done - failed} ok, ${failed} failed`);
    totalOk += done - failed;
    totalFailed += failed;
  }

  console.log(`\n✨ Image generation complete.`);
  console.log(`   Total: ${totalOk} ok, ${totalFailed} failed`);
  if (totalOk > 0) {
    console.log(`   Next: bun run scripts/regenerate-pdfs-no-covers.ts${filter ? ` ${filter}${limit ? ` --limit=${limit}` : ""}` : ""}\n`);
  }
}

main().catch((err) => {
  console.error("\n❌ Fatal:", err);
  process.exit(1);
});
