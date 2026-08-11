/**
 * Category & Item data access layer (Turso-backed).
 *
 * Stores all coloring-book categories (built-in + user-added) and their items.
 * Items can be added, edited, soft-deleted, and reordered. Each item has
 * an optional natural color palette; if absent, the system falls back to
 * a category-themed palette.
 *
 * Tables (created via scripts/seed-categories.ts):
 *   categories(id, name, slug, emoji, themeColor, description, isBuiltin,
 *               createdAt, updatedAt)
 *   items(id, categoryId, name, sortOrder, paletteJson, isDeleted,
 *         createdAt, updatedAt)
 *
 * If Turso is not configured, returns empty data (app still works for
 * legacy books loaded from coloring-data.ts).
 */
import { turso, isTursoConfigured } from "./turso";
import { sanitizePalette, type Palette } from "./coloring-data";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  themeColor: string;       // "emerald" | "sky" | "amber" | "rose" | "violet" | "lime" | "orange" | "fuchsia" | "indigo" | "stone"
  description: string;
  isBuiltin: boolean;
  itemCount: number;         // computed: non-deleted items
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  palette: Palette | null;   // null = use category-themed fallback
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Theme → palette mapping (for categories without per-item palettes)
// ─────────────────────────────────────────────────────────────────────────

export const THEME_PALETTES: Record<string, Palette> = {
  emerald:  [[120, 80, 40], [80, 50, 20], [180, 200, 140], [60, 100, 50], [200, 180, 120]],
  sky:      [[80, 120, 160], [60, 100, 140], [150, 180, 200], [40, 80, 110], [180, 200, 220]],
  amber:    [[200, 100, 30], [160, 70, 20], [240, 180, 100], [120, 60, 20], [255, 200, 80]],
  rose:     [[220, 80, 100], [180, 50, 70], [255, 180, 200], [120, 40, 60], [255, 200, 220]],
  violet:   [[120, 80, 200], [80, 50, 160], [200, 180, 240], [60, 30, 130], [180, 160, 230]],
  lime:     [[100, 180, 60], [60, 130, 40], [180, 220, 140], [40, 90, 30], [200, 230, 160]],
  orange:   [[240, 120, 40], [200, 80, 20], [255, 180, 100], [160, 60, 20], [255, 220, 160]],
  fuchsia:  [[200, 50, 180], [160, 30, 130], [240, 160, 220], [120, 20, 100], [255, 200, 240]],
  indigo:   [[60, 60, 160], [40, 40, 120], [140, 140, 220], [30, 30, 90], [180, 180, 240]],
  stone:    [[120, 110, 100], [90, 80, 70], [180, 170, 160], [60, 50, 40], [220, 210, 200]],
};

export function getThemePalette(themeColor: string): Palette {
  return THEME_PALETTES[themeColor] ?? THEME_PALETTES.stone;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  themeColor: string;
  description: string;
  isBuiltin: number;
  createdAt: string;
  updatedAt: string;
}

interface ItemRow {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  paletteJson: string | null;
  isDeleted: number;
  createdAt: string;
  updatedAt: string;
}

