import { NextRequest, NextResponse } from "next/server";
import { reorderItems, getCategory, isTursoConfigured } from "@/lib/category-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReorderBody {
  itemIds: string[];   // ordered list of item IDs (new sort order)
}

/**
 * POST /api/categories/[slug]/items/reorder
 *
 * Persists a new sort order for items within a category.
 * Body: { itemIds: string[] }  — the items in the desired new order.
 *
 * The frontend ItemEditorDialog supports drag-and-drop reordering via
 * @dnd-kit/sortable; this endpoint persists the result so the new order
 * survives page reloads.
 *
 * Items not present in `itemIds` retain their existing sortOrder (they
 * will sort after the explicitly-ordered items).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured — set TURSO_DATABASE_URL" },
        { status: 503 }
      );
    }

    const { slug } = await params;

    // Verify the category exists
    const category = await getCategory(slug);
    if (!category) {
      return NextResponse.json(
        { success: false, error: `Category "${slug}" not found` },
        { status: 404 }
      );
    }

    const body = (await req.json()) as ReorderBody;
    if (!body?.itemIds || !Array.isArray(body.itemIds)) {
      return NextResponse.json(
        { success: false, error: "itemIds must be an array of item IDs" },
        { status: 400 }
      );
    }

    if (body.itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "itemIds must contain at least one item ID" },
        { status: 400 }
      );
    }

    // Validate all IDs are strings
    const validIds = body.itemIds.every((id) => typeof id === "string" && id.length > 0);
    if (!validIds) {
      return NextResponse.json(
        { success: false, error: "All itemIds must be non-empty strings" },
        { status: 400 }
      );
    }

    // Persist the new order
    await reorderItems(category.id, body.itemIds);

    return NextResponse.json({
      success: true,
      message: `Reordered ${body.itemIds.length} items`,
      categorySlug: slug,
      orderedIds: body.itemIds,
    });
  } catch (err) {
    console.error("[/api/categories/[slug]/items/reorder POST] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
