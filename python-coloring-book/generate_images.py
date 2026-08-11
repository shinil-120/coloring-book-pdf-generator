"""
OpenAI gpt-image-2 image generation — Python port of scripts/generate-images.ts.

Features:
  - Uses OpenAI Python SDK with `gpt-image-2` (default) or `gpt-image-1` / `gpt-image-1-mini`
  - Coloring-book-style prompt builder (matches the original)
  - Automatic retry with exponential backoff on 429 / 5xx errors
  - Per-image budget tracking (warns when spend exceeds $5)
  - Skip already-generated images (resumable batches)
  - Concurrency-limited (3 parallel requests by default — OpenAI's tier-1 limit)
  - Progress bar via tqdm

Usage (called from main.py — see --help there):
  python generate_images.py --book dinosaurs --limit 5
"""
from __future__ import annotations

import base64
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

from openai import OpenAI, RateLimitError, APIStatusError
from tqdm import tqdm

from config import (
    OPENAI_API_KEY, OPENAI_MODEL, OPENAI_QUALITY, OPENAI_SIZE,
    book_dirs, price_per_image, estimate_cost, require_api_key,
)
from coloring_data import BOOKS, category_suffix

# Safety: refuse to spend more than this without explicit confirmation
BUDGET_WARN_USD = 5.0
DEFAULT_CONCURRENCY = 3


def build_prompt(item: str, category: str) -> str:
    """Build a coloring-book-style prompt — matches scripts/generate-images.ts."""
    suffix = category_suffix(category)
    return (
        f"Black and white line drawing coloring page for kids of a {item} {suffix}. "
        "Simple clean outline, no shading, no gray tones, thick black lines on white "
        "background, suitable for children coloring book, cartoon style, cute and "
        "friendly, single subject centered on page, full body visible"
    )


class BudgetTracker:
    """Tracks total spend across image generations in this run."""

    def __init__(self, starting_balance_usd: float = 5.0):
        self.starting_balance = starting_balance_usd
        self.spent = 0.0
        self.image_count = 0
        self.fail_count = 0

    def add_image(self, cost_usd: float) -> None:
        self.spent += cost_usd
        self.image_count += 1
        if self.spent > BUDGET_WARN_USD:
            print(f"  ⚠️  Spent ${self.spent:.3f} so far (warning threshold: ${BUDGET_WARN_USD})")

    def report(self) -> str:
        remaining = max(0.0, self.starting_balance - self.spent)
        return (
            f"\n📊 Budget report:\n"
            f"   Images generated: {self.image_count}\n"
            f"   Failures:         {self.fail_count}\n"
            f"   Total spent:      ${self.spent:.3f}\n"
            f"   Remaining:        ${remaining:.3f} (of ${self.starting_balance:.2f})"
        )


def generate_one(
    client: OpenAI,
    item: str,
    category: str,
    out_path: Path,
    tracker: BudgetTracker,
    max_retries: int = 3,
) -> bool:
    """Generate one image and save as PNG. Returns True on success."""
    if out_path.exists() and out_path.stat().st_size > 5_000:
        # Already generated — skip (resumable batches)
        return True

    prompt = build_prompt(item, category)

    for attempt in range(1, max_retries + 1):
        try:
            response = client.images.generate(
                model=OPENAI_MODEL,
                prompt=prompt,
                size=OPENAI_SIZE,
                quality=OPENAI_QUALITY,
                n=1,
            )
            # OpenAI returns base64 (gpt-image-1/2) or URL (dall-e-3)
            data = response.data[0]
            if getattr(data, "b64_json", None):
                img_bytes = base64.b64decode(data.b64_json)
            elif getattr(data, "url", None):
                import urllib.request
                with urllib.request.urlopen(data.url) as r:
                    img_bytes = r.read()
            else:
                raise RuntimeError("OpenAI returned neither b64_json nor url")

            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(img_bytes)
            tracker.add_image(price_per_image())
            return True

        except RateLimitError as e:
            if attempt < max_retries:
                wait = 5 * attempt
                print(f"      ⏳ rate-limited, retry in {wait}s: {str(e)[:100]}")
                time.sleep(wait)
                continue
            tracker.fail_count += 1
            print(f"      ✗ {item}: rate-limit exhausted")
            return False

        except APIStatusError as e:
            if 500 <= e.status_code < 600 and attempt < max_retries:
                wait = 3 * attempt
                print(f"      ⏳ server error {e.status_code}, retry in {wait}s")
                time.sleep(wait)
                continue
            tracker.fail_count += 1
            print(f"      ✗ {item}: HTTP {e.status_code} — {str(e)[:200]}")
            return False

        except Exception as e:
            if attempt < max_retries:
                wait = 3 * attempt
                print(f"      ⚠️  error (retry {attempt}/{max_retries} in {wait}s): {str(e)[:120]}")
                time.sleep(wait)
                continue
            tracker.fail_count += 1
            print(f"      ✗ {item}: {str(e)[:200]}")
            return False

    return False


