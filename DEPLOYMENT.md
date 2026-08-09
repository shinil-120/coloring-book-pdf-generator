# Deployment Guide — Coloring Book PDF Generator

This guide covers deploying to **Vercel** (hosting) + **Turso** (metadata database) + **Vercel Blob** (file storage).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Vercel (Hosting)                   │
│                                                       │
│  ┌──────────────┐   ┌──────────────────────────┐    │
│  │  Next.js App │   │   API Routes             │    │
│  │  (frontend)  │──▶│   /api/books             │    │
│  │              │   │   /api/edit-pdf          │    │
│  │              │   │   /api/assemble-pdf      │    │
│  │              │   │   /api/generate-cover    │    │
│  └──────────────┘   └──────────┬───────────────┘    │
│                                │                     │
│         ┌──────────────────────┼──────────────┐     │
│         ▼                      ▼              ▼     │
│  ┌─────────────┐    ┌──────────────┐  ┌──────────┐ │
│  │   Turso     │    │ Vercel Blob  │  │  Z.AI    │ │
│  │ (metadata)  │    │ (PDFs/images)│  │  (AI)    │ │
│  └─────────────┘    └──────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────┘
```

- **Turso**: Stores book metadata (name, slug, pages, items, PDF URL)
- **Vercel Blob**: Stores generated PDFs and thumbnail images
- **Z.AI SDK**: Generates AI coloring book images (backend only)

## Prerequisites

1. **GitHub account** — code repository
2. **Vercel account** — hosting (sign up at vercel.com with GitHub)
3. **Turso account** — database (sign up at turso.tech)
4. **Z.AI API key** — for AI image generation (from z.ai dashboard)

---

## Step 1: Push Code to GitHub

```bash
# In the project directory
git init
git add -A
git commit -m "Coloring Book PDF Generator with Turso + Blob"

# Create repo on GitHub (via gh CLI or web UI)
gh repo create coloring-book-pdf-generator --public --source=. --push
```

---

## Step 2: Set Up Turso Database

### 2.1 Install Turso CLI & login
```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
```

### 2.2 Create database & get credentials
```bash
# Create database
turso db create coloring-books

# Get the URL (you'll need this)
turso db show coloring-books --url
# → libsql://coloring-books-YOUR-HANDLE.turso.io

# Create auth token (you'll need this)
turso db tokens create coloring-books
# → eyJhbGciOiJF...
```

### 2.3 Push database schema
Set environment variables locally, then push the Prisma schema:
```bash
export TURSO_DATABASE_URL="libsql://coloring-books-YOUR-HANDLE.turso.io"
export TURSO_DIRECT_URL="libsql://coloring-books-YOUR-HANDLE.turso.io"
export TURSO_AUTH_TOKEN="YOUR_TOKEN"

bun run db:push
```

---

## Step 3: Deploy to Vercel

### 3.1 Import project
1. Go to **[vercel.com/new](https://vercel.com/new)**
2. Import your GitHub repository
3. Vercel auto-detects Next.js — keep default settings

### 3.2 Add environment variables
Before clicking Deploy, add these environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `TURSO_DATABASE_URL` | `libsql://coloring-books-YOUR-HANDLE.turso.io` | From Step 2.2 |
| `TURSO_DIRECT_URL` | `libsql://coloring-books-YOUR-HANDLE.turso.io` | Same as above |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOiJF...` | From Step 2.2 |
| `ZAI_API_KEY` | Your Z.AI API key | From z.ai dashboard |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Set after first deploy |

### 3.3 Create Vercel Blob Store
1. In Vercel dashboard → your project → **Storage** tab
2. Click **Create Blob Store** → name it `coloring-books`
3. Vercel auto-adds `BLOB_READ_WRITE_TOKEN` to environment variables

### 3.4 Deploy
Click **Deploy**. Wait for build to complete (~2-3 min).

---

## Step 4: Migrate Existing Data

After deployment, migrate your existing Pets book to Turso + Blob:

```bash
# Set all env vars locally (see .env.example)
export TURSO_DATABASE_URL="..."
export TURSO_AUTH_TOKEN="..."
export BLOB_READ_WRITE_TOKEN="..."

# Run migration script
bun run scripts/migrate-to-turso.ts
```

This uploads existing PDFs/thumbnails to Vercel Blob and creates Turso records.

---

## Step 5: Generate New Books in Production

The generation scripts run locally (they need Sharp + pdf-to-img which are heavy).
After generating locally, upload to production:

```bash
# 1. Generate images locally
bun run scripts/generate-images.ts pets

# 2. Process + build PDF locally
bun run scripts/regenerate-pdfs-no-covers.ts pets

# 3. Upload to Turso + Blob
bun run scripts/migrate-to-turso.ts
```

---

## Environment Variables Summary

Create a `.env.local` file (never commit) with:

```env
# Turso
TURSO_DATABASE_URL=libsql://coloring-books-YOUR-HANDLE.turso.io
TURSO_DIRECT_URL=libsql://coloring-books-YOUR-HANDLE.turso.io
TURSO_AUTH_TOKEN=your-turso-token

# Vercel Blob
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Z.AI
ZAI_API_KEY=your-zai-api-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Troubleshooting

### "PrismaClient is not defined"
Run `bun run db:generate` to regenerate the Prisma client after schema changes.

### "BLOB_READ_WRITE_TOKEN not set"
Create the Blob store in Vercel dashboard → Storage. The token is auto-added.

### Turso connection issues
Verify your URL and token:
```bash
turso db show coloring-books --url
turso db tokens create coloring-books
```

### Generation scripts fail on Vercel
The scripts use Sharp and pdf-to-img which may timeout in serverless. Run generation locally, then upload via `migrate-to-turso.ts`.
