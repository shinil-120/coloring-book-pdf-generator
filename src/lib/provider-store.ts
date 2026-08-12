/**
 * Provider data access layer (Turso-backed).
 *
 * Stores user-configured image generation providers (OpenAI, Z.AI multi-account,
 * DeepInfra, fal.ai, Together, Replicate, Cloudflare). Each provider has:
 *   - type (openai | zai | deepinfra | fal | together | replicate | cloudflare)
 *   - label (user-friendly name)
 *   - api_key_env (name of env var holding the actual key — never the key itself)
 *   - model (optional model name)
 *   - daily_limit (optional cap)
 *   - failover_order (priority — lower numbers tried first)
 *   - is_active (1 = enabled, 0 = disabled)
 *
 * Usage tracking per provider per day is stored in `provider_usage`.
 *
 * Tables:
 *   providers(id, type, label, apiKeyEnv, model, dailyLimit, isActive,
 *             failoverOrder, createdAt, updatedAt)
 *   provider_usage(id, providerId, usedDate, imageCount, costUsd)
 *
 * Security: API keys are NEVER stored in Turso. Only the ENV VAR NAME is
 * stored. The actual key lives in Vercel env vars (encrypted at rest).
 */
import { turso, isTursoConfigured } from "./turso";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type ProviderType =
  | "openai"
  | "zai"
  | "deepinfra"
  | "fal"
  | "together"
  | "replicate"
  | "cloudflare";

export interface Provider {
  id: string;
  type: ProviderType;
  label: string;
  apiKeyEnv: string;         // e.g. "OPENAI_API_KEY" or "ZAI_API_KEY_2"
  model: string | null;      // e.g. "gpt-image-2" or null for default
  dailyLimit: number | null; // null = unlimited
  isActive: boolean;
  failoverOrder: number;     // 1 = first, 2 = second, etc.
  createdAt: string;
  updatedAt: string;
  // Computed (not stored):
  isConfigured: boolean;     // true if env var has a value
  usedToday: number;         // images generated today
  spentToday: number;        // USD spent today
}

