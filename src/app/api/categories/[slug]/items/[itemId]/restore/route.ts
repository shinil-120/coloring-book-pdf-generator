import { NextRequest, NextResponse } from "next/server";
import {
  getCategory,
  getItem,
  restoreItem,
  isTursoConfigured,
} from "@/lib/category-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string; itemId: string }>;
}

/**
 * POST /api/categories/[slug]/items/[itemId]/restore
 *
 * Restores a previously soft-deleted item.
 * Returns the restored item.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured" },
        { status: 503 }
      );
    }
    const { slug, itemId } = await params;

    const category = await getCategory(slug);
    if (!category) {
      return NextResponse.json(
        { success: false, error: `Category "${slug}" not found` },
        { status: 404 }
      );
    }
    const item = await getItem(itemId);
    if (!item || item.categoryId !== category.id) {
      return NextResponse.json(
        {
          success: false,
          error: `Item "${itemId}" not found in category "${slug}"`,
        },
        { status: 404 }
      );
    }

    await restoreItem(itemId);
    const restored = await getItem(itemId);
    return NextResponse.json({
      success: true,
      message: `Item "${item.name}" restored`,
      item: restored,
    });
  } catch (err) {
    console.error("[/api/categories/[slug]/items/[itemId]/restore POST] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
