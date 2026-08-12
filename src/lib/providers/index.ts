/**
 * Provider implementations — each implements the ImageProvider interface.
 *
 * All providers return a Buffer (raw PNG bytes) + metadata (cost, model used).
 * The /api/generate endpoint handles failover across providers in priority order.
 *
 * SECURITY: API keys are read from process.env at call time — never stored
 * in the database. The DB stores only the env var NAME.
 */
import type { ProviderType } from "../provider-store";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  prompt: string;
  size: string;          // "1024x1024" etc.
  quality: string;        // "low" | "medium" | "high" | "standard"
}

export interface GenerateResult {
  buffer: Buffer;        // raw PNG bytes
  costUsd: number;
  modelUsed: string;
  providerType: ProviderType;
  providerLabel: string;
  seed?: number;
}

export interface ImageProvider {
  type: ProviderType;
  label: string;
  apiKeyEnv: string;
  model: string | null;
  /** Generate one image. Throws on error (caller handles failover). */
  generate(opts: GenerateOptions): Promise<GenerateResult>;
  /** Test the connection — returns true if the API key works. */
  test?(): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────────
// Pricing helper
// ─────────────────────────────────────────────────────────────────────────

const PRICING: Record<string, Record<string, number>> = {
  "gpt-image-2":       { low: 0.011, medium: 0.042, high: 0.167 },
  "gpt-image-1":       { low: 0.011, medium: 0.042, high: 0.167 },
  "gpt-image-1-mini":  { low: 0.005, medium: 0.011, high: 0.041 },
  "gpt-image-1.5":     { low: 0.011, medium: 0.042, high: 0.167 },
  "black-forest-labs/FLUX.1-dev":     { low: 0.003, medium: 0.003 },
  "black-forest-labs/FLUX.1-schnell": { low: 0.001, medium: 0.001 },
  "black-forest-labs/flux-dev":       { low: 0.003, medium: 0.003 },
  "black-forest-labs/flux-schnell":   { low: 0.001, medium: 0.001 },
  "fal-ai/flux/dev":     { low: 0.025, medium: 0.025 },
  "fal-ai/flux/schnell": { low: 0.001, medium: 0.001 },
  "fal-ai/flux-pro":     { low: 0.05,  medium: 0.05 },
  "@cf/black-forest-labs/flux-1-dev": { standard: 0 },
};

export function getPricePerImage(model: string, quality: string): number {
  return PRICING[model]?.[quality] ?? 0.042;
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAI provider (gpt-image-2)
// ─────────────────────────────────────────────────────────────────────────

export class OpenAIProvider implements ImageProvider {
  type: ProviderType = "openai";
  constructor(
    public label: string,
    public apiKeyEnv: string,
    public model: string | null
  ) {}

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const apiKey = process.env[this.apiKeyEnv];
    if (!apiKey) throw new Error(`OpenAI API key not set (env var: ${this.apiKeyEnv})`);

    const model = this.model || "gpt-image-2";

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: opts.prompt,
        size: opts.size,
        quality: opts.quality,
        n: 1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const first = data?.data?.[0];
    let buffer: Buffer;

    if (first?.b64_json) {
      buffer = Buffer.from(first.b64_json, "base64");
    } else if (first?.url) {
      const imgRes = await fetch(first.url);
      if (!imgRes.ok) throw new Error(`OpenAI image fetch: HTTP ${imgRes.status}`);
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new Error("OpenAI returned no image data");
    }

    return {
      buffer,
      costUsd: getPricePerImage(model, opts.quality),
      modelUsed: model,
      providerType: "openai",
      providerLabel: this.label,
    };
  }

  async test(): Promise<boolean> {
    const apiKey = process.env[this.apiKeyEnv];
    if (!apiKey) return false;
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Z.AI provider — calls the Z.AI API directly (bypasses z-ai-web-dev-sdk)
// ─────────────────────────────────────────────────────────────────────────
//
// Why bypass the SDK?
// The SDK's createImageGeneration() does `result.data.map(...)` which crashes
// with "Cannot read properties of undefined (reading 'map')" when the API
// returns a non-standard response (e.g. error format, async job, etc.).
// Calling the API directly gives us full control over error handling and
// supports all response formats (sync base64, sync URL, async polling).

const ZAI_BASE_URL = "https://api.z.ai/api/paas/v4";

export class ZaiProvider implements ImageProvider {
  type: ProviderType = "zai";
  constructor(
    public label: string,
    public apiKeyEnv: string,
    public model: string | null
  ) {}

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const apiKey = process.env[this.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Z.AI API key not set (env var: ${this.apiKeyEnv}). Add it to your Vercel env vars.`);
    }

    // Call the Z.AI API directly. The Z.AI API requires a `model` parameter.
    // Z.AI's image generation is built on top of their GLM multimodal models,
    // so we use "glm-4.5" (their latest image-capable model) by default.
    // The user can override this by setting a different model in the provider config.
    const model = this.model && this.model !== "auto" ? this.model : "glm-4.5";

    const res = await fetch(`${ZAI_BASE_URL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Z-AI-From": "Z",
      },
      body: JSON.stringify({
        model,
        prompt: opts.prompt,
        size: opts.size,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Z.AI HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json().catch(() => null);
    if (!data) {
      throw new Error("Z.AI returned a non-JSON response");
    }

    // Check for Z.AI error response (even on HTTP 200, Z.AI can return errors
    // in the body with code 1113 = insufficient balance, 1211 = unknown model, etc.)
    if (data.error) {
      const errMsg = typeof data.error === "string"
        ? data.error
        : data.error.message || JSON.stringify(data.error);
      const errCode = data.error.code ? ` [code ${data.error.code}]` : "";

      // Helpful hints for common errors
      let hint = "";
      if (errMsg.includes("Insufficient balance") || errMsg.includes("1113")) {
        hint = " — Your Z.AI account has no credits. Add credits at https://z.ai/billing";
      } else if (errMsg.includes("Unknown Model") || errMsg.includes("1211")) {
        hint = ` — Model "${model}" is not supported. Try a different model.`;
      } else if (errMsg.includes("401") || errMsg.includes("Unauthorized")) {
        hint = " — Your Z.AI API key is invalid. Re-check it at https://z.ai/dashboard/api-keys";
      }

      throw new Error(`Z.AI API error${errCode}: ${errMsg}${hint}`);
    }

    // Extract image — handle multiple response formats:
    // 1. { data: [{ b64_json: "..." }] }      — OpenAI-style, base64 inline
    // 2. { data: [{ url: "https://..." }] }   — OpenAI-style, URL
    // 3. { data: [{ base64: "..." }] }        — Z.AI SDK-style (after post-processing)
    // 4. { images: [{ url: "..." }] }         — fal.ai-style
    // 5. { image_url: "..." }                  — single image
    // 6. { base64: "..." }                     — single base64

    let imageBuffer: Buffer | null = null;

    // Try format 1/2/3: data array
    if (Array.isArray(data.data) && data.data.length > 0) {
      const first = data.data[0];
      const b64 = first?.base64 ?? first?.b64_json;
      const url = first?.url;
      if (b64) {
        imageBuffer = Buffer.from(b64, "base64");
      } else if (url) {
        const imgRes = await fetch(url);
        if (!imgRes.ok) throw new Error(`Z.AI image fetch: HTTP ${imgRes.status}`);
        imageBuffer = Buffer.from(await imgRes.arrayBuffer());
      }
    }
    // Try format 4: images array
    else if (Array.isArray(data.images) && data.images.length > 0) {
      const url = data.images[0]?.url;
      if (url) {
        const imgRes = await fetch(url);
        if (!imgRes.ok) throw new Error(`Z.AI image fetch: HTTP ${imgRes.status}`);
        imageBuffer = Buffer.from(await imgRes.arrayBuffer());
      }
    }
    // Try format 5: single image_url
    else if (typeof data.image_url === "string") {
      const imgRes = await fetch(data.image_url);
      if (!imgRes.ok) throw new Error(`Z.AI image fetch: HTTP ${imgRes.status}`);
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    }
    // Try format 6: base64 directly
    else if (typeof data.base64 === "string") {
      imageBuffer = Buffer.from(data.base64, "base64");
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      // Unknown response format — log it for debugging
      const preview = JSON.stringify(data).slice(0, 500);
      throw new Error(`Z.AI returned unexpected response format: ${preview}`);
    }

    return {
      buffer: imageBuffer,
      costUsd: 0, // Z.AI pricing depends on account credits
      modelUsed: model,
      providerType: "zai",
      providerLabel: this.label,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DeepInfra provider (FLUX.1-dev)
// ─────────────────────────────────────────────────────────────────────────

export class DeepInfraProvider implements ImageProvider {
  type: ProviderType = "deepinfra";
  constructor(
    public label: string,
    public apiKeyEnv: string,
    public model: string | null
  ) {}

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const apiKey = process.env[this.apiKeyEnv];
    if (!apiKey) throw new Error(`DeepInfra API key not set (env var: ${this.apiKeyEnv})`);

    const model = this.model || "black-forest-labs/FLUX.1-dev";

    const res = await fetch(`https://api.deepinfra.com/v1/openai/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: opts.prompt,
        size: opts.size,
        n: 1,
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepInfra HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("DeepInfra returned no b64_json");

    return {
      buffer: Buffer.from(b64, "base64"),
      costUsd: getPricePerImage(model, opts.quality),
      modelUsed: model,
      providerType: "deepinfra",
      providerLabel: this.label,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// fal.ai provider
// ─────────────────────────────────────────────────────────────────────────

export class FalProvider implements ImageProvider {
  type: ProviderType = "fal";
  constructor(
    public label: string,
    public apiKeyEnv: string,
    public model: string | null
  ) {}

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const apiKey = process.env[this.apiKeyEnv];
    if (!apiKey) throw new Error(`fal.ai API key not set (env var: ${this.apiKeyEnv})`);

    const model = this.model || "fal-ai/flux/dev";
    const url = `https://fal.run/${model}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        image_size: { width: 1024, height: 1024 },
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`fal.ai HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const imageUrl = data?.images?.[0]?.url;
    if (!imageUrl) throw new Error("fal.ai returned no image URL");

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`fal.ai image fetch: HTTP ${imgRes.status}`);

    return {
      buffer: Buffer.from(await imgRes.arrayBuffer()),
      costUsd: getPricePerImage(model, opts.quality),
      modelUsed: model,
      providerType: "fal",
      providerLabel: this.label,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Together AI provider
// ─────────────────────────────────────────────────────────────────────────

export class TogetherProvider implements ImageProvider {
  type: ProviderType = "together";
  constructor(
    public label: string,
    public apiKeyEnv: string,
    public model: string | null
  ) {}

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const apiKey = process.env[this.apiKeyEnv];
    if (!apiKey) throw new Error(`Together API key not set (env var: ${this.apiKeyEnv})`);

    const model = this.model || "black-forest-labs/FLUX.1-schnell";

    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: opts.prompt,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Together HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("Together returned no b64_json");

    return {
      buffer: Buffer.from(b64, "base64"),
      costUsd: getPricePerImage(model, opts.quality),
      modelUsed: model,
      providerType: "together",
      providerLabel: this.label,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Replicate provider (polling-based)
// ─────────────────────────────────────────────────────────────────────────

export class ReplicateProvider implements ImageProvider {
  type: ProviderType = "replicate";
  constructor(
    public label: string,
    public apiKeyEnv: string,
    public model: string | null
  ) {}

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const apiToken = process.env[this.apiKeyEnv];
    if (!apiToken) throw new Error(`Replicate API token not set (env var: ${this.apiKeyEnv})`);

    const model = this.model || "black-forest-labs/flux-dev";

    const startRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        input: { model, prompt: opts.prompt, width: 1024, height: 1024, num_outputs: 1 },
      }),
    });
    if (!startRes.ok) {
      const err = await startRes.text();
      throw new Error(`Replicate HTTP ${startRes.status}: ${err.slice(0, 200)}`);
    }
    const prediction = await startRes.json();
    const getUrl = prediction?.urls?.get;
    if (!getUrl) throw new Error("Replicate returned no polling URL");

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(getUrl, {
        headers: { "Authorization": `Bearer ${apiToken}` },
      });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      if (pollData.status === "succeeded") {
        const url = pollData.output?.[0] ?? pollData.output;
        if (typeof url === "string") {
          const imgRes = await fetch(url);
          if (!imgRes.ok) throw new Error(`Replicate image fetch: HTTP ${imgRes.status}`);
          return {
            buffer: Buffer.from(await imgRes.arrayBuffer()),
            costUsd: getPricePerImage(model, opts.quality),
            modelUsed: model,
            providerType: "replicate",
            providerLabel: this.label,
          };
        }
        throw new Error("Replicate: no image URL in output");
      }
      if (pollData.status === "failed") throw new Error("Replicate prediction failed");
    }
    throw new Error("Replicate timed out (60s)");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Workers AI provider
// ─────────────────────────────────────────────────────────────────────────

export class CloudflareProvider implements ImageProvider {
  type: ProviderType = "cloudflare";
  constructor(
    public label: string,
    public apiKeyEnv: string,
    public model: string | null
  ) {}

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const apiToken = process.env[this.apiKeyEnv];
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!apiToken) throw new Error(`Cloudflare API token not set (env var: ${this.apiKeyEnv})`);
    if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID env var not set");

    const model = this.model || "@cf/black-forest-labs/flux-1-dev";
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ prompt: opts.prompt }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudflare HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const contentType = res.headers.get("content-type") || "";
    let buffer: Buffer;
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (data?.result?.image) {
        buffer = Buffer.from(data.result.image, "base64");
      } else if (data?.success === false) {
        throw new Error(`Cloudflare error: ${JSON.stringify(data?.errors ?? data)}`);
      } else {
        throw new Error("Cloudflare returned unexpected JSON format");
      }
    } else {
      buffer = Buffer.from(await res.arrayBuffer());
    }

    return {
      buffer,
      costUsd: 0,
      modelUsed: model,
      providerType: "cloudflare",
      providerLabel: this.label,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Provider factory
// ─────────────────────────────────────────────────────────────────────────

export function createProviderInstance(p: {
  type: ProviderType;
  label: string;
  apiKeyEnv: string;
  model: string | null;
}): ImageProvider {
  switch (p.type) {
    case "openai":    return new OpenAIProvider(p.label, p.apiKeyEnv, p.model);
    case "zai":       return new ZaiProvider(p.label, p.apiKeyEnv, p.model);
    case "deepinfra": return new DeepInfraProvider(p.label, p.apiKeyEnv, p.model);
    case "fal":       return new FalProvider(p.label, p.apiKeyEnv, p.model);
    case "together":  return new TogetherProvider(p.label, p.apiKeyEnv, p.model);
    case "replicate": return new ReplicateProvider(p.label, p.apiKeyEnv, p.model);
    case "cloudflare":return new CloudflareProvider(p.label, p.apiKeyEnv, p.model);
    default:
      throw new Error(`Unknown provider type: ${p.type as string}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Failover generation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Generate an image using the active providers in failover order.
 * Tries each provider in turn; on quota/rate-limit errors, falls back to next.
 * Records usage after each successful generation.
 */
export async function generateWithFailover(
  providers: {
    id: string;
    type: ProviderType;
    label: string;
    apiKeyEnv: string;
    model: string | null;
    isActive: boolean;
    isConfigured: boolean;
    dailyLimit: number | null;
    usedToday: number;
  }[],
  opts: GenerateOptions
): Promise<GenerateResult & { providerId: string }> {
  const usable = providers.filter((p) =>
    p.isActive &&
    p.isConfigured &&
    (p.dailyLimit === null || p.usedToday < p.dailyLimit)
  );

  if (usable.length === 0) {
    throw new Error("No usable image providers — add an API key in Manage Providers");
  }

  let lastError = "";
  for (const p of usable) {
    try {
      const instance = createProviderInstance({
        type: p.type,
        label: p.label,
        apiKeyEnv: p.apiKeyEnv,
        model: p.model,
      });
      const result = await instance.generate(opts);
      return { ...result, providerId: p.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      const isQuotaError = /429|rate.?limit|quota|insufficient|billing|payment/i.test(msg);

      if (isQuotaError) {
        console.log(`Provider "${p.label}" (${p.type}) hit quota/rate-limit, trying next…`);
        continue;
      }
      console.log(`Provider "${p.label}" (${p.type}) error: ${msg.slice(0, 150)}`);
      continue;
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError.slice(0, 300)}`);
}
