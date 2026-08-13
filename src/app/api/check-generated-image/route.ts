import { NextRequest, NextResponse } from "next/server";
import { coloringPageExists } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/check-generated-image?categorySlug=Bugs&itemName=Ant
 *
 * Checks if an API-generated image already exists for a specific item.
 * Used by the Generator UI to:
 *   1. Show a "✓ generated" badge next to items with existing API images
 *   2. Exclude those items from the cost estimate (since they'll be
 *      skipped in resumeMode — no re-generation, no charge)
 *
 * Returns:
 *   { success: boolean, exists: boolean, sizeBytes: number }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const categorySlug = url.searchParams.get("categorySlug") ?? "";
    const itemName = url.searchParams.get("itemName") ?? "";

    if (!categorySlug || !itemName) {
      return NextResponse.json(
        { success: false, error: "categorySlug and itemName are required" },
        { status: 400 }
      );
    }

    const result = await coloringPageExists(categorySlug, itemName);

    return NextResponse.json({
      success: true,
      exists: result.exists,
      sizeBytes: result.sizeBytes,
    });
  } catch (err) {
    console.error("[/api/check-generated-image GET] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
