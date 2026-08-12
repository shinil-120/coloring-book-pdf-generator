import { NextRequest, NextResponse } from "next/server";
import { runSeederBatched, type BatchedSeedResult } from "@/lib/seed-categories-data";
import { isTursoConfigured } from "@/lib/category-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/seed
 *
 * Seeds the configured Turso database with the 137 built-in coloring-book
 * categories (5,429 unique items) — in BATCHES.
 *
 * Why batched? Vercel's serverless functions have a 60s timeout. Seeding
 * all 137 categories × 40 items in one request would exceed the timeout
 * (Vercel returns an HTML error page, which breaks the JSON parser on the
 * client). Instead, each call seeds up to 20 categories (~3-4 seconds),
 * then returns `needsMore: true` so the client can loop.
 *
 * Body (optional):
 *   { batchSize?: number }  — default 20, max 50
 *
 * Returns:
 *   {
 *     success: boolean,
 *     categoriesSeededThisBatch: number,
 *     itemsSeededThisBatch: number,
 *     totalCategoriesInDB: number,   // running count across all batches
 *     totalItemsInDB: number,
 *     totalCategoriesExpected: number,  // 137
 *     needsMore: boolean,            // true = call again to continue
 *     durationMs: number,
 *     errors: string[],
 *   }
 *
 * The client should call this endpoint in a loop until needsMore === false,
 * updating a progress bar between calls.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Turso not configured. Add TURSO_DATABASE_URL + TURSO_AUTH_TOKEN to your Vercel env vars, then redeploy.",
        },
        { status: 503 }
      );
    }

    // Parse optional batchSize from body
    let batchSize = 20;
    try {
      const body = await req.json();
      if (typeof body?.batchSize === "number" && body.batchSize > 0 && body.batchSize <= 50) {
        batchSize = Math.floor(body.batchSize);
      }
    } catch {
      // Body is optional — use default batchSize
    }

    const result: BatchedSeedResult = await runSeederBatched(batchSize);

    const progressPercent = Math.round(
      (result.totalCategoriesInDB / result.totalCategoriesExpected) * 100
    );

    return NextResponse.json({
      success: result.success,
      categoriesSeededThisBatch: result.categoriesSeededThisBatch,
      itemsSeededThisBatch: result.itemsSeededThisBatch,
      failedThisBatch: result.failedThisBatch,
      errors: result.errors,
      totalCategoriesInDB: result.totalCategoriesInDB,
      totalItemsInDB: result.totalItemsInDB,
      totalCategoriesExpected: result.totalCategoriesExpected,
      needsMore: result.needsMore,
      progressPercent,
      durationMs: result.durationMs,
      message: result.needsMore
        ? `Seeded ${result.categoriesSeededThisBatch} categories (${result.totalCategoriesInDB}/${result.totalCategoriesExpected} total)`
        : result.totalCategoriesInDB === result.totalCategoriesExpected
          ? `✓ All ${result.totalCategoriesExpected} categories seeded! ${result.totalItemsInDB} items total.`
          : `Seeded ${result.categoriesSeededThisBatch} — ${result.totalCategoriesInDB}/${result.totalCategoriesExpected} total`,
    });
  } catch (err) {
    console.error("[/api/admin/seed POST] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/seed — returns the current seed status without seeding.
 */
export async function GET() {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: "Turso not configured — add TURSO_DATABASE_URL env var",
      });
    }

    const { listCategories } = await import("@/lib/category-store");
    const categories = await listCategories();
    const totalItems = categories.reduce((s, c) => s + c.itemCount, 0);

    return NextResponse.json({
      success: true,
      configured: true,
      categoryCount: categories.length,
      itemCount: totalItems,
      needsSeeding: categories.length === 0,
      expectedCategories: 137,
      progressPercent: Math.round((categories.length / 137) * 100),
      message:
        categories.length === 0
          ? "Database is empty — click Seed to populate 137 categories"
          : categories.length < 137
            ? `Partial: ${categories.length}/137 categories — click Seed to continue`
            : `Database has all ${categories.length} categories (${totalItems} items)`,
    });
  } catch (err) {
    console.error("[/api/admin/seed GET] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
