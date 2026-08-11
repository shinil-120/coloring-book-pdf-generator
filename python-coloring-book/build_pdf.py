"""
PDF assembly — Python port of scripts/regenerate-pdfs-no-covers.ts.

Builds an Amazon KDP-ready coloring book PDF:
  - Page size: 612 × 792 (8.5" × 11" @ 72 dpi)
  - Margins: KDP-compliant 0.4" (29pt) on all sides
  - One page per item:
      • Colored reference thumbnail (86×86) top-left
      • B&W line-art image (380×380) centered
      • Title text (24pt Helvetica-Bold, centered, y=527)
      • Page number (10pt Helvetica, bottom-right)
  - Generates page thumbnails (280px wide PNGs) for preview

Uses reportlab for PDF generation + PyMuPDF (fitz) for thumbnail rendering.
"""
from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Optional

from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import pymupdf as fitz  # PyMuPDF — modern import (avoids deprecation warning)
from tqdm import tqdm

from config import OUTPUT_DIR, book_dirs
from coloring_data import (
    BOOKS,
    PAGE_WIDTH, PAGE_HEIGHT,
    REF_SIZE, REF_X, REF_Y,
    BW_SIZE, BW_X, BW_Y,
    TITLE_Y, PAGE_NUM_X, PAGE_NUM_Y,
)
from image_pipeline import process_item


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def format_bytes(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / (1024 * 1024):.2f} MB"


def format_readable_ist(d: dt.datetime) -> str:
    """Format datetime as IST (UTC+5:30) — matches the web app's timestamps."""
    ist = d + dt.timedelta(hours=5, minutes=30)
    return ist.strftime("%b %d, %Y, %I:%M %p IST")


def slugify(s: str) -> str:
    import re
    s = s.replace("&", "and")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s)
    s = re.sub(r"^-+|-+$", "", s)
    return s


# ─────────────────────────────────────────────────────────────────────────────
# Build a single PDF for one book
# ─────────────────────────────────────────────────────────────────────────────

def build_book_pdf(book: dict, items: list[str]) -> tuple[Path, int, int]:
    """
    Returns: (pdf_path, page_count, size_bytes)
    """
    slug = book["slug"]
    dirs = book_dirs(slug)
    dirs["base"].mkdir(parents=True, exist_ok=True)
    dirs["clean"].mkdir(parents=True, exist_ok=True)

    pdf_path = dirs["pdf"]
    pdf_path.parent.mkdir(parents=True, exist_ok=True)

    # ── Step 1: Process all items first (clean B&W + colorize) ──────────
    print(f"  [{slug}] processing {len(items)} items…")
    processed: list[tuple[str, Path, Path]] = []
    for i, item in enumerate(items, start=1):
        print(f"    ({i}/{len(items)}) {item}… ", end="", flush=True)
        try:
            bw_path, color_path = process_item(dirs["base"], item, book["category"])
            processed.append((item, bw_path, color_path))
            print("ok")
        except Exception as e:
            print(f"FAILED: {e}")

    if not processed:
        raise RuntimeError(f"No items processed for {book['name']}")

    # ── Step 2: Build PDF with reportlab ────────────────────────────────
    print(f"  [{slug}] building PDF…")
    c = canvas.Canvas(
        str(pdf_path),
        pagesize=(PAGE_WIDTH, PAGE_HEIGHT),
    )
    c.setTitle(book["name"])
    c.setAuthor("Coloring Book Studio")
    c.setSubject("Amazon KDP Coloring Book")

    for i, (item, bw_path, color_path) in enumerate(processed):
        if i > 0:
            c.showPage()

        # 1. Colored reference (86×86 at top-left, KDP-compliant position)
        try:
            img = ImageReader(str(color_path))
            c.drawImage(img, REF_X, PAGE_HEIGHT - REF_Y - REF_SIZE,
                        width=REF_SIZE, height=REF_SIZE, preserveAspectRatio=True, mask="auto")
        except Exception:
            c.setFillColorRGB(0.8, 0.8, 0.8)
            c.rect(REF_X, PAGE_HEIGHT - REF_Y - REF_SIZE, REF_SIZE, REF_SIZE, fill=1, stroke=0)

        # 2. B&W coloring image (380×380 centered horizontally)
        try:
            img = ImageReader(str(bw_path))
            c.drawImage(img, BW_X, PAGE_HEIGHT - BW_Y - BW_SIZE,
                        width=BW_SIZE, height=BW_SIZE, preserveAspectRatio=True, mask="auto")
        except Exception:
            c.setFillColorRGB(0.96, 0.96, 0.96)
            c.rect(BW_X, PAGE_HEIGHT - BW_Y - BW_SIZE, BW_SIZE, BW_SIZE, fill=1, stroke=0)
            c.setStrokeColorRGB(0.87, 0.87, 0.87)
            c.setLineWidth(1)
            c.rect(BW_X, PAGE_HEIGHT - BW_Y - BW_SIZE, BW_SIZE, BW_SIZE, fill=0, stroke=1)

        # 3. Title (24pt Helvetica-Bold, #333333, centered, y=527)
        # Note: reportlab's y is from bottom, so we use PAGE_HEIGHT - TITLE_Y
        c.setFillColorRGB(0.2, 0.2, 0.2)  # #333333
        c.setFont("Helvetica-Bold", 24)
        title_y_from_bottom = PAGE_HEIGHT - TITLE_Y
        c.drawCentredString(PAGE_WIDTH / 2, title_y_from_bottom, item)

        # 4. Page number (10pt Helvetica, #CCCCCC, right-aligned at 546,740)
        c.setFillColorRGB(0.8, 0.8, 0.8)  # #CCCCCC
        c.setFont("Helvetica", 10)
        page_num_y_from_bottom = PAGE_HEIGHT - PAGE_NUM_Y
        c.drawRightString(PAGE_NUM_X, page_num_y_from_bottom, str(i + 1))

    c.save()

    size_bytes = pdf_path.stat().st_size
    return pdf_path, len(processed), size_bytes


