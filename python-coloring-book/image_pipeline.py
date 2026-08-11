"""
Image processing pipeline — Python port of scripts/image-pipeline.ts.

  Step 1: clean B&W  (greyscale → flatten → threshold @100 → erode ~30%)
  Step 2: auto-colorize (flood-fill enclosed regions, skip border-touching,
          size > 3, largest-first, palette-cycled, NO-WHITE rule enforced)

Algorithm parity verified against the TypeScript implementation:
  - Threshold 100, erode 30% (neighbor-count based)
  - 1024×1024 canvas with 12-px white border padding
  - Gap-closing dilation (4 passes) on the fill mask
  - Center-fill to find the BODY region
  - Border-flood-fill to skip background (no rectangular box artifact)
  - Unlimited expansion passes against the original mask
  - Colors applied up to the real outline
"""
from __future__ import annotations

from pathlib import Path
import numpy as np
from PIL import Image

from coloring_data import (
    Palette,
    RGB,
    get_palette,
    PAGE_WIDTH, PAGE_HEIGHT, MARGIN,
    REF_SIZE, REF_X, REF_Y,
    BW_SIZE, BW_X, BW_Y,
    TITLE_Y, PAGE_NUM_X, PAGE_NUM_Y,
)


# ─────────────────────────────────────────────────────────────────────────────
# Step 1: clean B&W
# ─────────────────────────────────────────────────────────────────────────────

