import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────
// Supported sizes by the z-ai-web-dev-sdk image generation endpoint
// ─────────────────────────────────────────────────────────────────────────
const SUPPORTED_SIZES = [
  "1024x1024", // Square (default — matches coloring-book quality)
  "768x1344",  // Portrait
  "864x1152",  // Portrait
  "1344x768",  // Landscape
  "1152x864",  // Landscape
  "1440x720",  // Wide landscape
  "720x1440",  // Tall portrait
] as const;
type ImageSize = (typeof SUPPORTED_SIZES)[number];

// Curated style presets that produce consistently high-quality results
// matching the look & feel of the existing coloring-book images.
const STYLE_PRESETS: Record<string, { label: string; suffix: string }> = {
  auto: { label: "Auto", suffix: "" },
  realistic: {
    label: "Realistic Photo",
    suffix:
      ", photorealistic, professional photography, ultra detailed, soft natural lighting, 50mm lens, high dynamic range, sharp focus, 8k",
  },
  digital_art: {
    label: "Digital Art",
    suffix:
      ", digital painting, concept art, trending on artstation, intricate details, vibrant colors, dramatic lighting, matte painting",
  },
  anime: {
    label: "Anime",
    suffix:
      ", anime style, cel shading, clean line art, vibrant colors, studio ghibli inspired, highly detailed, beautiful composition",
  },
  oil: {
    label: "Oil Painting",
    suffix:
      ", oil painting, thick brush strokes, classical art style, rich textures, warm palette, museum quality, masterpiece",
  },
  watercolor: {
    label: "Watercolor",
    suffix:
      ", watercolor painting, soft washes, wet-on-wet technique, delicate color bleeds, paper texture, hand-painted, artistic",
  },
  "3d": {
    label: "3D Render",
    suffix:
      ", 3d render, octane render, blender, cinema4d, physically based rendering, ray tracing, hyperrealistic materials, studio lighting",
  },
  minimalist: {
    label: "Minimalist",
    suffix:
      ", minimalist design, flat illustration, limited color palette, geometric shapes, negative space, modern, elegant",
  },
  coloring: {
    label: "Coloring Page",
    suffix:
      ", black and white line drawing, simple clean outline, no shading, no gray tones, thick black lines on white background, suitable for children coloring book, cartoon style, single subject centered",
  },
  fantasy: {
    label: "Fantasy Art",
    suffix:
      ", fantasy art, epic, magical atmosphere, dramatic lighting, intricate details, mystical, cinematic, highly detailed",
  },
  cyberpunk: {
    label: "Cyberpunk",
    suffix:
      ", cyberpunk, neon lights, futuristic city, blade runner aesthetic, rain-soaked streets, glowing signs, atmospheric, cinematic",
  },
};

interface GenerateBody {
  prompt: string;
  size?: ImageSize;
  style?: keyof typeof STYLE_PRESETS;
  negativePrompt?: string;
  enhance?: boolean;
}

/**
 * POST /api/generate-image
 *
 * Generates an AI image using the z-ai-web-dev-sdk — the same SDK & quality
 * profile used for the coloring-book images (1024x1024 default).
 *
 * Body:
 *   prompt:        string  — required, the text-to-image prompt
 *   size:          string  — one of SUPPORTED_SIZES (default 1024x1024)
 *   style:         string  — preset key (default "auto")
 *   negativePrompt: string — appended as an "avoid" clause
 *   enhance:       boolean — if true, prepends a "high quality" booster
 *
 * Returns:
 *   { success: true, image: data-uri, prompt, size, style, seed }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateBody;
    const rawPrompt = (body?.prompt ?? "").trim();

    if (!rawPrompt) {
      return NextResponse.json(
        { success: false, error: "Prompt is required." },
        { status: 400 }
      );
    }
    if (rawPrompt.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Prompt must be 2000 characters or fewer." },
        { status: 400 }
      );
    }

    const size: ImageSize = (SUPPORTED_SIZES as readonly string[]).includes(
      body.size ?? ""
    )
      ? (body.size as ImageSize)
      : "1024x1024";

    const styleKey =
      body.style && STYLE_PRESETS[body.style] ? body.style : "auto";
    const stylePreset = STYLE_PRESETS[styleKey];

    // Build the final prompt — matches the coloring-book quality boosters
    // (high quality, detailed, etc.) while preserving the user's wording.
    // For the "coloring" style we PREPEND the line-art instructions so they
    // take priority over any descriptive scene language in the user prompt.
    const parts: string[] = [];
    if (body.enhance && styleKey !== "coloring") {
      parts.push("masterpiece", "best quality", "ultra detailed");
    }
    if (styleKey === "coloring") {
      parts.push(
        "Black and white line drawing coloring page for kids of",
        rawPrompt,
        ". Simple clean outline, no shading, no gray tones, no color, thick black lines on white background, suitable for children coloring book, cartoon style, cute and friendly, single subject centered on page"
      );
    } else {
      parts.push(rawPrompt);
      parts.push(stylePreset.suffix);
    }
    if (body.negativePrompt && body.negativePrompt.trim()) {
      parts.push(`avoid: ${body.negativePrompt.trim()}`);
    }
    const finalPrompt = parts.filter(Boolean).join(", ");

    // Lazy-import so we don't pull the SDK into the client bundle.
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const response = await zai.images.generations.create({
      prompt: finalPrompt,
      size,
    });

    // The SDK returns base64 (preferred) or a URL (fallback). Handle both.
    const first = response?.data?.[0];
    const b64 =
      (first as { base64?: string } | undefined)?.base64 ??
      (first as { b64_json?: string } | undefined)?.b64_json;
    const url = (first as { url?: string } | undefined)?.url;

    let imageBuffer: Buffer | null = null;
    if (b64) {
      imageBuffer = Buffer.from(b64, "base64");
    } else if (url) {
      const imgRes = await fetch(url);
      if (!imgRes.ok) {
        throw new Error(`Image URL fetch failed: HTTP ${imgRes.status}`);
      }
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("The image generation API returned no image data.");
    }

    const dataUri = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    // Pseudo-random seed so the client can display it (the SDK doesn't expose one).
    const seed = Math.floor(Math.random() * 1_000_000);

    return NextResponse.json({
      success: true,
      image: dataUri,
      prompt: rawPrompt,
      finalPrompt,
      size,
      style: styleKey,
      styleLabel: stylePreset.label,
      seed,
      bytes: imageBuffer.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/generate-image] error:", msg);

    // Rate-limit / quota errors → 429 so the client can show a retry hint
    const status = /429|rate.?limit|quota|insufficient/i.test(msg) ? 429 : 500;

    return NextResponse.json(
      { success: false, error: msg.slice(0, 500) },
      { status }
    );
  }
}

/**
 * GET /api/generate-image — metadata endpoint.
 * Returns supported sizes and style presets so the client can build its UI
 * dynamically without hardcoding them.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    sizes: SUPPORTED_SIZES,
    defaultSize: "1024x1024",
    styles: Object.entries(STYLE_PRESETS).map(([key, v]) => ({
      key,
      label: v.label,
    })),
  });
}