function toCategory(row: CategoryRow, itemCount: number): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    emoji: row.emoji,
    themeColor: row.themeColor,
    description: row.description,
    isBuiltin: !!row.isBuiltin,
    itemCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toItem(row: ItemRow): Item {
  let palette: Palette | null = null;
  if (row.paletteJson) {
    try {
      const parsed = JSON.parse(row.paletteJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        palette = sanitizePalette(parsed, row.name);
      }
    } catch {
      palette = null;
    }
  }
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    sortOrder: row.sortOrder,
    palette,
    isDeleted: !!row.isDeleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Category CRUD
// ─────────────────────────────────────────────────────────────────────────

/** List all categories (built-in + custom), with item counts. */
export async function listCategories(): Promise<Category[]> {
  if (!turso) return [];

  const result = await turso.execute({
    sql: `SELECT c.*, (SELECT COUNT(*) FROM items i WHERE i.categoryId = c.id AND i.isDeleted = 0) AS itemCount
           FROM categories c
           ORDER BY c.isBuiltin DESC, c.name ASC`,
    args: [],
  });

  return result.rows.map((row) => {
    const r = row as unknown as CategoryRow & { itemCount: number };
    return toCategory(r, r.itemCount || 0);
  });
}

/** Get a single category by slug. */
export async function getCategory(slug: string): Promise<Category | null> {
  if (!turso) return null;

  const result = await turso.execute({
    sql: `SELECT c.*, (SELECT COUNT(*) FROM items i WHERE i.categoryId = c.id AND i.isDeleted = 0) AS itemCount
           FROM categories c
           WHERE c.slug = ?`,
    args: [slug],
  });
  if (result.rows.length === 0) return null;

  const r = result.rows[0] as unknown as CategoryRow & { itemCount: number };
  return toCategory(r, r.itemCount || 0);
}

/** Get a category by ID. */
export async function getCategoryById(id: string): Promise<Category | null> {
  if (!turso) return null;

  const result = await turso.execute({
    sql: `SELECT c.*, (SELECT COUNT(*) FROM items i WHERE i.categoryId = c.id AND i.isDeleted = 0) AS itemCount
           FROM categories c
           WHERE c.id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;

  const r = result.rows[0] as unknown as CategoryRow & { itemCount: number };
  return toCategory(r, r.itemCount || 0);
}

/** Create a new category. */
export async function createCategory(input: {
  name: string;
  slug: string;
  emoji: string;
  themeColor: string;
  description?: string;
  isBuiltin?: boolean;
}): Promise<Category> {
  if (!turso) throw new Error("Turso not configured");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await turso.execute({
    sql: `INSERT INTO categories (id, name, slug, emoji, themeColor, description, isBuiltin, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.name,
      input.slug,
      input.emoji,
      input.themeColor,
      input.description ?? "",
      input.isBuiltin ? 1 : 0,
      now,
      now,
    ],
  });

  const cat = await getCategory(input.slug);
  if (!cat) throw new Error("Failed to create category");
  return cat;
}

/** Update a category (name, emoji, themeColor, description). */
export async function updateCategory(
  id: string,
  updates: { name?: string; emoji?: string; themeColor?: string; description?: string }
): Promise<Category | null> {
  if (!turso) throw new Error("Turso not configured");

  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (updates.name !== undefined) {
    sets.push("name = ?");
    args.push(updates.name);
  }
  if (updates.emoji !== undefined) {
    sets.push("emoji = ?");
    args.push(updates.emoji);
  }
  if (updates.themeColor !== undefined) {
    sets.push("themeColor = ?");
    args.push(updates.themeColor);
  }
  if (updates.description !== undefined) {
    sets.push("description = ?");
    args.push(updates.description);
  }
  if (sets.length === 0) {
    return await getCategoryById(id);
  }
  sets.push("updatedAt = ?");
  args.push(new Date().toISOString());
  args.push(id);

  await turso.execute({
    sql: `UPDATE categories SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

  return await getCategoryById(id);
}

/** Delete a category (and all its items). Custom categories only. */
export async function deleteCategory(id: string): Promise<void> {
  if (!turso) return;

  await turso.execute({
    sql: "DELETE FROM items WHERE categoryId = ?",
    args: [id],
  });
  await turso.execute({
    sql: "DELETE FROM categories WHERE id = ?",
    args: [id],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Item CRUD
// ─────────────────────────────────────────────────────────────────────────

/** List all items for a category (excluding soft-deleted). */
export async function listItems(categoryId: string, includeDeleted = false): Promise<Item[]> {
  if (!turso) return [];

  const sql = includeDeleted
    ? "SELECT * FROM items WHERE categoryId = ? ORDER BY sortOrder ASC, name ASC"
    : "SELECT * FROM items WHERE categoryId = ? AND isDeleted = 0 ORDER BY sortOrder ASC, name ASC";

  const result = await turso.execute({ sql, args: [categoryId] });
  return result.rows.map((row) => toItem(row as unknown as ItemRow));
}

/** Get a single item by ID. */
export async function getItem(id: string): Promise<Item | null> {
  if (!turso) return null;

  const result = await turso.execute({
    sql: "SELECT * FROM items WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return toItem(result.rows[0] as unknown as ItemRow);
}

/** Add an item to a category. */
export async function createItem(input: {
  categoryId: string;
  name: string;
  sortOrder?: number;
  palette?: Palette | null;
}): Promise<Item> {
  if (!turso) throw new Error("Turso not configured");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = input.sortOrder ?? 0;
  const paletteJson = input.palette ? JSON.stringify(input.palette) : null;

  await turso.execute({
    sql: `INSERT INTO items (id, categoryId, name, sortOrder, paletteJson, isDeleted, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    args: [id, input.categoryId, input.name, sortOrder, paletteJson, now, now],
  });

  const item = await getItem(id);
  if (!item) throw new Error("Failed to create item");
  return item;
}

/** Bulk-add items to a category (used by the seeder). */
export async function createItemsBulk(
  categoryId: string,
  items: { name: string; palette?: Palette | null }[]
): Promise<number> {
  if (!turso) throw new Error("Turso not configured");
  if (items.length === 0) return 0;

  const now = new Date().toISOString();
  let inserted = 0;

  // Insert one-by-one (libsql doesn't support multi-row INSERT in a single statement
  // in all configurations; this is safer)
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const id = crypto.randomUUID();
    const paletteJson = it.palette ? JSON.stringify(it.palette) : null;
    try {
      await turso.execute({
        sql: `INSERT INTO items (id, categoryId, name, sortOrder, paletteJson, isDeleted, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        args: [id, categoryId, it.name, i, paletteJson, now, now],
      });
      inserted++;
    } catch (e) {
      console.error(`Failed to insert item "${it.name}":`, e);
    }
  }
  return inserted;
}

/** Update an item's name or palette. */
export async function updateItem(
  id: string,
  updates: { name?: string; palette?: Palette | null }
): Promise<Item | null> {
  if (!turso) throw new Error("Turso not configured");

  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (updates.name !== undefined) {
    sets.push("name = ?");
    args.push(updates.name);
  }
  if (updates.palette !== undefined) {
    sets.push("paletteJson = ?");
    args.push(updates.palette ? JSON.stringify(updates.palette) : null);
  }
  if (sets.length === 0) {
    return await getItem(id);
  }
  sets.push("updatedAt = ?");
  args.push(new Date().toISOString());
  args.push(id);

  await turso.execute({
    sql: `UPDATE items SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

  return await getItem(id);
}

/** Soft-delete an item (recoverable via restore). */
export async function deleteItem(id: string): Promise<void> {
  if (!turso) return;
  await turso.execute({
    sql: "UPDATE items SET isDeleted = 1, updatedAt = ? WHERE id = ?",
    args: [new Date().toISOString(), id],
  });
}

/** Restore a soft-deleted item. */
export async function restoreItem(id: string): Promise<void> {
  if (!turso) return;
  await turso.execute({
    sql: "UPDATE items SET isDeleted = 0, updatedAt = ? WHERE id = ?",
    args: [new Date().toISOString(), id],
  });
}

/** Hard-delete an item (permanent). */
export async function hardDeleteItem(id: string): Promise<void> {
  if (!turso) return;
  await turso.execute({ sql: "DELETE FROM items WHERE id = ?", args: [id] });
}

/** Restore all soft-deleted items in a category (reset to defaults). */
export async function restoreAllItems(categoryId: string): Promise<void> {
  if (!turso) return;
  await turso.execute({
    sql: "UPDATE items SET isDeleted = 0, updatedAt = ? WHERE categoryId = ?",
    args: [new Date().toISOString(), categoryId],
  });
}

/** Reorder items within a category (takes a list of item IDs in new order). */
export async function reorderItems(categoryId: string, itemIds: string[]): Promise<void> {
  if (!turso) return;
  const now = new Date().toISOString();
  for (let i = 0; i < itemIds.length; i++) {
    await turso.execute({
      sql: "UPDATE items SET sortOrder = ?, updatedAt = ? WHERE id = ? AND categoryId = ?",
      args: [i, now, itemIds[i], categoryId],
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Schema initialization (creates tables if missing — idempotent)
// ─────────────────────────────────────────────────────────────────────────

/** Create the categories and items tables (idempotent). */
export async function ensureCategorySchema(): Promise<void> {
  if (!turso) return;

  await turso.executeMultiple(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      themeColor TEXT NOT NULL DEFAULT 'stone',
      description TEXT NOT NULL DEFAULT '',
      isBuiltin INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL,
      name TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      paletteJson TEXT,
      isDeleted INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );

    CREATE INDEX IF NOT EXISTS idx_items_category ON items(categoryId);
    CREATE INDEX IF NOT EXISTS idx_items_sort ON items(categoryId, sortOrder);
  `);
}

/** Check if categories have been seeded. */
export async function isCategorySchemaSeeded(): Promise<boolean> {
  if (!turso) return false;
  const result = await turso.execute({
    sql: "SELECT COUNT(*) as cnt FROM categories",
    args: [],
  });
  const cnt = (result.rows[0] as { cnt?: number } | undefined)?.cnt ?? 0;
  return cnt > 0;
}

export { isTursoConfigured };