# ─────────────────────────────────────────────────────────────────────────────
# Generate thumbnails with PyMuPDF (fitz)
# ─────────────────────────────────────────────────────────────────────────────

def generate_thumbnails(pdf_path: Path, slug: str, page_count: int) -> None:
    thumb_dir = book_dirs(slug)["thumbs"]
    thumb_dir.mkdir(parents=True, exist_ok=True)

    print(f"  [{slug}] generating {page_count} thumbnails…")
    doc = fitz.open(str(pdf_path))
    for i, page in enumerate(tqdm(doc, desc="Thumbnails", ncols=80, total=page_count)):
        if i >= page_count:
            break
        # scale 1.2 → matches pdf-to-img's scale; then resize to 280px wide
        pix = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2))
        # Convert to PIL for resize
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        if img.width > 280:
            new_h = int(round(img.height * 280 / img.width))
            img = img.resize((280, new_h), Image.LANCZOS)
        img.save(thumb_dir / f"page-{i + 1}.png", format="PNG")
    doc.close()
    print(f"  [{slug}] thumbnails done ({page_count} pages)")


# ─────────────────────────────────────────────────────────────────────────────
# Build metadata JSON (same format as the web app)
# ─────────────────────────────────────────────────────────────────────────────

def write_metadata(book: dict, items: list[str], page_count: int, size_bytes: int) -> dict:
    now = dt.datetime.utcnow()
    slug = book["slug"]
    return {
        "name": book["name"],
        "url": f"/downloads/{slug}-Coloring-Book.pdf",
        "slug": slug,
        "size": format_bytes(size_bytes),
        "sizeBytes": size_bytes,
        "pages": page_count,
        "category": book["category"],
        "timestamp": now.isoformat() + "Z",
        "readableTime": format_readable_ist(now),
        "description": (
            book["description"] if len(items) == len(book["items"])
            else f"{len(items)} pages — no covers, no blanks"
        ),
        "items": items,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: full build (process items → PDF → thumbnails → metadata)
# ─────────────────────────────────────────────────────────────────────────────

def build_book(
    book: dict,
    items: Optional[list[str]] = None,
    skip_thumbnails: bool = False,
) -> dict:
    if items is None:
        items = book["items"]

    print(f"\n📖 {book['name']} ({len(items)} items)")

    pdf_path, page_count, size_bytes = build_book_pdf(book, items)

    if not skip_thumbnails:
        generate_thumbnails(pdf_path, book["slug"], page_count)

    metadata = write_metadata(book, items, page_count, size_bytes)
    print(f"  ✅ {book['name']}: {page_count} pages, {format_bytes(size_bytes)}")
    print(f"     PDF:        {pdf_path}")
    print(f"     Thumbnails: {book_dirs(book['slug'])['thumbs']}")

    # Save metadata JSON alongside the PDF
    meta_path = OUTPUT_DIR / f"{book['slug']}-metadata.json"
    import json
    meta_path.write_text(json.dumps(metadata, indent=2))
    print(f"     Metadata:   {meta_path}")

    return metadata
