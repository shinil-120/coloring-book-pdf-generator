/**
 * scripts/seed-categories.ts
 *
 * CLI entrypoint for seeding the Turso database with 137 built-in
 * coloring-book categories (5,429 unique items).
 *
 * The actual data + seeding logic lives in src/lib/seed-categories-data.ts
 * so it can be shared with the /api/admin/seed API route (which lets
 * users seed production Turso from a phone browser).
 *
 * Idempotent & resumable:
 *   1. ensureCategorySchema()  — creates categories/items tables if missing
 *   2. isCategorySchemaSeeded() — early-exit if ALL categories already exist
 *   3. getCategory(slug)       — skips already-created categories on resume
 *
 * Usage:
 *   bun run scripts/seed-categories.ts
 *
 * Env:
 *   TURSO_DATABASE_URL  — libsql://…  (or file:./db/categories.db for local)
 *   TURSO_AUTH_TOKEN    — auth token (empty for local file)
 *
 * If TURSO_DATABASE_URL is not set, the script auto-falls back to a local
 * SQLite file at ./db/categories.db so the seeder always runs.
 */
import path from "node:path";
import fs from "node:fs";

// ─────────────────────────────────────────────────────────────────────────
// Configure Turso env BEFORE importing the lib (turso.ts creates a singleton
// at module-load time — dynamic import below ensures env is set first).
// ─────────────────────────────────────────────────────────────────────────
if (!process.env.TURSO_DATABASE_URL) {
  const dbDir = path.resolve(process.cwd(), "db");
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  process.env.TURSO_DATABASE_URL = `file:${path.join(dbDir, "categories.db")}`;
  if (!process.env.TURSO_AUTH_TOKEN) process.env.TURSO_AUTH_TOKEN = "";
  console.warn(
    `⚠  TURSO_DATABASE_URL not set — falling back to local file: ${process.env.TURSO_DATABASE_URL}`
  );
}

async function main() {
  console.log("\n🌱 Seeding coloring-book categories into Turso (libSQL)\n");

  const { runSeeder, CATEGORIES } = await import("../src/lib/seed-categories-data");

  console.log(`📦 Seeding ${CATEGORIES.length} categories (each with ~40 items)…\n`);

  const result = await runSeeder();

  if (result.alreadySeeded) {
    console.log(
      `✓ All ${result.totalCategories} categories already seeded — skipping (idempotent).`
    );
  } else {
    console.log(
      `\n✨ Done. Seeded ${result.totalCategories} categories (${result.skipped} skipped) with ${result.totalItems} items total.`
    );
  }

  if (result.failed > 0) {
    console.error(`\n❌ ${result.failed} categories failed:`);
    for (const err of result.errors) {
      console.error(`   ${err}`);
    }
    process.exit(1);
  }

  console.log(`\n⏱  Completed in ${(result.durationMs / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("❌ Seeder crashed:", err);
  process.exit(1);
});