export interface ProviderUsage {
  id: string;
  providerId: string;
  usedDate: string;          // YYYY-MM-DD
  imageCount: number;
  costUsd: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Provider metadata (display info, supported options, pricing)
// ─────────────────────────────────────────────────────────────────────────

export interface ProviderMetadata {
  type: ProviderType;
  name: string;              // "OpenAI"
  description: string;       // "gpt-image-2 — high quality"
  emoji: string;
  defaultModel: string;
  supportedModels: { id: string; label: string; pricePerImage: Record<string, number> }[];
  supportedQualities: string[];
  defaultQuality: string;
  supportedSizes: string[];
  defaultSize: string;
  needsApiKey: boolean;      // Z.AI in sandbox = false
  signupUrl: string;
  pricingUrl: string;
}

export const PROVIDER_METADATA: Record<ProviderType, ProviderMetadata> = {
  openai: {
    type: "openai",
    name: "OpenAI",
    description: "gpt-image-2 — best prompt adherence",
    emoji: "🟢",
    defaultModel: "gpt-image-2",
    supportedModels: [
      { id: "gpt-image-2", label: "GPT Image 2 (latest)", pricePerImage: { low: 0.011, medium: 0.042, high: 0.167 } },
      { id: "gpt-image-1", label: "GPT Image 1", pricePerImage: { low: 0.011, medium: 0.042, high: 0.167 } },
      { id: "gpt-image-1-mini", label: "GPT Image 1 Mini (cheapest)", pricePerImage: { low: 0.005, medium: 0.011, high: 0.041 } },
    ],
    supportedQualities: ["low", "medium", "high"],
    defaultQuality: "medium",
    supportedSizes: ["1024x1024", "1024x1536", "1536x1024"],
    defaultSize: "1024x1024",
    needsApiKey: true,
    signupUrl: "https://platform.openai.com/api-keys",
    pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  zai: {
    type: "zai",
    name: "Z.AI",
    description: "z-ai-web-dev-sdk — FLUX.1-dev quality, free tier",
    emoji: "🟣",
    defaultModel: "auto",
    supportedModels: [
      { id: "auto", label: "Auto (recommended)", pricePerImage: { standard: 0 } },
    ],
    supportedQualities: ["standard"],
    defaultQuality: "standard",
    supportedSizes: ["1024x1024", "768x1344", "864x1152", "1344x768", "1152x864", "1440x720", "720x1440"],
    defaultSize: "1024x1024",
    needsApiKey: false, // sandbox auto-auth; production requires ZAI_API_KEY
    signupUrl: "https://z.ai/dashboard/api-keys",
    pricingUrl: "https://z.ai/pricing",
  },
  deepinfra: {
    type: "deepinfra",
    name: "DeepInfra",
    description: "FLUX.1-dev — cheapest quality match",
    emoji: "🔵",
    defaultModel: "black-forest-labs/FLUX.1-dev",
    supportedModels: [
      { id: "black-forest-labs/FLUX.1-dev", label: "FLUX.1-dev (quality)", pricePerImage: { low: 0.003, medium: 0.003 } },
      { id: "black-forest-labs/FLUX.1-schnell", label: "FLUX.1-schnell (cheapest)", pricePerImage: { low: 0.001, medium: 0.001 } },
    ],
    supportedQualities: ["low", "medium"],
    defaultQuality: "medium",
    supportedSizes: ["1024x1024"],
    defaultSize: "1024x1024",
    needsApiKey: true,
    signupUrl: "https://deepinfra.com",
    pricingUrl: "https://deepinfra.com/pricing",
  },
  fal: {
    type: "fal",
    name: "Fal.ai",
    description: "FLUX.1-dev/pro — flexible pricing",
    emoji: "🟡",
    defaultModel: "fal-ai/flux/dev",
    supportedModels: [
      { id: "fal-ai/flux/dev", label: "FLUX.1-dev (quality)", pricePerImage: { low: 0.025, medium: 0.025 } },
      { id: "fal-ai/flux/schnell", label: "FLUX.1-schnell (cheap)", pricePerImage: { low: 0.001, medium: 0.001 } },
      { id: "fal-ai/flux-pro", label: "FLUX.1-pro (premium)", pricePerImage: { low: 0.05, medium: 0.05 } },
    ],
    supportedQualities: ["low", "medium"],
    defaultQuality: "medium",
    supportedSizes: ["1024x1024"],
    defaultSize: "1024x1024",
    needsApiKey: true,
    signupUrl: "https://fal.ai/dashboard/keys",
    pricingUrl: "https://fal.ai/models",
  },
  together: {
    type: "together",
    name: "Together AI",
    description: "FLUX.1-dev — reliable hosting",
    emoji: "🟠",
    defaultModel: "black-forest-labs/FLUX.1-schnell",
    supportedModels: [
      { id: "black-forest-labs/FLUX.1-schnell", label: "FLUX.1-schnell", pricePerImage: { low: 0.003, medium: 0.003 } },
    ],
    supportedQualities: ["low", "medium"],
    defaultQuality: "medium",
    supportedSizes: ["1024x1024"],
    defaultSize: "1024x1024",
    needsApiKey: true,
    signupUrl: "https://www.together.ai",
    pricingUrl: "https://www.together.ai/pricing",
  },
  replicate: {
    type: "replicate",
    name: "Replicate",
    description: "FLUX.1-dev — easy API",
    emoji: "⚫",
    defaultModel: "black-forest-labs/flux-dev",
    supportedModels: [
      { id: "black-forest-labs/flux-dev", label: "FLUX.1-dev", pricePerImage: { low: 0.003, medium: 0.003 } },
      { id: "black-forest-labs/flux-schnell", label: "FLUX.1-schnell", pricePerImage: { low: 0.001, medium: 0.001 } },
    ],
    supportedQualities: ["low", "medium"],
    defaultQuality: "medium",
    supportedSizes: ["1024x1024"],
    defaultSize: "1024x1024",
    needsApiKey: true,
    signupUrl: "https://replicate.com/account/api-tokens",
    pricingUrl: "https://replicate.com/pricing",
  },
  cloudflare: {
    type: "cloudflare",
    name: "Cloudflare Workers AI",
    description: "FLUX.1-dev — free tier (50-100 images/day)",
    emoji: "🟠",
    defaultModel: "@cf/black-forest-labs/flux-1-dev",
    supportedModels: [
      { id: "@cf/black-forest-labs/flux-1-dev", label: "FLUX.1-dev (free tier)", pricePerImage: { standard: 0 } },
    ],
    supportedQualities: ["standard"],
    defaultQuality: "standard",
    supportedSizes: ["1024x1024"],
    defaultSize: "1024x1024",
    needsApiKey: true,
    signupUrl: "https://dash.cloudflare.com",
    pricingUrl: "https://developers.cloudflare.com/workers-ai/platform/pricing",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

interface ProviderRow {
  id: string;
  type: string;
  label: string;
  apiKeyEnv: string;
  model: string | null;
  dailyLimit: number | null;
  isActive: number;
  failoverOrder: number;
  createdAt: string;
  updatedAt: string;
}

async function toProvider(row: ProviderRow): Promise<Provider> {
  // Look up today's usage
  let usedToday = 0;
  let spentToday = 0;
  if (turso) {
    try {
      const usageRes = await turso.execute({
        sql: "SELECT imageCount, costUsd FROM provider_usage WHERE providerId = ? AND usedDate = ?",
        args: [row.id, todayStr()],
      });
      if (usageRes.rows.length > 0) {
        const u = usageRes.rows[0] as { imageCount?: number; costUsd?: number };
        usedToday = u.imageCount ?? 0;
        spentToday = u.costUsd ?? 0;
      }
    } catch {
      // usage table might not exist yet — ignore
    }
  }

  // Check if env var is set. Z.AI no longer auto-authenticates on Vercel
  // (the .z-ai-config file only exists in the Z.ai Code sandbox), so we
  // require the env var to be set explicitly on production.
  const isConfigured = !!process.env[row.apiKeyEnv];

  return {
    id: row.id,
    type: row.type as ProviderType,
    label: row.label,
    apiKeyEnv: row.apiKeyEnv,
    model: row.model,
    dailyLimit: row.dailyLimit,
    isActive: !!row.isActive,
    failoverOrder: row.failoverOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isConfigured,
    usedToday,
    spentToday,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Provider CRUD
// ─────────────────────────────────────────────────────────────────────────

/** List all providers, sorted by failover order. */
export async function listProviders(): Promise<Provider[]> {
  if (!turso) return [];

  const result = await turso.execute({
    sql: "SELECT * FROM providers ORDER BY failoverOrder ASC, createdAt ASC",
    args: [],
  });

  const providers: Provider[] = [];
  for (const row of result.rows) {
    providers.push(await toProvider(row as unknown as ProviderRow));
  }
  return providers;
}

/** List only active providers, in failover order. */
export async function listActiveProviders(): Promise<Provider[]> {
  const all = await listProviders();
  return all.filter((p) => p.isActive && p.isConfigured);
}

/** Get a single provider by ID. */
export async function getProvider(id: string): Promise<Provider | null> {
  if (!turso) return null;

  const result = await turso.execute({
    sql: "SELECT * FROM providers WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return await toProvider(result.rows[0] as unknown as ProviderRow);
}

/** Create a new provider. */
export async function createProvider(input: {
  type: ProviderType;
  label: string;
  apiKeyEnv: string;
  model?: string | null;
  dailyLimit?: number | null;
  isActive?: boolean;
}): Promise<Provider> {
  if (!turso) throw new Error("Turso not configured");

  // Determine failover order (next available)
  const maxOrderRes = await turso.execute({
    sql: "SELECT MAX(failoverOrder) as maxOrder FROM providers",
    args: [],
  });
  const maxOrder = (maxOrderRes.rows[0] as { maxOrder?: number } | undefined)?.maxOrder ?? 0;
  const failoverOrder = maxOrder + 1;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const meta = PROVIDER_METADATA[input.type];
  const model = input.model ?? meta.defaultModel;

  await turso.execute({
    sql: `INSERT INTO providers (id, type, label, apiKeyEnv, model, dailyLimit, isActive, failoverOrder, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.type,
      input.label,
      input.apiKeyEnv,
      model,
      input.dailyLimit ?? null,
      input.isActive === false ? 0 : 1,
      failoverOrder,
      now,
      now,
    ],
  });

  const p = await getProvider(id);
  if (!p) throw new Error("Failed to create provider");
  return p;
}

/** Update a provider. */
export async function updateProvider(
  id: string,
  updates: {
    label?: string;
    apiKeyEnv?: string;
    model?: string | null;
    dailyLimit?: number | null;
    isActive?: boolean;
    failoverOrder?: number;
  }
): Promise<Provider | null> {
  if (!turso) throw new Error("Turso not configured");

  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (updates.label !== undefined) { sets.push("label = ?"); args.push(updates.label); }
  if (updates.apiKeyEnv !== undefined) { sets.push("apiKeyEnv = ?"); args.push(updates.apiKeyEnv); }
  if (updates.model !== undefined) { sets.push("model = ?"); args.push(updates.model); }
  if (updates.dailyLimit !== undefined) { sets.push("dailyLimit = ?"); args.push(updates.dailyLimit); }
  if (updates.isActive !== undefined) { sets.push("isActive = ?"); args.push(updates.isActive ? 1 : 0); }
  if (updates.failoverOrder !== undefined) { sets.push("failoverOrder = ?"); args.push(updates.failoverOrder); }
  if (sets.length === 0) return await getProvider(id);

  sets.push("updatedAt = ?");
  args.push(new Date().toISOString());
  args.push(id);

  await turso.execute({
    sql: `UPDATE providers SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

  return await getProvider(id);
}

/** Delete a provider. */
export async function deleteProvider(id: string): Promise<void> {
  if (!turso) return;
  await turso.execute({
    sql: "DELETE FROM provider_usage WHERE providerId = ?",
    args: [id],
  });
  await turso.execute({
    sql: "DELETE FROM providers WHERE id = ?",
    args: [id],
  });
}

/** Reorder providers (takes an ordered list of IDs). */
export async function reorderProviders(orderedIds: string[]): Promise<void> {
  if (!turso) return;
  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    await turso.execute({
      sql: "UPDATE providers SET failoverOrder = ?, updatedAt = ? WHERE id = ?",
      args: [i + 1, now, orderedIds[i]],
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Usage tracking
// ─────────────────────────────────────────────────────────────────────────

/** Record a successful generation. */
export async function recordUsage(
  providerId: string,
  costUsd: number
): Promise<void> {
  if (!turso) return;
  const today = todayStr();

  // Try to update existing row first
  const existing = await turso.execute({
    sql: "SELECT id, imageCount, costUsd FROM provider_usage WHERE providerId = ? AND usedDate = ?",
    args: [providerId, today],
  });

  if (existing.rows.length > 0) {
    const row = existing.rows[0] as { id: string; imageCount: number; costUsd: number };
    await turso.execute({
      sql: "UPDATE provider_usage SET imageCount = ?, costUsd = ? WHERE id = ?",
      args: [row.imageCount + 1, row.costUsd + costUsd, row.id],
    });
  } else {
    const usageId = crypto.randomUUID();
    await turso.execute({
      sql: "INSERT INTO provider_usage (id, providerId, usedDate, imageCount, costUsd) VALUES (?, ?, ?, ?, ?)",
      args: [usageId, providerId, today, 1, costUsd],
    });
  }
}

/** Get total spend across all providers. */
export async function getTotalSpend(): Promise<{ today: number; allTime: number; imageCount: number }> {
  if (!turso) return { today: 0, allTime: 0, imageCount: 0 };
  const today = todayStr();

  const todayRes = await turso.execute({
    sql: "SELECT COALESCE(SUM(costUsd), 0) as total, COALESCE(SUM(imageCount), 0) as cnt FROM provider_usage WHERE usedDate = ?",
    args: [today],
  });
  const todayRow = todayRes.rows[0] as { total?: number; cnt?: number } | undefined;
  const todaySpend = todayRow?.total ?? 0;
  const todayCount = todayRow?.cnt ?? 0;

  const allRes = await turso.execute({
    sql: "SELECT COALESCE(SUM(costUsd), 0) as total, COALESCE(SUM(imageCount), 0) as cnt FROM provider_usage",
    args: [],
  });
  const allRow = allRes.rows[0] as { total?: number; cnt?: number } | undefined;
  const allTimeSpend = allRow?.total ?? 0;
  const allTimeCount = allRow?.cnt ?? 0;

  return {
    today: todaySpend,
    allTime: allTimeSpend,
    imageCount: allTimeCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Schema initialization
// ─────────────────────────────────────────────────────────────────────────

/** Create the providers and provider_usage tables (idempotent). */
export async function ensureProviderSchema(): Promise<void> {
  if (!turso) return;

  await turso.executeMultiple(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      apiKeyEnv TEXT NOT NULL,
      model TEXT,
      dailyLimit INTEGER,
      isActive INTEGER NOT NULL DEFAULT 1,
      failoverOrder INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_usage (
      id TEXT PRIMARY KEY,
      providerId TEXT NOT NULL,
      usedDate TEXT NOT NULL,
      imageCount INTEGER NOT NULL DEFAULT 0,
      costUsd REAL NOT NULL DEFAULT 0,
      UNIQUE(providerId, usedDate),
      FOREIGN KEY (providerId) REFERENCES providers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_usage_provider_date ON provider_usage(providerId, usedDate);
  `);
}

/** Check if any providers are configured. */
export async function isProviderSchemaSeeded(): Promise<boolean> {
  if (!turso) return false;
  const result = await turso.execute({
    sql: "SELECT COUNT(*) as cnt FROM providers",
    args: [],
  });
  const cnt = (result.rows[0] as { cnt?: number } | undefined)?.cnt ?? 0;
  return cnt > 0;
}

export { isTursoConfigured };
