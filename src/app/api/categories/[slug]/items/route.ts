import { NextRequest, NextResponse } from "next/server";
import {
  getCategory,
  listItems,
  createItem,
  createItemsBulk,
  isTursoConfigured,
} from "@/lib/category-store";
import type { Palette } from "@/lib/coloring-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/categories/[slug]/items?includeDeleted=1
 *
 * Lists items in a category, sorted by sortOrder then name.
 * By default excludes soft-deleted items; pass ?includeDeleted=1 to see all.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured" },
        { status: 503 }
      );
    }
    const { slug } = await params;
    const category = await getCategory(slug);
    if (!category) {
      return NextResponse.json(
        { success: false, error: `Category "${slug}" not found` },
        { status: 404 }
      );
    }

    const includeDeleted = req.nextUrl.searchParams.get("includeDeleted") === "1";
    const items = await listItems(category.id, includeDeleted);
    return NextResponse.json({
      success: true,
      category,
      items,
      count: items.length,
      includeDeleted,
    });
  } catch (err) {
    console.error("[/api/categories/[slug]/items GET] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

interface AddItemBody {
  name?: string;
  palette?: Palette | null;
}

interface BulkItemsBody {
  items?: { name: string; palette?: Palette | null }[];
}

/**
 * POST /api/categories/[slug]/items
 *
 * Two modes:
 *   1) Single:    { name, palette? }              — adds one item
 *   2) Bulk:      { items: [{name, palette?}, …] } — adds many
 *
 * Single-item requests auto-assign the next sortOrder (= max(sortOrder)+1).
 * Bulk requests assign sortOrder = index in the input array (0-based).
 *
 * Returns the new item (single mode) or count (bulk mode).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured" },
        { status: 503 }
      );
    }
    const { slug } = await params;
    const category = await getCategory(slug);
    if (!category) {
      return NextResponse.json(
        { success: false, error: `Category "${slug}" not found` },
        { status: 404 }
      );
    }

    const body = (await req.json()) as AddItemBody & BulkItemsBody;

    // ── Bulk mode ─────────────────────────────────────────────────────────
    if (Array.isArray(body.items) && body.items.length > 0) {
      const cleaned = body.items
        .map((it) => ({ name: (it?.name ?? "").trim(), palette: it?.palette ?? null }))
        .filter((it) => it.name.length > 0);
      if (cleaned.length === 0) {
        return NextResponse.json(
          { success: false, error: "No valid items provided" },
          { status: 400 }
        );
      }
      const inserted = await createItemsBulk(category.id, cleaned);
      // Return the freshly inserted items + any existing items (re-read)
      const items = await listItems(category.id, false);
      return NextResponse.json(
        {
          success: true,
          itemsCreated: inserted,
          items,
        },
        { status: 201 }
      );
    }

    // ── Single mode ───────────────────────────────────────────────────────
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      );
    }

    // Determine next sortOrder (max + 1) — single query for accuracy
    const existing = await listItems(category.id, false);
    const nextSortOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((it) => it.sortOrder)) + 1;

    const item = await createItem({
      categoryId: category.id,
      name,
      sortOrder: nextSortOrder,
      palette: body.palette ?? null,
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err) {
    console.error("[/api/categories/[slug]/items POST] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
