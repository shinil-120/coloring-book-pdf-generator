/**
 * scripts/generate-images.ts
 *
 * Multi-provider AI image generation with automatic failover.
 *
 * Supports multiple API platforms simultaneously:
 *   - Z.AI (z-ai-web-dev-sdk)
 *   - Together AI (FLUX.1-schnell — $0.003/image)
 *   - Fal.ai (FLUX.1-schnell — $0.001/image)
 *   - Replicate (FLUX.1-schnell — ~$0.003/image)
 *   - OpenAI DALL-E 3 ($0.04/image)
 *
 * Set any combination of API keys in .env.local:
 *   ZAI_API_KEY=your-zai-key
 *   TOGETHER_API_KEY=your-together-key
 *   FAL_API_KEY=your-fal-key
 *   REPLICATE_API_TOKEN=your-replicate-token
 *   OPENAI_API_KEY=your-openai-key
 *
 * The script tries providers in priority order. If one fails (rate limit,
 * quota exhausted, error), it automatically falls back to the next.
 *
 * Usage:
 *   bun run scripts/generate-images.ts pets --limit=5
 *   bun run scripts/generate-images.ts dinosaurs
 */
import fs from "fs";
import path from "path";
import {
  BOOKS,
  categorySuffix,
} from "../src/lib/coloring-data";

// ─────────────────────────────────────────────────────────────────────────
// Provider definitions
// ─────────────────────────────────────────────────────────────────────────

interface ProviderResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
}

interface Provider {
  name: string;
  envKey: string;
  priority: number;
  generate: (prompt: string) => Promise<ProviderResult>;
}

// Check if a provider is configured (has API key)
function hasKey(key: string): boolean {
  return !!process.env[key] && process.env[key]!.length > 5;
}

// ── Provider: Z.AI (z-ai-web-dev-sdk) ────────────────────────────────────
async function generateWithZAI(prompt: string): Promise<ProviderResult> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const result = await zai.images.generations.create({ prompt, size: "1024x1024" });
  const b64 = result?.data?.[0]?.base64
    ?? (result as { data?: Array<{ b64_json?: string }> })?.data?.[0]?.b64_json;
  const url = (result as { data?: Array<{ url?: string }> })?.data?.[0]?.url;
  if (b64) return { success: true, buffer: Buffer.from(b64, "base64") };
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch url: HTTP ${res.status}`);
    return { success: true, buffer: Buffer.from(await res.arrayBuffer()) };
  }
  throw new Error("No image data from Z.AI");
}

// ── Provider: Together AI (FLUX.1-schnell — $0.003/image) ────────────────
async function generateWithTogether(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.TOGETHER_API_KEY!;
  const res = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-schnell",
      prompt,
      width: 1024,
      height: 1024,
      steps: 4,
      n: 1,
      response_format: "b64_json",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Together AI HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No b64_json from Together AI");
  return { success: true, buffer: Buffer.from(b64, "base64") };
}

// ── Provider: Fal.ai (FLUX.1-schnell — $0.001/image) ─────────────────────
async function generateWithFal(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.FAL_API_KEY!;
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fal.ai HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error("No image URL from Fal.ai");
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Fal.ai image fetch: HTTP ${imgRes.status}`);
  return { success: true, buffer: Buffer.from(await imgRes.arrayBuffer()) };
}

