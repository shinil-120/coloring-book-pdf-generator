import { NextRequest, NextResponse } from "next/server";
import { getProvider, isTursoConfigured } from "@/lib/provider-store";
import { createProviderInstance } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/providers/[id]/test
 *
 * Tests whether a provider's API key works by making a lightweight API call.
 *
 * For OpenAI: calls /v1/models (free, no image generation)
 * For Z.AI: returns success (the SDK auto-authenticates; we can't test without
 *           generating an image, which would cost a credit)
 * For DeepInfra: calls /v1/models (free)
 * For others: returns success with "test not implemented" message
 *
 * Returns:
 *   {
 *     success: boolean,
 *     tested: boolean,         // true = actually tested, false = skipped
 *     envVarSet: boolean,      // true = the env var has a value
 *     message: string,
 *   }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json({
        success: false,
        error: "Turso not configured — set TURSO_DATABASE_URL",
      }, { status: 503 });
    }

    const { id } = await params;
    const provider = await getProvider(id);

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: "Provider not found",
      }, { status: 404 });
    }

    // Check if the env var is set
    const envVarSet = !!process.env[provider.apiKeyEnv] || provider.type === "zai";

    if (!envVarSet) {
      return NextResponse.json({
        success: true,
        tested: false,
        envVarSet: false,
        message: `Env var "${provider.apiKeyEnv}" is not set. Add it to Vercel → Settings → Environment Variables, then redeploy.`,
      });
    }

    // Create provider instance and test it
    const instance = createProviderInstance({
      type: provider.type,
      label: provider.label,
      apiKeyEnv: provider.apiKeyEnv,
      model: provider.model,
    });

    // If the provider has a test() method, use it
    if (instance.test) {
      const ok = await instance.test();
      return NextResponse.json({
        success: true,
        tested: true,
        envVarSet: true,
        message: ok
          ? `✓ ${provider.label}: API key is valid`
          : `✗ ${provider.label}: API key test failed`,
      });
    }

    // For providers without a test() method (Z.AI, DeepInfra, fal, Together, Replicate, Cloudflare)
    // We can't test without generating an image (which would cost money).
    // Return success with "test not implemented" message.
    return NextResponse.json({
      success: true,
      tested: false,
      envVarSet: true,
      message: `✓ ${provider.label}: env var "${provider.apiKeyEnv}" is set. Will verify on first image generation.`,
    });
  } catch (err) {
    console.error("[/api/providers/[id]/test POST] error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}
