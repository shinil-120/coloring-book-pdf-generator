import { NextRequest, NextResponse } from "next/server";
import {
  listCategories,
  createCategory,
  createItemsBulk,
  isTursoConfigured,
  ensureCategorySchema,
} from "@/lib/category-store";
import { slugify } from "@/lib/blob-storage";
import type { Palette } from "@/lib/coloring-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_THEME_COLORS = new Set([
  "emerald", "sky", "amber", "rose", "violet",
  "lime", "orange", "fuchsia", "indigo", "stone",
]);

interface CreateBody {
  name?: string;
  slug?: string;
  emoji?: string;
  themeColor?: string;
  description?: string;
  items?: { name: string; palette?: Palette | null }[];
}

/**
 * GET /api/categories
 *
 * Lists all categories (built-in + custom) with their item counts.
 * Returns 200 with an empty list if Turso is not configured.
 */
export async function GET() {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json({
        success: true,
        categories: [],
        source: "none",
        message: "Turso not configured — set TURSO_DATABASE_URL",
      });
    }
    await ensureCategorySchema();
    const categories = await listCategories();
    return NextResponse.json({ success: true, categories, source: "turso" });
  } catch (err) {
    console.error("[/api/categories GET] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories
 *
 * Creates a new custom category. Auto-derives slug from name if not provided.
 * If `items` is provided, they are bulk-created via createItemsBulk().
 *
 * Body:
 *   name        string  — required
 *   slug        string  — optional (auto-derived from name if missing)
 *   emoji       string  — required (e.g. "🦕")
 *   themeColor  string  — required (one of VALID_THEME_COLORS)
 *   description string  — optional
 *   items       {name, palette?}[] — optional bulk items
 */
export async function POST(req: NextRequest) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured — set TURSO_DATABASE_URL" },
        { status: 503 }
      );
    }

    const body = (await req.json()) as CreateBody;
    const name = (body?.name ?? "").trim();
    const emoji = (body?.emoji ?? "").trim();
    const themeColor = (body?.themeColor ?? "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      );
    }
    if (!emoji) {
      return NextResponse.json(
        { success: false, error: "emoji is required" },
        { status: 400 }
      );
    }
    if (!VALID_THEME_COLORS.has(themeColor)) {
      return NextResponse.json(
        {
          success: false,
          error: `themeColor must be one of: ${[...VALID_THEME_COLORS].join(", ")}`,
        },
        { status: 400 }
      );
    }

    const slug = (body.slug ?? slugify(name)).trim();
    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Could not derive slug from name" },
        { status: 400 }
      );
    }

    await ensureCategorySchema();

    const category = await createCategory({
      name,
      slug,
      emoji,
      themeColor,
      description: body.description ?? "",
      isBuiltin: false,
    });

    // Bulk-create items if provided
    let itemsCreated = 0;
    if (Array.isArray(body.items) && body.items.length > 0) {
      itemsCreated = await createItemsBulk(
        category.id,
        body.items.map((it) => ({
          name: it.name,
          palette: it.palette ?? null,
        }))
      );
    }

    return NextResponse.json(
      {
        success: true,
        category,
        itemsCreated,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[/api/categories POST] error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    // Libsql UNIQUE constraint violation
    if (/UNIQUE constraint/i.test(msg)) {
      return NextResponse.json(
        { success: false, error: "A category with that slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
