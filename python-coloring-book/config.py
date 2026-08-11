"""
Configuration — loaded from environment variables / .env file.
All paths are relative to the script's directory so the package is portable.
"""
from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the script's directory
SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

# ─── OpenAI API ───────────────────────────────────────────────────────────────
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-image-2").strip()
OPENAI_QUALITY: str = os.getenv("OPENAI_QUALITY", "medium").strip().lower()
OPENAI_SIZE: str = os.getenv("OPENAI_SIZE", "1024x1024").strip()

# ─── Pricing (per image, in USD) — used for budget tracking ─────────────────
# Source: https://developers.openai.com/api/docs/pricing (as of late 2025)
# These are approximate — verify on the pricing page before relying on them.
PRICING = {
    "gpt-image-2":     {"low": 0.011, "medium": 0.042, "high": 0.167},
    "gpt-image-1":     {"low": 0.011, "medium": 0.042, "high": 0.167},
    "gpt-image-1.5":   {"low": 0.011, "medium": 0.042, "high": 0.167},
    "gpt-image-1-mini": {"low": 0.005, "medium": 0.011, "high": 0.041},
}

# ─── Paths ────────────────────────────────────────────────────────────────────
OUTPUT_DIR: Path = Path(os.getenv("OUTPUT_DIR", str(SCRIPT_DIR / "output"))).resolve()

# Per-book working directories: output/{slug}/{bw,clean}/, output/{slug}-Coloring-Book.pdf
def book_dirs(slug: str) -> dict[str, Path]:
    base = OUTPUT_DIR / slug
    return {
        "base": base,
        "bw": base / "bw",         # raw AI B&W images
        "clean": base / "clean",   # cleaned B&W + colorized versions
        "pdf": OUTPUT_DIR / f"{slug}-Coloring-Book.pdf",
        "thumbs": OUTPUT_DIR / "thumbnails" / slug,
    }

# ─── Validation ──────────────────────────────────────────────────────────────
# NOTE: We do NOT hard-fail on a missing OPENAI_API_KEY at import time, because
#       --list and --dry-run should work without a key. The actual image
#       generation entry point (generate_images.py + main.py's generate path)
#       performs an explicit check before contacting the OpenAI API.
if OPENAI_QUALITY not in {"low", "medium", "high"}:
    raise SystemExit(f"❌ OPENAI_QUALITY must be one of: low, medium, high (got {OPENAI_QUALITY!r})")

if OPENAI_SIZE not in {"1024x1024", "1024x1536", "1536x1024"}:
    raise SystemExit(
        f"❌ OPENAI_SIZE must be 1024x1024, 1024x1536, or 1536x1024 (got {OPENAI_SIZE!r})"
    )


def require_api_key() -> str:
    """Raise a clear error if the API key isn't set. Call this before any
    network request to OpenAI (not at import time, so --list and --dry-run
    can run without a key)."""
    if not OPENAI_API_KEY:
        raise SystemExit(
            "\n❌ OPENAI_API_KEY not set.\n"
            "   Copy .env.example → .env and paste your OpenAI API key.\n"
            "   Get one at https://platform.openai.com/api-keys\n"
        )
    return OPENAI_API_KEY


def price_per_image() -> float:
    """Return the estimated USD cost per generated image at current settings."""
    return PRICING.get(OPENAI_MODEL, PRICING["gpt-image-2"]).get(OPENAI_QUALITY, 0.042)


def estimate_cost(num_images: int) -> float:
    return round(num_images * price_per_image(), 3)
