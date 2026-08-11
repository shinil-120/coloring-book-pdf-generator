import { NextRequest, NextResponse } from "next/server";
import {
  listProviders,
  createProvider,
  PROVIDER_METADATA,
  isTursoConfigured,
  ensureProviderSchema,
  type ProviderType,
} from "@/lib/provider-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDER_TYPES = new Set(Object.keys(PROVIDER_METADATA)) as Set<ProviderType>;

interface CreateProviderBody {
  type?: string;
  label?: string;
  apiKeyEnv?: string;
  model?: string | null;
  dailyLimit?: number | null;
  isActive?: boolean;
}

/**
 * GET /api/providers
 *
 * Lists all configured providers (sorted by failover order) and includes the
 * static PROVIDER_METADATA map so the UI can render provider options without
 * a second round-trip.
 */
export async function GET() {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json({
        success: true,
        providers: [],
        metadata: PROVIDER_METADATA,
        source: "none",
        message: "Turso not configured — set TURSO_DATABASE_URL",
      });
    }
    await ensureProviderSchema();
    const providers = await listProviders();
    return NextResponse.json({
      success: true,
      providers,
      metadata: PROVIDER_METADATA,
      source: "turso",
    });
  } catch (err) {
    console.error("[/api/providers GET] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/providers
 *
 * Adds a new image-generation provider.
 *
 * Body:
 *   type        string  — one of: openai | zai | deepinfra | fal | together | replicate | cloudflare
 *   label       string  — user-friendly name (e.g. "OpenAI primary")
 *   apiKeyEnv   string  — NAME of env var (e.g. "OPENAI_API_KEY", "ZAI_API_KEY_2")
 *                         The user must also set the actual key in Vercel.
 *   model       string  — optional override (defaults to PROVIDER_METADATA[type].defaultModel)
 *   dailyLimit  number  — optional daily image cap (null = unlimited)
 *   isActive    boolean — optional (defaults to true)
 *
 * Returns the new provider (201).
 */
export async function POST(req: NextRequest) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured — set TURSO_DATABASE_URL" },
        { status: 503 }
      );
    }

    const body = (await req.json()) as CreateProviderBody;
    const type = (body.type ?? "").trim() as ProviderType;
    const label = (body.label ?? "").trim();
    const apiKeyEnv = (body.apiKeyEnv ?? "").trim();

    if (!VALID_PROVIDER_TYPES.has(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `type must be one of: ${[...VALID_PROVIDER_TYPES].join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (!label) {
      return NextResponse.json(
        { success: false, error: "label is required" },
        { status: 400 }
      );
    }
    if (!apiKeyEnv) {
      return NextResponse.json(
        { success: false, error: "apiKeyEnv is required (e.g. OPENAI_API_KEY)" },
        { status: 400 }
      );
    }
    // Validate env var name format (letters, digits, underscores)
    if (!/^[A-Z][A-Z0-9_]*$/i.test(apiKeyEnv)) {
      return NextResponse.json(
        {
          success: false,
          error: "apiKeyEnv must be a valid env var name (letters, digits, underscores)",
        },
        { status: 400 }
      );
    }

    // Validate model against the provider's supported list (if provided)
    if (body.model) {
      const meta = PROVIDER_METADATA[type];
      if (
        meta.supportedModels.length > 0 &&
        !meta.supportedModels.some((m) => m.id === body.model)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `model "${body.model}" is not supported by ${meta.name}. Supported: ${meta.supportedModels.map((m) => m.id).join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate dailyLimit
    let dailyLimit: number | null = null;
    if (body.dailyLimit !== undefined && body.dailyLimit !== null) {
      const n = Number(body.dailyLimit);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return NextResponse.json(
          { success: false, error: "dailyLimit must be a non-negative integer (or null)" },
          { status: 400 }
        );
      }
      dailyLimit = n;
    }

    await ensureProviderSchema();

    const provider = await createProvider({
      type,
      label,
      apiKeyEnv,
      model: body.model ?? null,
      dailyLimit,
      isActive: body.isActive !== false,
    });

    return NextResponse.json(
      {
        success: true,
        provider,
        // Helpful hint for the client
        keyIsSet: !!process.env[apiKeyEnv],
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[/api/providers POST] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
