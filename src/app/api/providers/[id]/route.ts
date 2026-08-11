import { NextRequest, NextResponse } from "next/server";
import {
  getProvider,
  updateProvider,
  deleteProvider,
  isTursoConfigured,
} from "@/lib/provider-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PatchProviderBody {
  label?: string;
  apiKeyEnv?: string;
  model?: string | null;
  dailyLimit?: number | null;
  isActive?: boolean;
  failoverOrder?: number;
}

/**
 * GET /api/providers/[id]
 *
 * Returns a single provider by ID.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured" },
        { status: 503 }
      );
    }
    const { id } = await params;
    const provider = await getProvider(id);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: `Provider "${id}" not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, provider });
  } catch (err) {
    console.error("[/api/providers/[id] GET] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/providers/[id]
 *
 * Updates a provider's editable fields (label, model, dailyLimit, isActive,
 * failoverOrder, apiKeyEnv).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured" },
        { status: 503 }
      );
    }
    const { id } = await params;
    const existing = await getProvider(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Provider "${id}" not found` },
        { status: 404 }
      );
    }

    const body = (await req.json()) as PatchProviderBody;
    const updates: PatchProviderBody = {};

    if (body.label !== undefined) {
      const label = body.label.trim();
      if (!label) {
        return NextResponse.json(
          { success: false, error: "label cannot be empty" },
          { status: 400 }
        );
      }
      updates.label = label;
    }
    if (body.apiKeyEnv !== undefined) {
      const env = body.apiKeyEnv.trim();
      if (!env) {
        return NextResponse.json(
          { success: false, error: "apiKeyEnv cannot be empty" },
          { status: 400 }
        );
      }
      if (!/^[A-Z][A-Z0-9_]*$/i.test(env)) {
        return NextResponse.json(
          { success: false, error: "apiKeyEnv must be a valid env var name" },
          { status: 400 }
        );
      }
      updates.apiKeyEnv = env;
    }
    if (body.model !== undefined) {
      updates.model = body.model;
    }
    if (body.dailyLimit !== undefined) {
      if (body.dailyLimit === null) {
        updates.dailyLimit = null;
      } else {
        const n = Number(body.dailyLimit);
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
          return NextResponse.json(
            { success: false, error: "dailyLimit must be a non-negative integer (or null)" },
            { status: 400 }
          );
        }
        updates.dailyLimit = n;
      }
    }
    if (body.isActive !== undefined) {
      updates.isActive = !!body.isActive;
    }
    if (body.failoverOrder !== undefined) {
      const n = Number(body.failoverOrder);
      if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
        return NextResponse.json(
          { success: false, error: "failoverOrder must be a positive integer" },
          { status: 400 }
        );
      }
      updates.failoverOrder = n;
    }

    const updated = await updateProvider(id, updates);
    return NextResponse.json({ success: true, provider: updated });
  } catch (err) {
    console.error("[/api/providers/[id] PATCH] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/providers/[id]
 *
 * Deletes a provider AND all its historical usage rows.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured" },
        { status: 503 }
      );
    }
    const { id } = await params;
    const existing = await getProvider(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Provider "${id}" not found` },
        { status: 404 }
      );
    }
    await deleteProvider(id);
    return NextResponse.json({
      success: true,
      message: `Provider "${existing.label}" deleted`,
    });
  } catch (err) {
    console.error("[/api/providers/[id] DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
