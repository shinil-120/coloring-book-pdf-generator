import { NextRequest, NextResponse } from "next/server";
import { runSeeder } from "@/lib/seed-categories-data";
import { isTursoConfigured } from "@/lib/category-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/seed
 *
 * Seeds the configured Turso database with the 137 built-in coloring-book
 * categories (5,429 unique items). Idempotent & resumable.
 *
 * This endpoint exists so users can seed their PRODUCTION Turso database
 * from any browser (including a phone) without needing to run the CLI
 * script locally. After deploying to Vercel + adding Turso credentials
 * as env vars, the user visits the deployed site, opens Manage Categories,
 * clicks "Seed Database", and this endpoint does the rest.
 *
 * Returns:
 *   {
 *     success: boolean,
 *     alreadySeeded: boolean,
 *     totalCategories: number,
 *     totalItems: number,
 *     skipped: number,
 *     failed: number,
 *     errors: string[],
 *     durationMs: number,
 *   }
 *
 * Security note: this endpoint is unauthenticated. For production apps with
 * multiple users, add authentication (e.g. NextAuth) before enabling. For
 * a single-user deployment, the endpoint is safe — it only inserts built-in
 * data that's already public in the source code.
 */
export async function POST(_req: NextRequest) {
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

    const result = await runSeeder();

    return NextResponse.json({
      success: result.success,
      alreadySeeded: result.alreadySeeded,
      totalCategories: result.totalCategories,
      totalItems: result.totalItems,
      skipped: result.skipped,
      failed: result.failed,
      errors: result.errors,
      durationMs: result.durationMs,
      message: result.alreadySeeded
        ? `All ${result.totalCategories} categories already present — no changes made.`
        : result.failed > 0
          ? `Seeded ${result.totalCategories} categories (${result.failed} failed)`
          : `✓ Seeded ${result.totalCategories} categories with ${result.totalItems} items in ${(result.durationMs / 1000).toFixed(1)}s`,
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
 * Useful for checking if the DB needs seeding before showing the button.
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

    // Dynamic import to avoid circular dependency at module load
    const { listCategories } = await import("@/lib/category-store");
    const categories = await listCategories();

    return NextResponse.json({
      success: true,
      configured: true,
      categoryCount: categories.length,
      needsSeeding: categories.length === 0,
      message:
        categories.length === 0
          ? "Database is empty — click Seed to populate 137 categories"
          : `Database has ${categories.length} categories`,
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
