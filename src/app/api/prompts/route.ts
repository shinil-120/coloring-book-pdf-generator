import { NextRequest, NextResponse } from "next/server";
import { getCategory, listItems, isTursoConfigured } from "@/lib/category-store";
import { buildPrompt, FREE_AI_TOOLS } from "@/lib/prompt-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/prompts?categorySlug=Bugs&itemNames=Ant,Bee,Ladybug
 *
 * Returns the exact prompts used to generate coloring-book images for the
 * specified items. Users can copy these prompts into external AI tools
 * (ChatGPT free, Bing Image Creator, etc.) to generate images for free,
 * then upload them via /api/upload-coloring-image.
 *
 * If `itemNames` is omitted, returns prompts for ALL items in the category.
 *
 * Returns:
 *   {
 *     success: boolean,
 *     category: { slug, name, suffix },
 *     prompts: [{ itemName, prompt, suffix }],
 *     freeTools: [...]   // list of suggested free AI tools
 *   }
 */
export async function GET(req: NextRequest) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured — set TURSO_DATABASE_URL" },
        { status: 503 }
      );
    }

    const url = new URL(req.url);
    const categorySlug = url.searchParams.get("categorySlug") ?? "";
    const itemNamesParam = url.searchParams.get("itemNames") ?? "";

    if (!categorySlug) {
      return NextResponse.json(
        { success: false, error: "categorySlug query parameter is required" },
        { status: 400 }
      );
    }

    const category = await getCategory(categorySlug);
    if (!category) {
      return NextResponse.json(
        { success: false, error: `Category "${categorySlug}" not found` },
        { status: 404 }
      );
    }

    const allItems = await listItems(category.id, false);

    // Filter to requested items (or use all if no itemNames specified)
    let requestedNames: string[];
    if (itemNamesParam.trim()) {
      requestedNames = itemNamesParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else {
      requestedNames = allItems.map((i) => i.name);
    }

    // Validate item names exist in the category
    const knownNames = new Set(allItems.map((i) => i.name));
    const unknown = requestedNames.filter((n) => !knownNames.has(n));
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown items in category "${categorySlug}": ${unknown.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const prompts = requestedNames.map((itemName) => ({
      itemName,
      prompt: buildPrompt(itemName, category.name),
    }));

    return NextResponse.json({
      success: true,
      category: {
        slug: category.slug,
        name: category.name,
        emoji: category.emoji,
        suffix: category.name.toLowerCase(),
      },
      prompts,
      freeTools: FREE_AI_TOOLS,
      // Plain-text numbered format for "Copy All" / "Download as .txt"
      plaintext: prompts
        .map((p, i) => `${i + 1}. ${p.itemName}\n${p.prompt}`)
        .join("\n\n"),
    });
  } catch (err) {
    console.error("[/api/prompts GET] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
