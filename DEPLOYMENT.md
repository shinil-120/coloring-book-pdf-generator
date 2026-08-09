# Deployment Guide — Coloring Book PDF Generator

Deploy to **Vercel** (hosting) + **Turso** (metadata DB) + **Vercel Blob** (file storage).
No Z.AI API key needed in production — AI images are generated locally and uploaded.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Hosting)                       │
│                                                           │
│  ┌──────────────┐    ┌──────────────────────────┐        │
│  │  Next.js App │───▶│   API Routes             │        │
│  │  (frontend)  │    │   /api/books (Turso)     │        │
│  │              │    │   /api/edit-pdf          │        │
│  │              │    │   /api/assemble-pdf      │        │
│  │              │    │   /api/generate-cover    │        │
│  └──────────────┘    └──────────┬───────────────┘        │
│                                 │                         │
│          ┌──────────────────────┼──────────────┐         │
│          ▼                                     ▼         │
│  ┌─────────────┐                    ┌──────────────┐    │
│  │   Turso     │                    │ Vercel Blob  │    │
│  │ (metadata)  │                    │ (PDFs/images)│    │
│  └─────────────┘                    └──────────────┘    │
└─────────────────────────────────────────────────────────┘

Local Development (AI image generation):
  scripts/generate-images.ts → Z.AI SDK → local files → migrate-to-turso.ts → upload to Blob + Turso
```

- **Turso**: Stores book metadata (name, slug, pages, items, PDF URL)
- **Vercel Blob**: Stores generated PDFs and thumbnail images
- **Z.AI SDK**: Used ONLY locally to generate AI images — NOT in production

---

## Prerequisites

1. **GitHub account** ✅ (you have this)
2. **Vercel account** ✅ (you have this)
3. **Turso account** ✅ (you have this)
4. **Z.AI API key** — ONLY for local image generation (optional for deployment)

---

## Step 1: Push Code to GitHub

```bash
git init
git add -A
git commit -m "Coloring Book PDF Generator with Turso + Blob"
git branch -M main

# Create repo on GitHub (via web: github.com/new)
git remote add origin https://github.com/YOUR_USERNAME/coloring-book-pdf-generator.git
git push -u origin main
```

---

## Step 2: Set Up Turso Database (Method B — Web Dashboard)

1. Go to **[app.turso.tech](https://app.turso.tech)** → log in

2. Click **"New Database"**
   - Name: `coloring-books`
   - Group: default (or create one)
   - Location: closest to you
   - Click **"Create"**

3. **Get the database URL:**
   - Click on your new `coloring-books` database
   - Go to **"Settings"** or **"Connect"** tab
   - Copy the URL (looks like `libsql://coloring-books-yourname.turso.io`)
   - 👉 This is your **`TURSO_DATABASE_URL`**

4. **Create an auth token:**
   - In the same database page, find **"Auth Tokens"** or **"Create Token"**
   - Click **"Create Auth Token"**
   - Name it: `coloring-book-app`
   - Copy the token (starts with `eyJ...`)
   - 👉 This is your **`TURSO_AUTH_TOKEN`**

> **Note:** Also set `TURSO_DIRECT_URL` to the same value as `TURSO_DATABASE_URL`.

---

## Step 3: Deploy to Vercel + Create Blob Store

### 3.1 Import project to Vercel