// ── Provider: Replicate (FLUX.1-schnell — ~$0.003/image) ─────────────────
async function generateWithReplicate(prompt: string): Promise<ProviderResult> {
  const apiToken = process.env.REPLICATE_API_TOKEN!;
  // Start prediction
  const startRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      input: {
        model: "black-forest-labs/FLUX.1-schnell",
        prompt,
        width: 1024,
        height: 1024,
        num_outputs: 1,
      },
    }),
  });
  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Replicate HTTP ${startRes.status}: ${err.slice(0, 200)}`);
  }
  const prediction = await startRes.json();
  const getUrl = prediction?.urls?.get;
  if (!getUrl) throw new Error("No polling URL from Replicate");

  // Poll for completion (max 60 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(getUrl, {
      headers: { "Authorization": `Bearer ${apiToken}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    if (pollData.status === "succeeded") {
      const url = pollData.output?.[0] ?? pollData.output;
      if (typeof url === "string") {
        const imgRes = await fetch(url);
        if (!imgRes.ok) throw new Error(`Replicate image fetch: HTTP ${imgRes.status}`);
        return { success: true, buffer: Buffer.from(await imgRes.arrayBuffer()) };
      }
      throw new Error("No image URL in Replicate output");
    }
    if (pollData.status === "failed") throw new Error("Replicate prediction failed");
  }
  throw new Error("Replicate timed out (60s)");
}

// ── Provider: OpenAI DALL-E 3 ($0.04/image) ──────────────────────────────
async function generateWithOpenAI(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
      response_format: "b64_json",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No b64_json from OpenAI");
  return { success: true, buffer: Buffer.from(b64, "base64") };
}

// ─────────────────────────────────────────────────────────────────────────
// Build list of available providers (sorted by priority)
// ─────────────────────────────────────────────────────────────────────────

function getAvailableProviders(): Provider[] {
  const providers: Provider[] = [];

  // Fal.ai — cheapest ($0.001/image)
  if (hasKey("FAL_API_KEY")) {
    providers.push({ name: "Fal.ai", envKey: "FAL_API_KEY", priority: 1, generate: generateWithFal });
  }

  // Together AI — very cheap ($0.003/image)
  if (hasKey("TOGETHER_API_KEY")) {
    providers.push({ name: "Together AI", envKey: "TOGETHER_API_KEY", priority: 2, generate: generateWithTogether });
  }

  // Replicate — cheap (~$0.003/image)
  if (hasKey("REPLICATE_API_TOKEN")) {
    providers.push({ name: "Replicate", envKey: "REPLICATE_API_TOKEN", priority: 3, generate: generateWithReplicate });
  }

  // Z.AI — current provider (free tier)
  if (hasKey("ZAI_API_KEY")) {
    providers.push({ name: "Z.AI", envKey: "ZAI_API_KEY", priority: 4, generate: generateWithZAI });
  }

  // OpenAI DALL-E 3 — most expensive ($0.04/image)
  if (hasKey("OPENAI_API_KEY")) {
    providers.push({ name: "OpenAI", envKey: "OPENAI_API_KEY", priority: 5, generate: generateWithOpenAI });
  }

  // Sort by priority
  providers.sort((a, b) => a.priority - b.priority);
  return providers;
}

// ─────────────────────────────────────────────────────────────────────────
// Generate with automatic failover across providers
// ─────────────────────────────────────────────────────────────────────────