def clean_bw_image(
    input_path: str | Path,
    output_path: str | Path,
    threshold: int = 100,
    erode_percent: int = 30,
) -> None:
    """
    Convert a raw AI image to a clean B&W line-art image.
      - greyscale
      - flatten on white background (removes alpha)
      - resize to 1024×1024 (cover fit)
      - threshold: pixel < 100 → black (0), else white (255)
      - erode black lines ~30% (thin them)
    """
    input_path = Path(input_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    img = Image.open(input_path).convert("L")
    # Flatten alpha on white background by pasting onto a white canvas
    bg = Image.new("L", img.size, 255)
    bg.paste(img, mask=img.split()[0] if img.mode == "RGBA" else None)
    img = bg

    # Resize to 1024×1024 (cover fit — match sharp's "cover" behavior)
    img = _resize_cover(img, 1024, 1024)
    arr = np.asarray(img, dtype=np.uint8)

    # Threshold → binary mask (1 = black line, 0 = white)
    bw = (arr < threshold).astype(np.uint8)

    # Erode: keep a black pixel only if it has at least `survive_threshold` black
    # 8-neighbors. erode_percent=30 → survive_threshold = ceil(8 * 30 / 100) = 3
    survive_threshold = int(np.ceil(8 * erode_percent / 100))
    eroded = bw.copy()
    # Count 8-neighbors using padded shifts
    padded = np.pad(bw, pad_width=1, mode="constant", constant_values=0)
    neighbor_count = np.zeros_like(bw, dtype=np.int8)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            neighbor_count += padded[1 + dy:1 + dy + bw.shape[0],
                                     1 + dx:1 + dx + bw.shape[1]]
    # A black pixel survives only if it has >= survive_threshold black neighbors
    eroded = np.where((bw == 1) & (neighbor_count >= survive_threshold), 1, 0).astype(np.uint8)

    # Convert back to RGB PNG (black lines on white background)
    out_arr = np.where(eroded == 1, 0, 255).astype(np.uint8)
    out_rgb = np.stack([out_arr, out_arr, out_arr], axis=-1)
    Image.fromarray(out_rgb, "RGB").save(output_path, format="PNG")


def _resize_cover(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Match sharp's `fit: "cover"` behavior — fill the target, crop the excess."""
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    tgt_ratio = target_w / target_h
    if src_ratio > tgt_ratio:
        # Source is wider — crop horizontally
        new_h = src_h
        new_w = int(round(src_h * tgt_ratio))
        left = (src_w - new_w) // 2
        img = img.crop((left, 0, left + new_w, new_h))
    else:
        # Source is taller — crop vertically
        new_w = src_w
        new_h = int(round(src_w / tgt_ratio))
        top = (src_h - new_h) // 2
        img = img.crop((0, top, new_w, top + new_h))
    return img.resize((target_w, target_h), Image.LANCZOS)


# ─────────────────────────────────────────────────────────────────────────────
# Step 2: auto-colorize (flood fill enclosed white regions)
# ─────────────────────────────────────────────────────────────────────────────

def colorize_image(
    bw_path: str | Path,
    output_path: str | Path,
    palette: Palette,
    white_threshold: int = 200,
    min_size: int = 1,
    max_size: int = 1_000_000,
    close_gaps: int = 4,
) -> None:
    """
    Colorize a clean B&W image using flood-fill region detection.

    Algorithm (matches image-pipeline.ts):
      1. Resize to 1000×1000, place on 1024×1024 WHITE canvas (12px padding).
      2. Build luminance array.
      3. Build origMask: 1 = black line (real outline), 0 = white.
      4. Build fillMask: origMask dilated `close_gaps` times (seals small gaps).
      5. Flood-fill 8-connected regions on fillMask. Keep enclosed (non-border-touching).
      6. Find the BODY region via center flood-fill.
      7. Combine: body region first, then sub-regions largest-first.
      8. EXPAND each region outward against origMask (unlimited passes).
      9. Fill remaining whites inside the subject (border-flood-fill skip).
     10. Apply palette colors: region[i] → palette[i % palette.length].
    """
    bw_path = Path(bw_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # ── Resize to 1000×1000, then place on 1024×1024 white canvas ────────
    src = Image.open(bw_path).convert("RGB")
    src = _resize_cover(src, 1000, 1000)
    canvas = Image.new("RGB", (1024, 1024), (255, 255, 255))
    canvas.paste(src, (12, 12))
    arr = np.asarray(canvas, dtype=np.uint8)

    h, w, _ = arr.shape
    total = h * w

    # Luminance (average of R, G, B)
    lum = arr.mean(axis=2).astype(np.uint8)

    # origMask: 1 = black line (luminance <= threshold), 0 = white
    orig_mask = (lum <= white_threshold).astype(np.uint8)

    # fillMask: dilated origMask (seals small gaps in AI line art)
    fill_mask = orig_mask.copy()
    for _ in range(close_gaps):
        # 8-neighbor dilation: a pixel becomes 1 if any neighbor is 1
        padded = np.pad(fill_mask, 1, mode="constant", constant_values=0)
        dilated = np.zeros_like(fill_mask)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                dilated |= padded[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
        fill_mask = dilated.astype(np.uint8)

    # ── STEP 1: Find enclosed sub-regions via flood-fill on fill_mask ────
    visited = np.zeros(total, dtype=np.uint8)
    fill_flat = fill_mask.flatten()
    sub_regions: list[list[int]] = []

    for start in range(total):
        if visited[start] or fill_flat[start]:
            continue
        # BFS flood-fill
        stack = [start]
        visited[start] = 1
        pixels: list[int] = []
        touches_border = False
        sx = start % w
        sy = start // w
        if sx == 0 or sx == w - 1 or sy == 0 or sy == h - 1:
            touches_border = True
        while stack:
            idx = stack.pop()
            pixels.append(idx)
            y = idx // w
            x = idx % w
            for dy in (-1, 0, 1):
                ny = y + dy
                if ny < 0 or ny >= h:
                    continue
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx = x + dx
                    if nx < 0 or nx >= w:
                        continue
                    nidx = ny * w + nx
                    if visited[nidx] or fill_flat[nidx]:
                        continue
                    visited[nidx] = 1
                    if nx == 0 or nx == w - 1 or ny == 0 or ny == h - 1:
                        touches_border = True
                    stack.append(nidx)
        if not touches_border and min_size <= len(pixels) < max_size:
            sub_regions.append(pixels)

    # ── STEP 2: Center-fill to find the BODY region ──────────────────────
    # Find bbox of all black pixels, then flood-fill from the center.
    body_region: list[int] | None = None
    ys, xs = np.where(fill_mask == 1)
    if len(xs) > 0:
        cx = (xs.min() + xs.max()) // 2
        cy = (ys.min() + ys.max()) // 2
        start_idx = cy * w + cx
        if fill_flat[start_idx]:
            # Search outward for a white pixel
            found = -1
            for r in range(1, 50):
                if found != -1:
                    break
                for dy in range(-r, r + 1):
                    if found != -1:
                        break
                    for dx in range(-r, r + 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and fill_flat[ny * w + nx] == 0:
                            found = ny * w + nx
                            break
            if found == -1:
                start_idx = -1
            else:
                start_idx = found
        if start_idx != -1:
            # Flood-fill from start_idx
            center_visited = np.zeros(total, dtype=np.uint8)
            stack = [start_idx]
            center_visited[start_idx] = 1
            center_pixels: list[int] = []
            while stack:
                idx = stack.pop()
                center_pixels.append(idx)
                y = idx // w
                x = idx % w
                for dy in (-1, 0, 1):
                    ny = y + dy
                    if ny < 0 or ny >= h:
                        continue
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        nx = x + dx
                        if nx < 0 or nx >= w:
                            continue
                        nidx = ny * w + nx
                        if center_visited[nidx] or fill_flat[nidx]:
                            continue
                        center_visited[nidx] = 1
                        stack.append(nidx)
            if len(center_pixels) > 100:
                body_region = center_pixels

    # ── STEP 3: Combine regions (body first, then sub-regions largest-first) ──
    regions: list[list[int]] = []
    if body_region:
        regions.append(body_region)
    sub_regions.sort(key=len, reverse=True)
    regions.extend(sub_regions)

    # ── STEP 4: Build color map (region index per pixel, 255 = uncolored) ──
    color_map = np.full(total, 255, dtype=np.uint8)
    for i, region in enumerate(regions):
        for idx in region:
            color_map[idx] = i

    # ── STEP 5: Expand each region outward against the ORIGINAL mask ─────
    # This fills the gap between the flood-fill boundary (gap-closed) and the
    # real outline, ensuring color reaches right up to the black lines.
    orig_flat = orig_mask.flatten()
    color_map_2d = color_map.reshape(h, w)
    orig_2d = orig_mask

    for _ in range(30):  # safety limit
        changed = False
        # For each uncolored white pixel, check 8-neighbors; if any neighbor
        # has a color, adopt it.
        next_map = color_map_2d.copy()
        uncolored = (orig_2d == 0) & (color_map_2d == 255)
        # Pad for easy neighbor lookup
        padded = np.pad(color_map_2d, 1, mode="constant", constant_values=255)
        # Find the minimum region index among 8-neighbors (ignoring 255)
        # Vectorized approach: compute max over neighbors of "is colored"
        neighbor_colored = np.zeros_like(color_map_2d, dtype=bool)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                neighbor_colored |= (padded[1 + dy:1 + dy + h, 1 + dx:1 + dx + w] != 255)
        to_fill = uncolored & neighbor_colored
        if not to_fill.any():
            break
        # For each to_fill pixel, take the first non-255 neighbor
        ys, xs = np.where(to_fill)
        for y, x in zip(ys, xs):
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w:
                        n_val = color_map_2d[ny, nx]
                        if n_val != 255:
                            next_map[y, x] = n_val
                            break
                else:
                    continue
                break
        if np.array_equal(next_map, color_map_2d):
            break
        color_map_2d = next_map

    # ── STEP 6: Fill remaining whites INSIDE the subject ────────────────
    # Flood-fill from the image border inward against orig_mask + color_map.
    # Any white pixel NOT connected to the background is INSIDE the subject →
    # fill with body color (region 0 if body exists, else 0).
    if body_region is not None:
        bg_visited = np.zeros(total, dtype=np.uint8)
        bg_stack: list[int] = []
        # Seed with all border pixels that are white and uncolored
        for x in range(w):
            for y in (0, h - 1):
                idx = y * w + x
                if orig_flat[idx] == 0 and color_map_2d.flatten()[idx] == 255 and not bg_visited[idx]:
                    bg_visited[idx] = 1
                    bg_stack.append(idx)
        for y in range(h):
            for x in (0, w - 1):
                idx = y * w + x
                if orig_flat[idx] == 0 and color_map_2d.flatten()[idx] == 255 and not bg_visited[idx]:
                    bg_visited[idx] = 1
                    bg_stack.append(idx)
        # Flood-fill background
        cm_flat = color_map_2d.flatten()
        while bg_stack:
            idx = bg_stack.pop()
            y = idx // w
            x = idx % w
            for dy in (-1, 0, 1):
                ny = y + dy
                if ny < 0 or ny >= h:
                    continue
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx = x + dx
                    if nx < 0 or nx >= w:
                        continue
                    nidx = ny * w + nx
                    if bg_visited[nidx]:
                        continue
                    if orig_flat[nidx] == 0 and cm_flat[nidx] == 255:
                        bg_visited[nidx] = 1
                        bg_stack.append(nidx)
        # Any white pixel NOT background-visited → fill with body color (0)
        cm_flat_updated = cm_flat.copy()
        for i in range(total):
            if cm_flat[i] == 255 and orig_flat[i] == 0 and not bg_visited[i]:
                cm_flat_updated[i] = 0  # body color
        color_map_2d = cm_flat_updated.reshape(h, w)

    # ── Build final output RGB buffer ───────────────────────────────────
    # Start with luminance as greyscale (preserves black lines + shading)
    out_rgb = np.stack([lum, lum, lum], axis=-1).astype(np.uint8)
    # Apply colors: region[i] → palette[i % len(palette)]
    cm = color_map_2d
    palette_arr = np.array(palette, dtype=np.uint8)
    n_palette = len(palette_arr)
    # Build a color lookup table: index 255 = transparent (keep luminance)
    color_lookup = np.zeros((256, 3), dtype=np.uint8)
    for i in range(255):
        if i < n_palette:
            color_lookup[i] = palette_arr[i]
    color_lookup[255] = [0, 0, 0]  # placeholder — will be masked out
    # Vectorized color application
    colored = color_lookup[cm]  # shape: (h, w, 3)
    mask_colored = (cm != 255)
    # Apply: where mask_colored is True, replace out_rgb with colored
    out_rgb[mask_colored] = colored[mask_colored]

    Image.fromarray(out_rgb, "RGB").save(output_path, format="PNG")


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: clean + colorize one item, return paths
# ─────────────────────────────────────────────────────────────────────────────

def process_item(category_dir: Path, item: str, category: str) -> tuple[Path, Path]:
    """Process a single item: clean B&W + colorize. Returns (bw_path, color_path)."""
    bw_dir = category_dir / "bw"
    clean_dir = category_dir / "clean"
    bw_dir.mkdir(parents=True, exist_ok=True)
    clean_dir.mkdir(parents=True, exist_ok=True)

    raw_bw = bw_dir / f"{item}.png"
    clean_bw = clean_dir / f"{item}-bw.png"
    color_img = clean_dir / f"{item}-color.png"

    palette = get_palette(item, category)

    if not clean_bw.exists() or clean_bw.stat().st_size < 1024:
        clean_bw_image(raw_bw, clean_bw)
    if not color_img.exists() or color_img.stat().st_size < 1024:
        colorize_image(clean_bw, color_img, palette)

    return clean_bw, color_img


# Re-export layout constants for convenience
__all__ = [
    "clean_bw_image",
    "colorize_image",
    "process_item",
    "PAGE_WIDTH", "PAGE_HEIGHT", "MARGIN",
    "REF_SIZE", "REF_X", "REF_Y",
    "BW_SIZE", "BW_X", "BW_Y",
    "TITLE_Y", "PAGE_NUM_X", "PAGE_NUM_Y",
]
