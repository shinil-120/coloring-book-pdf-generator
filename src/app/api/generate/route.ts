import { NextRequest, NextResponse } from "next/server";
import {
  getCategory,
  listItems,
} from "@/lib/category-store";
import {
  listActiveProviders,
  recordUsage,
  isTursoConfigured,
} from "@/lib/provider-store";
import { generateWithFailover, getPricePerImage } from "@/lib/providers";
import { categorySuffix } from "@/lib/coloring-data";
import { buildPrompt } from "@/lib/prompt-builder";
import {
  coloringPageExists,
  uploadColoringPage,
} from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro limit

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/** Skip re-generation if the existing image is at least this big. */
const MIN_IMAGE_BYTES = 5 * 1024; // 5 KB

const SUPPORTED_QUALITIES = new Set(["low", "medium", "high", "standard"]);

interface GenerateBody {
  categorySlug?: string;
  itemNames?: string[];
  quality?: string;
  size?: string;
  batchSize?: number;
  dryRun?: boolean;
  resumeMode?: boolean;
}

interface ItemResult {
  itemName: string;
  success: boolean;
  skipped: boolean;
  providerLabel?: string;
  providerType?: string;
  costUsd: number;
  blobUrl?: string | null;
  sizeBytes?: number;
  error?: string;
  durationMs?: number;
}

interface GenerateSummary {
  totalItems: number;
  success: number;
  failed: number;
  skipped: number;
  totalCostUsd: number;
  results: ItemResult[];
}