async function generateWithFailover(
  prompt: string,
  providers: Provider[]
): Promise<{ buffer: Buffer; providerName: string }> {
  let lastError = "";

  for (const provider of providers) {
    try {
      console.log(`      → trying ${provider.name}…`);
      const result = await provider.generate(prompt);
      if (result.success && result.buffer) {
        console.log(`      ✓ ${provider.name} succeeded`);
        return { buffer: result.buffer, providerName: provider.name };
      }
      lastError = result.error || "Unknown error";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      const isQuotaError = msg.includes("429") || msg.includes("402") || /rate.?limit|quota|insufficient|billing|payment/i.test(msg);

      if (isQuotaError) {
        console.log(`      ✗ ${provider.name} quota/rate-limited: ${msg.slice(0, 100)}`);
        console.log(`      → falling back to next provider…`);
        continue; // try next provider
      }

      // Non-quota error — still try next provider
      console.log(`      ✗ ${provider.name} error: ${msg.slice(0, 100)}`);
      continue;
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Main script
// ─────────────────────────────────────────────────────────────────────────

const CONCURRENCY = 5;
const MAX_RETRIES = 3;

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function buildPrompt(item: string, category: string): string {
  const suffix = categorySuffix(category);
  return `Black and white line drawing coloring page for kids of a ${item} ${suffix}. Simple clean outline, no shading, no gray tones, thick black lines on white background, suitable for children coloring book, cartoon style, cute and friendly, single subject centered on page, full body visible`;
}

async function generateOne(
  providers: Provider[],
  item: string,
  category: string,
  outPath: string
): Promise<{ ok: boolean; provider?: string }> {
  // Skip if exists and >5KB
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) {
    return { ok: true, provider: "cached" };
  }

  const prompt = buildPrompt(item, category);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { buffer, providerName } = await generateWithFailover(prompt, providers);
      ensureDir(path.dirname(outPath));
      fs.writeFileSync(outPath, buffer);
      return { ok: true, provider: providerName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) {
        const wait = 5 * attempt;
        console.log(`\n      retry ${attempt}/${MAX_RETRIES} in ${wait}s: ${msg.slice(0, 100)}`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      console.error(`\n      ✗ FAILED ${item}: ${msg.slice(0, 200)}`);
      return { ok: false };
    }
  }
  return { ok: false };
}

// Run a queue with limited concurrency
async function runQueue<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number
) {
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
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

  // Load environment variables from .env file
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  }

  // Get available providers
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    console.error("\n❌ No image generation API keys found!");
    console.error("\n   Add at least one API key to .env or .env.local:");
    console.error("     FAL_API_KEY=xxx          (fal.ai — $0.001/image)");
    console.error("     TOGETHER_API_KEY=xxx      (together.ai — $0.003/image)");
    console.error("     REPLICATE_API_TOKEN=xxx   (replicate.com — $0.003/image)");
    console.error("     ZAI_API_KEY=xxx           (z.ai — free tier)");
    console.error("     OPENAI_API_KEY=xxx        (openai.com — $0.04/image)");
    console.error("\n   You can add multiple keys — the script auto-fails over.\n");
    process.exit(1);
  }

  console.log(`\n🖼️  Multi-Provider Image Generation`);
  console.log(`   Active providers (in priority order):`);
  providers.forEach((p, i) => {
    const prices: Record<string, string> = {
      "Fal.ai": "$0.001/img",
      "Together AI": "$0.003/img",
      "Replicate": "~$0.003/img",
      "Z.AI": "free tier",
      "OpenAI": "$0.04/img",
    };
    console.log(`     ${i + 1}. ${p.name} (${prices[p.name] || "?"})`);
  });

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

  console.log(`\n   Books: ${books.map((b) => b.slug).join(", ")}`);
  if (limit) console.log(`   Limit: first ${limit} item(s) per book`);
  console.log("");

  let totalOk = 0;
  let totalFailed = 0;
  const providerStats: Record<string, number> = {};

  for (const book of books) {
    const bwDir = path.join(process.cwd(), "coloring-books", book.slug, "bw");
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

    const tasks = items.map((item) => ({ item, category: book.category, bwDir }));
    let done = 0;
    let failed = 0;

    await runQueue(tasks, async (task) => {
      const { item, category, bwDir } = task;
      const outPath = path.join(bwDir, `${item}.png`);
      console.log(`   ▶ generating ${item}…`);
      const result = await generateOne(providers, item, category, outPath);
      done++;
      if (!result.ok) failed++;
      if (result.provider) {
        providerStats[result.provider] = (providerStats[result.provider] || 0) + 1;
      }
      console.log(`   ${result.ok ? "✓" : "✗"} ${item} [${done}/${items.length}]${result.provider ? ` via ${result.provider}` : ""}`);
    });

    console.log(`\n  ${book.slug}: ${done - failed} ok, ${failed} failed`);
    totalOk += done - failed;
    totalFailed += failed;
  }

  console.log(`\n✨ Image generation complete.`);
  console.log(`   Total: ${totalOk} ok, ${totalFailed} failed`);
  console.log(`\n   Provider usage:`);
  for (const [name, count] of Object.entries(providerStats)) {
    console.log(`     ${name}: ${count} images`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Fatal:", err);
  process.exit(1);
});
