# Standalone Python Coloring Book Generator

Generate Amazon KDP-ready coloring book PDFs using **OpenAI's gpt-image-2** model — running entirely on your local PC. This is a faithful Python port of the algorithms used by the web app, so PDFs produced here match the exact same quality and layout specifications.

## What This Is

A standalone, downloadable Python package that:

- Uses your **OpenAI API key** (with your $5 balance) — no other accounts needed
- Generates the same 18 books × ~30 items = **523 available coloring pages**
- Produces the same KDP-ready PDF layout (612×792 pt, 0.4" KDP margins)
- Applies the same auto-colorization algorithm (flood-fill with natural palettes)
- Enforces the **NO-WHITE rule** (white animals become light grey/beige so they're visible)
- Generates page thumbnails for preview

## Quick Start (5 minutes)

### Step 1 — Install Python 3.10+ and git

```bash
python --version   # must be 3.10 or newer
```

### Step 2 — Download this folder

Save all files from `python-coloring-book/` to a folder on your PC, e.g. `~/coloring-book/`.

### Step 3 — Set up a virtual environment

```bash
cd ~/coloring-book
python -m venv .venv

# Activate it:
# macOS/Linux:
source .venv/bin/activate
# Windows (PowerShell):
# .venv\Scripts\Activate.ps1
```

### Step 4 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 5 — Add your OpenAI API key

```bash
cp .env.example .env
# Edit .env and replace the placeholder:
#   OPENAI_API_KEY=sk-proj-...
```

Get your key from <https://platform.openai.com/api-keys> — your $5 balance is already on your OpenAI account.

### Step 6 — List available books

```bash
python main.py --list
```

You'll see 18 books (Dinosaurs, Dragons, Pets, Birds, etc.) with 523 items total.

### Step 7 — Test with a tiny batch first (recommended!)

Before generating a full book, test with 3 images (~$0.13 at medium quality):

```bash
python main.py --book Dinosaurs --limit 3
```

This generates images for T-Rex, Triceratops, Stegosaurus → builds a 3-page PDF.

### Step 8 — Generate a full book

Once you're happy with the quality, generate the full 30-page book:

```bash
python main.py --book Dinosaurs
```

PDF will be saved to: `output/Dinosaurs-Coloring-Book.pdf`

## Cost Planning for Your $5 Budget

OpenAI's gpt-image-2 pricing (per 1024×1024 image):

| Quality | Price per image | With $5 you can generate |
|---|---|---|
| **low** | $0.011 | ~454 images (~15 full books) |
| **medium** | $0.042 | ~119 images (~4 full books) |
| **high** | $0.167 | ~30 images (1 full book) |

### Recommended Strategy with $5

```bash
# 1. Test 3 images at medium quality ($0.13)
python main.py --book Dinosaurs --limit 3 --quality medium

# 2. If quality is good, generate the full 30-page book ($1.26)
python main.py --book Dinosaurs --quality medium

# 3. Repeat for other books (you can do ~3 full books at medium quality)
python main.py --book Dragons --quality medium
python main.py --book Pets --quality medium
```

**For tighter budgets**, use `--quality low` to get 15 full books from $5 (visually slightly less detailed but still good coloring-book quality):

```bash
python main.py --book Dinosaurs --quality low
```

### Always dry-run first

```bash
python main.py --book Dinosaurs --limit 5 --dry-run
# Output:
#   Estimated cost: $0.210
#   Your budget:    $5.00
#   ✅ Within budget — $4.790 remaining after this run.
```

## Command Reference

```bash
# List all available books (no API calls, free)
python main.py --list

# Estimate cost without spending anything
python main.py --book Pets --limit 5 --dry-run

# Generate 5 images and build a 5-page PDF
python main.py --book Pets --limit 5

# Generate a full 30-page book at high quality (premium quality, ~$5 per book)
python main.py --book Unicorns-Fairies --quality high

# Use the cheaper mini model (much less detailed, ~$0.005/image at low quality)
python main.py --book Pets --limit 10 --model gpt-image-1-mini --quality low

# Rebuild PDF from already-downloaded images (no API calls — totally free!)
python main.py --book Dinosaurs --no-generate

# Skip thumbnail generation (faster, but you can't preview in a gallery)
python main.py --book Dinosaurs --no-thumbnails

# Custom starting budget (default is $5 — adjust to track your real balance)
python main.py --book Dinosaurs --budget 3.50

# Lower concurrency (default is 3 — OpenAI tier-1 limit is 5 image gen requests/min)
python main.py --book Dinosaurs --concurrency 2
```

## File Structure

After running, your `output/` folder looks like:

```
output/
├── Dinosaurs-Coloring-Book.pdf     ← the final PDF you upload to KDP
├── Dinosaurs-metadata.json         ← metadata for the web app
├── thumbnails/
│   └── Dinosaurs/
│       ├── page-1.png              ← 280px wide preview thumbnails
│       ├── page-2.png
│       └── ...
└── Dinosaurs/                      ← working directory
    ├── bw/                         ← raw AI-generated B&W images (1024×1024)
    │   ├── T-Rex.png
    │   ├── Triceratops.png
    │   └── ...
    └── clean/                      ← cleaned + colorized versions
        ├── T-Rex-bw.png            ← cleaned B&W line art
        ├── T-Rex-color.png         ← auto-colorized reference
        └── ...
```

## How It Works (Algorithm Parity)

This Python port faithfully reproduces the TypeScript algorithms from the web app:

### Image Cleanup (`image_pipeline.py:clean_bw_image`)
1. Greyscale + flatten alpha on white
2. Resize to 1024×1024 (cover fit)
3. Threshold at 100 → pure black/white
4. Erode black lines by 30% (thin them) using neighbor-count erosion

### Auto-Colorize (`image_pipeline.py:colorize_image`)
1. Resize to 1000×1000 on a 1024×1024 white canvas (12px padding prevents edge-touching)
2. Build two masks: `orig_mask` (real outline) and `fill_mask` (dilated 4× to seal gaps)
3. Flood-fill 8-connected regions on `fill_mask`; keep enclosed (non-border-touching) regions
4. Find BODY region via center flood-fill (so large bodies are colored even with line gaps)
5. Combine regions (body first, then largest-first)
6. EXPAND each region outward against `orig_mask` — fills the gap between gap-closed boundary and real outline
7. Border-flood-fill to mark background → fill any white inside the subject with body color (no rectangular box artifact)
8. Apply palette colors: `region[i] → palette[i % len(palette)]`

### PDF Layout (`build_pdf.py`)
- Page: 612×792 pt (8.5"×11" @ 72 dpi) — KDP standard
- Margins: 29pt (0.4", KDP minimum)
- Per page:
  - Colored reference: 86×86 at (29, 29)
  - B&W coloring image: 380×380 centered at (116, 132)
  - Title: 24pt Helvetica-Bold, #333333, centered, y=527
  - Page number: 10pt Helvetica, #CCCCCC, bottom-right at (546, 740)

## Troubleshooting

**"OPENAI_API_KEY not set"**
→ You forgot to copy `.env.example` to `.env` and paste your key. The `.env` file must be in the same folder as `main.py`.

**Rate limit errors (HTTP 429)**
→ OpenAI tier-1 allows 5 image generations per minute. The script defaults to concurrency=3 to stay under this. If you still hit limits, run with `--concurrency 2` or `--concurrency 1`.

**"No book matches 'X'"**
→ Use `python main.py --list` to see exact slugs. Match is case-insensitive on slug/category/name.

**Image quality not as good as the web app**
→ The web app uses z-ai-web-dev-sdk (which produces FLUX.1-dev-quality images). For matching quality, use `--quality medium` (default). For premium quality, use `--quality high` (~4× more expensive).

**Want to verify before spending money?**
→ Use `--dry-run` to estimate cost, or `--no-generate` to rebuild a PDF from previously-downloaded images.

## Quality vs. the Web App

| Aspect | Web app (z-ai-web-dev-sdk) | This Python script (gpt-image-2) |
|---|---|---|
| Image quality | FLUX.1-dev level | Slightly better (OpenAI's latest) |
| Image style | Coloring book B&W line art | Same (we use the same prompt) |
| Auto-colorization | Identical | **Identical** (same algorithm) |
| PDF layout | Identical | **Identical** (same constants) |
| KDP compliance | ✅ | ✅ |
| Cost per image | Free in sandbox | $0.011–$0.167/image |

The image cleanup, colorization, and PDF layout are **byte-for-byte compatible** with the web app's output. The only difference is which AI model produces the raw B&W line art.

## License & Credits

This is a derivative work of the Coloring Book PDF Generator project. Algorithms ported from `src/lib/coloring-data.ts`, `scripts/image-pipeline.ts`, and `scripts/regenerate-pdfs-no-covers.ts` with full algorithm parity.
