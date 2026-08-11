"""
Main orchestrator — runs the full pipeline:

  1. Generate AI images (gpt-image-2) → output/{slug}/bw/{item}.png
  2. Clean B&W + auto-colorize             → output/{slug}/clean/{item}-bw.png, -color.png
  3. Build KDP-ready PDF                   → output/{slug}-Coloring-Book.pdf
  4. Render page thumbnails                → output/thumbnails/{slug}/page-N.png
  5. Write metadata JSON                   → output/{slug}-metadata.json

Usage examples (run from this folder):

  # First time setup
  pip install -r requirements.txt
  cp .env.example .env
  # Edit .env and paste your OPENAI_API_KEY

  # List available books (no API calls, no cost)
  python main.py --list

  # Generate just 3 images as a $0.13 quality test (medium quality, $0.042/image)
  python main.py --book Dinosaurs --limit 3

  # Generate a full 30-page book (~$1.26 at medium quality)
  python main.py --book Dinosaurs

  # Generate using a different model / quality / size (overrides .env)
  python main.py --book Pets --limit 5 --model gpt-image-1-mini --quality low

  # Skip image generation (use already-downloaded B&W images) — just rebuild PDF
  python main.py --book Dinosaurs --no-generate

  # Estimate cost without spending anything
  python main.py --book Dinosaurs --limit 5 --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Ensure local imports work when run as `python main.py` from the script dir
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Import config (validates OPENAI_API_KEY unless --list or --dry-run)
import config
from coloring_data import BOOKS
from generate_images import generate_book_images
from build_pdf import build_book


def list_books() -> None:
    print("\n📚 Available coloring books (18 total, 523 items):\n")
    print(f"  {'SLUG':<25}  {'CATEGORY':<22}  {'ITEMS':>5}  FULL NAME")
    print(f"  {'-' * 25}  {'-' * 22}  {'-' * 5}  {'-' * 40}")
    for b in BOOKS:
        print(f"  {b['slug']:<25}  {b['category']:<22}  {len(b['items']):>5}  {b['name']}")
    print()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Standalone Python Coloring Book Generator (gpt-image-2)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--list", action="store_true",
                   help="List all available books and exit (no API calls)")
    p.add_argument("--book", metavar="SLUG", default=None,
                   help="Book slug/category/name (case-insensitive). Required unless --list.")
    p.add_argument("--limit", type=int, default=None,
                   help="Only generate the first N items (useful for testing).")
    p.add_argument("--no-generate", action="store_true",
                   help="Skip image generation — only process existing B&W images and build the PDF.")
    p.add_argument("--no-thumbnails", action="store_true",
                   help="Skip thumbnail generation (faster).")
    p.add_argument("--dry-run", action="store_true",
                   help="Show estimated cost and exit without making any API calls.")
    p.add_argument("--budget", type=float, default=5.0,
                   help="Your starting OpenAI balance in USD (default: 5.0). Used for budget tracking.")
    p.add_argument("--concurrency", type=int, default=3,
                   help="Parallel image generation requests (default: 3). OpenAI tier-1 limit is 5/min.")
    p.add_argument("--model", default=None,
                   help="Override OpenAI model (e.g. gpt-image-2, gpt-image-1, gpt-image-1-mini).")
    p.add_argument("--quality", choices=["low", "medium", "high"], default=None,
                   help="Override image quality (low/medium/high).")
    p.add_argument("--size", default=None,
                   help="Override image size (1024x1024, 1024x1536, 1536x1024).")
    return p.parse_args()


def apply_overrides(args: argparse.Namespace) -> None:
    """Apply CLI overrides to the config module."""
    if args.model:
        config.OPENAI_MODEL = args.model
        os.environ["OPENAI_MODEL"] = args.model
    if args.quality:
        config.OPENAI_QUALITY = args.quality
        os.environ["OPENAI_QUALITY"] = args.quality
    if args.size:
        config.OPENAI_SIZE = args.size
        os.environ["OPENAI_SIZE"] = args.size


def main() -> None:
    args = parse_args()

    # ── Mode: list books (no API key required) ─────────────────────────
    if args.list:
        list_books()
        return

    if not args.book:
        print("❌ --book is required (or use --list to see available books).")
        sys.exit(2)

    # For --dry-run we don't need OPENAI_API_KEY to be valid
    if not args.dry_run:
        # config module already validated OPENAI_API_KEY on import
        pass

    apply_overrides(args)

    # ── Find the matching book ─────────────────────────────────────────
    matches = [
        b for b in BOOKS
        if args.book.lower() in b["slug"].lower()
        or args.book.lower() in b["category"].lower()
        or args.book.lower() in b["name"].lower()
    ]
    if not matches:
        print(f"❌ No book matches '{args.book}'. Use --list to see available books.")
        sys.exit(1)
    if len(matches) > 1:
        print(f"⚠️  '{args.book}' matched multiple books. Refine your query:")
        for b in matches:
            print(f"   {b['slug']:<25}  {b['name']}")
        sys.exit(1)
    book = matches[0]

    # Determine the items list
    items = book["items"]
    if args.limit:
        items = items[:args.limit]

    # ── Dry-run: just estimate cost and exit ───────────────────────────
    if args.dry_run:
        from config import price_per_image, estimate_cost
        n = len(items)
        per = price_per_image()
        total = estimate_cost(n)
        print("\n💰 Dry-run cost estimate")
        print(f"   Book:           {book['name']}")
        print(f"   Items to gen:   {n} of {len(book['items'])}")
        print(f"   Model:          {config.OPENAI_MODEL}")
        print(f"   Quality:        {config.OPENAI_QUALITY}")
        print(f"   Size:           {config.OPENAI_SIZE}")
        print(f"   Price/image:    ${per:.3f}")
        print(f"   ─────────────────────────────")
        print(f"   Estimated cost: ${total:.3f}")
        print(f"   Your budget:    ${args.budget:.2f}")
        if total > args.budget:
            print(f"\n   ⚠️  This exceeds your budget by ${total - args.budget:.3f}!")
            print(f"      Consider: --quality low (~$0.011/image) or --limit N to reduce count.")
        else:
            print(f"\n   ✅ Within budget — ${args.budget - total:.3f} remaining after this run.")
        return

    # ── Step 1: Generate images (gpt-image-2) ──────────────────────────
    if args.no_generate:
        print(f"\n⏭  Skipping image generation (--no-generate) — using existing B&W images only.")
    else:
        # Re-check API key — dry-run was skipped above
        from config import require_api_key
        require_api_key()
        success, fail, tracker = generate_book_images(
            book_slug=book["slug"],
            limit=args.limit,
            starting_balance_usd=args.budget,
            concurrency=args.concurrency,
        )
        if fail > 0 and success == 0:
            print(f"\n❌ All {fail} generations failed. Aborting PDF build.")
            sys.exit(1)

    # ── Step 2-5: Clean, colorize, build PDF, thumbnails, metadata ─────
    metadata = build_book(book, items=items, skip_thumbnails=args.no_thumbnails)

    print("\n✨ Done!")
    print(f"   PDF: {config.book_dirs(book['slug'])['pdf']}")
    print(f"   Size: {metadata['size']}")
    print(f"   Pages: {metadata['pages']}")


if __name__ == "__main__":
    main()