/**
 * POST /api/generate
 *
 * Generates one or more coloring-book images using the configured providers,
 * with automatic failover across providers. Saves each image to Vercel Blob
 * at `coloring-books/{slug}/bw/{item}.png` (overwriting if it already exists).
 *
 * Body:
 *   categorySlug  string    — e.g. "Dinosaurs"
 *   itemNames     string[]  — e.g. ["T-Rex", "Triceratops"]
 *   quality       string    — "low" | "medium" | "high" | "standard" (default "medium")
 *   size          string    — "1024x1024" (default)
 *   batchSize     number    — max images per request (default 5, Vercel 60s limit)
 *   dryRun        boolean   — if true, return a cost estimate WITHOUT generating
 *   resumeMode    boolean   — if true (default), skip items that already have an
 *                             image ≥5 KB. If false, regenerate over existing images.
 *
 * Returns:
 *   { success, summary: {totalItems, success, failed, skipped, totalCostUsd, results},
 *     remainingItems: string[] } — items not yet processed (for resumable batches).
 *
 * Never crashes the whole batch on a single item failure — failures are
 * recorded per-item and the loop continues.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured — set TURSO_DATABASE_URL" },
        { status: 503 }
      );
    }

    const body = (await req.json()) as GenerateBody;
    const categorySlug = (body.categorySlug ?? "").trim();
    const itemNames = Array.isArray(body.itemNames) ? body.itemNames : [];

    if (!categorySlug) {
      return NextResponse.json(
        { success: false, error: "categorySlug is required" },
        { status: 400 }
      );
    }
    if (itemNames.length === 0) {
      return NextResponse.json(
        { success: false, error: "itemNames must be a non-empty array" },
        { status: 400 }
      );
    }

    const quality = (body.quality ?? "medium").trim().toLowerCase();
    if (!SUPPORTED_QUALITIES.has(quality)) {
      return NextResponse.json(
        {
          success: false,
          error: `quality must be one of: ${[...SUPPORTED_QUALITIES].join(", ")}`,
        },
        { status: 400 }
      );
    }
    const size = (body.size ?? "1024x1024").trim();

    const batchSize = Math.max(1, Math.min(body.batchSize ?? 5, 20));
    const dryRun = !!body.dryRun;
    const resumeMode = body.resumeMode !== false; // default true

    // ── Resolve category + items ────────────────────────────────────────
    const category = await getCategory(categorySlug);
    if (!category) {
      return NextResponse.json(
        { success: false, error: `Category "${categorySlug}" not found` },
        { status: 404 }
      );
    }

    const items = await listItems(category.id, false);
    const knownNames = new Set(items.map((it) => it.name));
    const unknownNames = itemNames.filter((n) => !knownNames.has(n));
    if (unknownNames.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown item names in category "${categorySlug}": ${unknownNames.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // ── Resolve providers ───────────────────────────────────────────────
    const providers = await listActiveProviders();

    // ── Dry-run mode: estimate cost WITHOUT calling any provider ───────
    // Returns a per-item breakdown of estimated cost + skip flags.
    if (dryRun) {
      // First, check which items already exist (so we can skip them in the
      // estimate when resumeMode is on).
      const existsChecks = await Promise.all(
        itemNames.map((n) => coloringPageExists(categorySlug, n))
      );
      const willSkip = existsChecks.map((e) => e.exists && e.sizeBytes >= MIN_IMAGE_BYTES);
      const toGenerateCount = resumeMode
        ? willSkip.filter((s) => !s).length
        : itemNames.length;

      // Pick the cheapest configured provider for the estimate (if any).
      // If no providers are configured, still return success=true with $0 cost
      // so the UI can show "no provider configured" warning separately.
      let perImage = 0;
      let estimatorLabel = "No providers configured";
      let estimatorType: string | null = null;
      if (providers.length > 0) {
        // Pick the first active provider (already sorted by failover order).
        const p = providers[0];
        const model = p.model ?? "gpt-image-2"; // fallback price table
        perImage = getPricePerImage(model, quality);
        estimatorLabel = p.label;
        estimatorType = p.type;
      }

      const results: ItemResult[] = itemNames.map((n, i) => {
        const skip = resumeMode && willSkip[i];
        return {
          itemName: n,
          success: true,
          skipped: skip,
          costUsd: skip ? 0 : perImage,
        };
      });

      const summary: GenerateSummary = {
        totalItems: itemNames.length,
        success: toGenerateCount,
        failed: 0,
        skipped: resumeMode ? willSkip.filter(Boolean).length : 0,
        totalCostUsd: results.reduce((s, r) => s + r.costUsd, 0),
        results,
      };

      return NextResponse.json({
        success: true,
        dryRun: true,
        summary,
        remainingItems: itemNames,
        category: { slug: category.slug, name: category.name },
        quality,
        size,
        batchSize,
        perImageCostUsd: perImage,
        providerLabel: estimatorLabel,
        providerType: estimatorType,
        providersConfigured: providers.length,
      });
    }

    if (providers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No active image providers — configure one in /api/providers first.",
        },
        { status: 503 }
      );
    }

    // ── Slice the batch (resumable batches respect Vercel's 60s limit) ─
    const namesToProcess = itemNames.slice(0, batchSize);
    const results: ItemResult[] = [];

    for (const itemName of namesToProcess) {
      const itemStart = Date.now();
      try {
        // 1. Check if image already exists in blob (resumable batches).
        // resumeMode (default true) → skip existing images so the client can
        // retry the whole batch without paying twice.
        // resumeMode === false → overwrite existing images (regenerate).
        if (resumeMode) {
          const existing = await coloringPageExists(categorySlug, itemName);
          if (existing.exists && existing.sizeBytes >= MIN_IMAGE_BYTES) {
            results.push({
              itemName,
              success: true,
              skipped: true,
              costUsd: 0,
              blobUrl: existing.url,
              sizeBytes: existing.sizeBytes,
              durationMs: Date.now() - itemStart,
            });
            continue;
          }
        }

        // 2. Build prompt
        const prompt = buildPrompt(itemName, category.name);

        // 3. Generate (with failover across providers)
        const result = await generateWithFailover(providers, { prompt, size, quality });

        // 4. Save to blob
        const upload = await uploadColoringPage(categorySlug, itemName, result.buffer);

        // 5. Record usage in Turso (per provider, per day)
        try {
          await recordUsage(result.providerId, result.costUsd);
        } catch (e) {
          // Usage recording is non-fatal — we still have the image.
          console.error("[/api/generate] recordUsage failed:", e);
        }

        results.push({
          itemName,
          success: true,
          skipped: false,
          providerLabel: result.providerLabel,
          providerType: result.providerType,
          costUsd: result.costUsd,
          blobUrl: upload.url,
          sizeBytes: result.buffer.length,
          durationMs: Date.now() - itemStart,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[/api/generate] item "${itemName}" failed: ${msg.slice(0, 300)}`
        );
        results.push({
          itemName,
          success: false,
          skipped: false,
          costUsd: 0,
          error: msg.slice(0, 500),
          durationMs: Date.now() - itemStart,
        });
        // Continue with the next item — don't crash the whole batch.
      }
    }

    const summary: GenerateSummary = {
      totalItems: namesToProcess.length,
      success: results.filter((r) => r.success && !r.skipped).length,
      failed: results.filter((r) => !r.success).length,
      skipped: results.filter((r) => r.skipped).length,
      totalCostUsd: results.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
      results,
    };

    // Trim itemNames that weren't processed (so the client can resume)
    const remaining = itemNames.slice(namesToProcess.length);

    // Build a top-level error message when items failed — so the client
    // can display a helpful error instead of just "HTTP 200" (which happens
    // when success=false but no top-level error field is present).
    let topLevelError: string | undefined;
    if (summary.failed > 0) {
      const failedResults = results.filter((r) => !r.success);
      const firstError = failedResults[0]?.error ?? "Unknown error";
      if (summary.failed === summary.totalItems) {
        topLevelError = `All ${summary.totalItems} item(s) failed. First error: ${firstError.slice(0, 200)}`;
      } else {
        topLevelError = `${summary.failed} of ${summary.totalItems} item(s) failed. First error: ${firstError.slice(0, 200)}`;
      }
    }

    return NextResponse.json({
      success: summary.failed === 0,
      error: topLevelError,
      summary,
      remainingItems: remaining,
      batchDurationMs: Date.now() - startedAt,
      category: { slug: category.slug, name: category.name },
      quality,
      size,
      batchSize,
      resumeMode,
      providersTried: providers.map((p) => p.label),
    });
  } catch (err) {
    console.error("[/api/generate POST] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        batchDurationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
