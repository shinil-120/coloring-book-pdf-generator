import { NextRequest, NextResponse } from "next/server";
import {
  getCategory,
  getItem,
  updateItem,
  deleteItem,
  isTursoConfigured,
} from "@/lib/category-store";
import type { Palette } from "@/lib/coloring-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string; itemId: string }>;
}

interface PatchItemBody {
  name?: string;
  palette?: Palette | null;
}

/**
 * Helper: fetch category + item, return NextResponse error on miss.
 */
async function loadItem(slug: string, itemId: string) {
  const category = await getCategory(slug);
  if (!category) {
    return {
      error: NextResponse.json(
        { success: false, error: `Category "${slug}" not found` },
        { status: 404 }
      ),
    };
  }
  const item = await getItem(itemId);
  if (!item || item.categoryId !== category.id) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: `Item "${itemId}" not found in category "${slug}"`,
        },
        { status: 404 }
      ),
    };
  }
  return { category, item };
}

/**
 * PATCH /api/categories/[slug]/items/[itemId]
 *
 * Updates an item's name and/or palette.
 * Body: any subset of { name, palette }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured" },
        { status: 503 }
      );
    }
    const { slug, itemId } = await params;
    const loaded = await loadItem(slug, itemId);
    if ("error" in loaded) return loaded.error;

    const body = (await req.json()) as PatchItemBody;
    const updates: { name?: string; palette?: Palette | null } = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { success: false, error: "name cannot be empty" },
          { status: 400 }
        );
      }
      updates.name = name;
    }
    if (body.palette !== undefined) {
      updates.palette = body.palette;
    }

    const updated = await updateItem(itemId, updates);
    return NextResponse.json({ success: true, item: updated });
  } catch (err) {
    console.error("[/api/categories/[slug]/items/[itemId] PATCH] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[slug]/items/[itemId]
 *
 * Soft-deletes an item (builtin or custom). Returns 200.
 * Use the /restore endpoint to recover.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured" },
        { status: 503 }
      );
    }
    const { slug, itemId } = await params;
    const loaded = await loadItem(slug, itemId);
    if ("error" in loaded) return loaded.error;

    await deleteItem(itemId);
    return NextResponse.json({
      success: true,
      message: `Item "${loaded.item.name}" soft-deleted`,
      itemId,
    });
  } catch (err) {
    console.error("[/api/categories/[slug]/items/[itemId] DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
