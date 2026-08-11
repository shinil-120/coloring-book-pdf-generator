import { NextRequest, NextResponse } from "next/server";
import {
  getCategory,
  updateCategory,
  deleteCategory,
  listItems,
  isTursoConfigured,
} from "@/lib/category-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_THEME_COLORS = new Set([
  "emerald", "sky", "amber", "rose", "violet",
  "lime", "orange", "fuchsia", "indigo", "stone",
]);

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/categories/[slug]
 *
 * Returns a single category + its items (excluding soft-deleted).
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
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
    const items = await listItems(category.id, false);
    return NextResponse.json({ success: true, category, items });
  } catch (err) {
    console.error("[/api/categories/[slug] GET] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

interface PatchBody {
  name?: string;
  emoji?: string;
  themeColor?: string;
  description?: string;
}

/**
 * PATCH /api/categories/[slug]
 *
 * Updates a category's editable fields. Builtin categories CAN be edited
 * (the user may want to rename or recolor one), but the slug cannot be
 * changed.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

    const body = (await req.json()) as PatchBody;
    const updates: PatchBody = {};

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
    if (body.emoji !== undefined) {
      const emoji = body.emoji.trim();
      if (!emoji) {
        return NextResponse.json(
          { success: false, error: "emoji cannot be empty" },
          { status: 400 }
        );
      }
      updates.emoji = emoji;
    }
    if (body.themeColor !== undefined) {
      if (!VALID_THEME_COLORS.has(body.themeColor)) {
        return NextResponse.json(
          {
            success: false,
            error: `themeColor must be one of: ${[...VALID_THEME_COLORS].join(", ")}`,
          },
          { status: 400 }
        );
      }
      updates.themeColor = body.themeColor;
    }
    if (body.description !== undefined) {
      updates.description = body.description;
    }

    const updated = await updateCategory(category.id, updates);
    return NextResponse.json({ success: true, category: updated });
  } catch (err) {
    console.error("[/api/categories/[slug] PATCH] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[slug]
 *
 * Deletes a custom category and all its items.
 * Builtin categories CANNOT be deleted (returns 403).
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
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
    if (category.isBuiltin) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete builtin category "${category.name}". Edit or hide it instead.`,
        },
        { status: 403 }
      );
    }

    await deleteCategory(category.id);
    return NextResponse.json({
      success: true,
      message: `Category "${category.name}" deleted`,
    });
  } catch (err) {
    console.error("[/api/categories/[slug] DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
