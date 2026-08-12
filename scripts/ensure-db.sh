#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# scripts/ensure-db.sh
#
# Pre-dev hook: ensures the local SQLite database + .env.local exist before
# starting the Next.js dev server. Idempotent — only re-seeds when the DB
# is missing or empty, so normal dev startup is instant.
#
# This solves the recurring sandbox issue where .env.local + db/categories.db
# get cleaned up between sessions, causing /api/categories to return [].
# ─────────────────────────────────────────────────────────────────────────
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

ENV_LOCAL=".env.local"
DB_DIR="db"
DB_FILE="db/categories.db"

# ─── 1. Ensure .env.local exists ──────────────────────────────────────
if [ ! -f "$ENV_LOCAL" ]; then
  echo "[ensure-db] Creating $ENV_LOCAL (local SQLite fallback)…"
  cat > "$ENV_LOCAL" << 'EOF'
TURSO_DATABASE_URL=file:./db/categories.db
TURSO_AUTH_TOKEN=
EOF
  echo "[ensure-db] ✓ $ENV_LOCAL created"
else
  # Verify it has TURSO_DATABASE_URL — if not, append it
  if ! grep -q "TURSO_DATABASE_URL" "$ENV_LOCAL"; then
    echo "[ensure-db] Appending TURSO_DATABASE_URL to $ENV_LOCAL…"
    echo "" >> "$ENV_LOCAL"
    echo "TURSO_DATABASE_URL=file:./db/categories.db" >> "$ENV_LOCAL"
    echo "TURSO_AUTH_TOKEN=" >> "$ENV_LOCAL"
    echo "[ensure-db] ✓ TURSO_DATABASE_URL added"
  fi
fi

# ─── 2. Ensure db/ directory exists ────────────────────────────────────
if [ ! -d "$DB_DIR" ]; then
  mkdir -p "$DB_DIR"
  echo "[ensure-db] ✓ Created $DB_DIR/ directory"
fi

# ─── 3. Check if DB file exists AND has categories ────────────────────
# We use sqlite3 CLI if available, otherwise fall back to checking file size.
NEEDS_SEED=0

if [ ! -f "$DB_FILE" ]; then
  echo "[ensure-db] DB file missing — will seed"
  NEEDS_SEED=1
elif [ ! -s "$DB_FILE" ]; then
  echo "[ensure-db] DB file is empty — will seed"
  NEEDS_SEED=1
else
  # Try to count categories using sqlite3 CLI (if installed)
  if command -v sqlite3 &> /dev/null; then
    COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM categories;" 2>/dev/null || echo "0")
    if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
      echo "[ensure-db] DB has 0 categories — will seed"
      NEEDS_SEED=1
    else
      echo "[ensure-db] ✓ DB ready ($COUNT categories)"
    fi
  else
    # No sqlite3 CLI — assume DB is fine if file is > 100KB (seeded DB is ~1.7MB)
    FILE_SIZE=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE" 2>/dev/null || echo "0")
    if [ "$FILE_SIZE" -lt 100000 ]; then
      echo "[ensure-db] DB file too small ($FILE_SIZE bytes) — will seed"
      NEEDS_SEED=1
    else
      echo "[ensure-db] ✓ DB ready (file size: $FILE_SIZE bytes)"
    fi
  fi
fi

# ─── 4. Seed if needed ────────────────────────────────────────────────
if [ "$NEEDS_SEED" = "1" ]; then
  echo "[ensure-db] Seeding 137 categories × 5429 items…"
  echo "[ensure-db] (this takes ~30 seconds on first run)"
  if bun run scripts/seed-categories.ts > /tmp/seed-output.log 2>&1; then
    tail -3 /tmp/seed-output.log | while read -r line; do
      echo "[ensure-db]   $line"
    done
    echo "[ensure-db] ✓ Seeding complete"
  else
    echo "[ensure-db] ✗ Seeding failed — see /tmp/seed-output.log"
    tail -10 /tmp/seed-output.log
    # Don't exit non-zero — let dev server start anyway (user can re-seed manually)
  fi
fi

echo "[ensure-db] ✓ Ready — starting Next.js dev server"