1. Go to **[vercel.com/new](https://vercel.com/new)**
2. Find your GitHub repo → **"Import"**
3. Vercel auto-detects Next.js — keep defaults

### 3.2 Add environment variables (before deploying)

Scroll down to **"Environment Variables"** and add:

| Variable | Value |
|----------|-------|
| `TURSO_DATABASE_URL` | `libsql://coloring-books-yourname.turso.io` |
| `TURSO_DIRECT_URL` | `libsql://coloring-books-yourname.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJ...` (from Step 2) |
| `NEXT_PUBLIC_APP_URL` | `https://your-project-name.vercel.app` (guess now, update later) |

> **No `ZAI_API_KEY` needed!** AI generation happens locally only.

### 3.3 Deploy

Click **"Deploy"** → wait ~2-3 minutes for build.

### 3.4 Create Vercel Blob Store

1. Go to your Vercel project dashboard
2. Click the **"Storage"** tab
3. Click **"Create Blob Store"**
   - Name: `coloring-books`
   - Click **"Create"**
4. Vercel auto-adds `BLOB_READ_WRITE_TOKEN` to your environment variables
5. **Redeploy** so the new token takes effect:
   - Deployments → ⋯ on latest → **"Redeploy"**

### 3.5 Copy the Blob token (for local migration)

1. Go to **Settings → Environment Variables**
2. Find `BLOB_READ_WRITE_TOKEN`
3. Click the **eye icon** to reveal it
4. Copy the value (starts with `vercel_blob_rw_...`)
5. 👉 This is your **`BLOB_READ_WRITE_TOKEN`**

---

## Step 4: Set Up Local Environment

Create `.env.local` in your project root (never commit this):

```env
# Turso
TURSO_DATABASE_URL=libsql://coloring-books-yourname.turso.io
TURSO_DIRECT_URL=libsql://coloring-books-yourname.turso.io
TURSO_AUTH_TOKEN=eyJ...your-token...

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...your-token...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Z.AI API Key (ONLY needed for local AI image generation)
# Get from: https://z.ai → API Keys
# ZAI_API_KEY=your-zai-key (optional — only for generate-images.ts)
```

---

## Step 5: Push Database Schema to Turso

With your `.env.local` set up, run:

```bash
bun run db:push
```

This creates the `ColoringBook` and `GeneratedCover` tables in Turso.

---

## Step 6: Migrate Existing Data to Turso + Blob

Upload your existing Pets book (PDF + 30 thumbnails) to production:

```bash
bun run scripts/migrate-to-turso.ts
```

This will:
1. Read `public/downloads/coloring-books.json`
2. Upload the Pets PDF to Vercel Blob
3. Upload all 30 thumbnails to Vercel Blob
4. Create a Turso record for the Pets book

---

## Step 7: Verify Production

1. Visit your Vercel URL: `https://your-project-name.vercel.app`
2. You should see the Pets Coloring Book (30 pages)
3. Test: download, preview, edit, merge, cover generator

---

## Generating New Books (Local Workflow)

To create a new coloring book with AI images:

```bash
# 1. Set ZAI_API_KEY in .env.local (only needed locally)
# ZAI_API_KEY=your-key

# 2. Generate AI images (local)
bun run scripts/generate-images.ts dinosaurs

# 3. Process images + build PDF (local)
bun run scripts/regenerate-pdfs-no-covers.ts dinosaurs

# 4. Upload to production (Turso + Blob)
bun run scripts/migrate-to-turso.ts
```

The deployed app reads from Turso + Blob, so new books appear automatically after migration.

---

## Environment Variables Summary

### Production (Vercel dashboard)
| Variable | Required | Purpose |
|----------|----------|---------|
| `TURSO_DATABASE_URL` | ✅ | Turso database connection |
| `TURSO_DIRECT_URL` | ✅ | Same as above (direct connection) |
| `TURSO_AUTH_TOKEN` | ✅ | Turso authentication |
| `BLOB_READ_WRITE_TOKEN` | ✅ | Vercel Blob file storage |
| `NEXT_PUBLIC_APP_URL` | ✅ | App URL for production |
| `ZAI_API_KEY` | ❌ | NOT needed (local only) |

### Local (.env.local)
Same as production, PLUS optionally:
| Variable | Required | Purpose |
|----------|----------|---------|
| `ZAI_API_KEY` | Optional | For `scripts/generate-images.ts` only |

---

## Troubleshooting

### "PrismaClient is not defined"
```bash
bun run db:generate
```

### "BLOB_READ_WRITE_TOKEN not set"
Create the Blob store in Vercel → Storage. If already created, check Settings → Environment Variables.

### Turso connection issues
Verify in Turso dashboard that the database exists and the token is valid.

### Migration script fails
Ensure all 4 env vars are set in `.env.local`: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`.
