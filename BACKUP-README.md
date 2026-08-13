# Coloring Book PDF Generator — Backup 2026-08-13

## 📦 What's in This Backup

### 1. Source Code ZIP (`coloring-book-backup-20260813.zip`)
Contains ALL source code (no node_modules, no .next, no database):
- `src/` — 106 files (Next.js app: components, API routes, lib)
- `scripts/` — 8 files (seeders, image pipeline, ensure-db.sh)
- `python-coloring-book/` — 14 files (standalone Python script)
- `prisma/` — schema
- `public/` — static assets
- Config files: package.json, vercel.json, tsconfig.json, etc.
- `worklog.md` — complete development history (1500+ lines)
- `.env.example` — env var template (NO secrets)

### 2. Git Bundle (`coloring-book-backup-20260813.bundle`)
Complete git history (92 commits). Can be cloned:
```bash
git clone coloring-book-backup-20260813.bundle coloring-book-restored
```

### 3. Database (NOT in backup — lives in Turso)
- 137 categories × 5,429 items
- 1 provider configured (API123 Z.AI)
- To restore: `bun run scripts/seed-categories.ts`

### 4. Cloud Services (NOT in backup — live independently)
- **GitHub**: https://github.com/shinil-120/coloring-book-pdf-generator
- **Vercel**: https://coloring-book-pdf-generator.vercel.app
- **Turso DB**: libsql://your-database.turso.io
- **Vercel Blob**: blob storage for images + PDFs

## 🔑 Environment Variables (NOT in backup — add manually)

### For Local Dev (.env.local):
```
TURSO_DATABASE_URL=file:./db/categories.db
TURSO_AUTH_TOKEN=
ZAI_API_KEY=966f395f6942498194a65df5578738a5.Nqj0pjbs9AMcUy0B
```

### For Vercel Production:
```
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
ZAI_API_KEY=966f395f6942498194a65df5578738a5.Nqj0pjbs9AMcUy0B
OPENAI_API_KEY=sk-proj-...
```

## 🚀 How to Restore from This Backup

### Option A: From GitHub (Easiest)
```bash
git clone https://github.com/shinil-120/coloring-book-pdf-generator.git
cd coloring-book-pdf-generator
bun install
cp .env.example .env.local  # Edit with your keys
bun run scripts/seed-categories.ts  # Seed database
bun run dev  # Start dev server
```

### Option B: From ZIP Backup
```bash
unzip coloring-book-backup-20260813.zip -d coloring-book-restored
cd coloring-book-restored
bun install
cp .env.example .env.local  # Edit with your keys
bun run scripts/seed-categories.ts
bun run dev
```

### Option C: From Git Bundle
```bash
git clone coloring-book-backup-20260813.bundle coloring-book-restored
cd coloring-book-restored
bun install
cp .env.example .env.local
bun run scripts/seed-categories.ts
bun run dev
```

## 📊 Project Statistics (as of 2026-08-13)

| Metric | Value |
|---|---|
| Git commits | 92 |
| Source files | 106 (src/) + 8 (scripts/) + 14 (python) |
| Categories | 137 |
| Items | 5,429 |
| API routes | 20+ |
| Providers supported | 7 (OpenAI, Z.AI, DeepInfra, fal, Together, Replicate, Cloudflare) |
| Worklog lines | 1,500+ |

## 🔄 Weekly Backup Strategy

Every week, ask the agent:
> "Create a weekly backup of the project"

The agent will:
1. Update the ZIP with the latest code
2. Create a new git bundle with all commits
3. Save to Vercel Blob with versioning
4. Return a download link

## ⚠️ What's NOT Backed Up

- **Generated images** (on Vercel Blob) — these can be regenerated
- **node_modules/** — can be reinstalled with `bun install`
- **.next/** build cache — regenerated on build
- **dev.log** — just logs
- **API keys** — stored in Vercel env vars (encrypted)

## 📝 Notes

- This backup was created on 2026-08-13
- The latest commit is: a7ecd07 "Add Bulk Upload button in item picker"
- The worklog.md contains the complete development history
- GitHub is the PRIMARY backup — this ZIP is secondary
