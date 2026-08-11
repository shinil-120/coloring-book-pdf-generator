import { NextRequest, NextResponse } from "next/server";
import {
  reorderProviders,
  listProviders,
  isTursoConfigured,
} from "@/lib/provider-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReorderBody {
  orderedIds?: string[];
}

/**
 * POST /api/providers/reorder
 *
 * Body: { orderedIds: string[] }
 *
 * Updates the `failoverOrder` field on each provider to match the supplied
 * array order. Useful for drag-and-drop reordering in the UI.
 *
 * Returns the providers in the new order.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured" },
        { status: 503 }
      );
    }

    const body = (await req.json()) as ReorderBody;
    if (!Array.isArray(body.orderedIds)) {
      return NextResponse.json(
        { success: false, error: "orderedIds must be an array of provider IDs" },
        { status: 400 }
      );
    }
    if (body.orderedIds.some((id) => typeof id !== "string" || !id.trim())) {
      return NextResponse.json(
        { success: false, error: "orderedIds must contain only non-empty strings" },
        { status: 400 }
      );
    }

    // Validate that all IDs exist (and warn about missing ones)
    const all = await listProviders();
    const allIds = new Set(all.map((p) => p.id));
    const unknown = body.orderedIds.filter((id) => !allIds.has(id));
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown provider IDs: ${unknown.join(", ")}`,
        },
        { status: 400 }
      );
    }

    await reorderProviders(body.orderedIds);
    const providers = await listProviders(); // re-read in new order

    return NextResponse.json({
      success: true,
      providers,
      message: `Reordered ${body.orderedIds.length} providers`,
    });
  } catch (err) {
    console.error("[/api/providers/reorder POST] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