def generate_book_images(
    book_slug: str,
    limit: Optional[int] = None,
    starting_balance_usd: float = 5.0,
    concurrency: int = DEFAULT_CONCURRENCY,
) -> tuple[int, int, BudgetTracker]:
    """
    Generate images for all items in a single book.

    Args:
      book_slug: e.g. "Dinosaurs" (case-insensitive match on slug/category/name)
      limit: only generate the first N items (useful for testing)
      starting_balance_usd: assumed starting balance for budget tracking
      concurrency: parallel requests (OpenAI tier-1 limit is 5/min for image gen)

    Returns: (success_count, fail_count, tracker)
    """
    # Find matching book
    book = None
    for b in BOOKS:
        if (
            book_slug.lower() in b["slug"].lower()
            or book_slug.lower() in b["category"].lower()
            or book_slug.lower() in b["name"].lower()
        ):
            book = b
            break
    if not book:
        print(f"❌ No book matches '{book_slug}'. Available:")
        for b in BOOKS:
            print(f"   {b['slug']:25s}  ({len(b['items'])} items)")
        return 0, 0, BudgetTracker(0)

    items = book["items"]
    if limit:
        items = items[:limit]

    print(f"\n📖 {book['name']} — generating {len(items)} of {len(book['items'])} items")
    print(f"   Model: {OPENAI_MODEL}, quality: {OPENAI_QUALITY}, size: {OPENAI_SIZE}")
    print(f"   Estimated cost: ${estimate_cost(len(items)):.3f} "
          f"(${price_per_image():.3f}/image)")
    print(f"   Concurrency: {concurrency}")
    print()

    dirs = book_dirs(book["slug"])
    dirs["bw"].mkdir(parents=True, exist_ok=True)

    # Validate the API key before any network call
    require_api_key()
    client = OpenAI(api_key=OPENAI_API_KEY)
    tracker = BudgetTracker(starting_balance_usd)

    # Pre-flight: filter out already-generated items
    pending = [(item, dirs["bw"] / f"{item}.png") for item in items]
    to_generate = [(item, p) for item, p in pending if not (p.exists() and p.stat().st_size > 5_000)]
    if len(to_generate) < len(pending):
        print(f"   ℹ️  {len(pending) - len(to_generate)} already generated — skipping (resumable)")
    if not to_generate:
        print(f"   ✅ All {len(pending)} images already exist — nothing to do")
        return len(pending), 0, tracker

    print(f"   Generating {len(to_generate)} new images…\n")

    success = len(pending) - len(to_generate)  # count pre-existing as successes
    fail = 0

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = {
            pool.submit(generate_one, client, item, book["category"], path, tracker): item
            for item, path in to_generate
        }
        with tqdm(total=len(futures), desc="Generating", ncols=80) as pbar:
            for fut in as_completed(futures):
                item = futures[fut]
                ok = fut.result()
                if ok:
                    success += 1
                else:
                    fail += 1
                pbar.set_postfix_str(f"{item[:20]}", refresh=True)
                pbar.update(1)

    print(tracker.report())
    return success, fail, tracker
