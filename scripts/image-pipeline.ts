/**
 * Image processing pipeline for the Coloring Book PDF Generator.
 *
 *  Step 2: clean B&W  (greyscale → flatten → threshold @100 → erode ~30%)
 *  Step 3: auto-colorize (flood-fill enclosed regions, skip border-touching,
 *          size >3 && <500000, largest-first, palette-cycled)
 *
 * Used by scripts/regenerate-pdfs-no-covers.ts and the demo script.
 */
import sharp from "sharp";
import path from "path";
import fs from "fs";
import {
  type Palette,
  type RGB,
  getPalette,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  REF_SIZE,
  REF_X,
  REF_Y,
  BW_SIZE,
  BW_X,
  BW_Y,
  TITLE_Y,
  PAGE_NUM_X,
  PAGE_NUM_Y,
} from "../src/lib/coloring-data";

// ─────────────────────────────────────────────────────────────────────────
// Step 2: clean B&W
// ─────────────────────────────────────────────────────────────────────────

/**
 * Convert a raw AI B&W image to a clean B&W line-art image.
 *  - greyscale
 *  - flatten white bg
 *  - threshold: pixel < 100 → black (0), else white (255)
 *  - erode black lines ~30% (thin them) using a 3×3 min-ish morphology
 */
export async function cleanBwImage(
  inputPath: string,
  outputPath: string,
  options: { threshold?: number; erodePercent?: number } = {}
): Promise<void> {
  const threshold = options.threshold ?? 100;
  const erodePercent = options.erodePercent ?? 30;

  const { data, info } = await sharp(inputPath)
    .greyscale()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(1024, 1024, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const channels = info.channels;

  // Threshold → pure black/white single-channel buffer
  const bw = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = data[i * channels]; // greyscale, all channels equal
    bw[i] = v < threshold ? 0 : 255;
  }

  // Erode black lines: for each black pixel, count black neighbors.
  // If more than (100 - erodePercent)% of neighbors are white, turn white.
  // erodePercent=30 → if >70% neighbors white, erode.
  // Implemented as: keep black only if black-neighbor-count >= threshold.
  const eroded = Buffer.from(bw);
  const neighborThreshold = Math.round((8 * erodePercent) / 100); // # black neighbors needed to survive
  // Simpler & more reliable thinning: erode = remove black pixels that have
  // any white 4-neighbor (classic erosion would shrink lines). To THIN by
  // ~30%, we probabilistically remove border black pixels.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (bw[idx] === 0) {
        // Count black 8-neighbors
        let blackN = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            if (bw[(y + dy) * w + (x + dx)] === 0) blackN++;
          }
        }
        // A pixel on the EDGE of a line has few black neighbors.
        // erodePercent=30 → remove pixels with < 30% black neighbors
        // i.e. blackN < 2.4 → blackN <= 2  (30% of 8 = 2.4)
        const surviveThreshold = Math.ceil((8 * erodePercent) / 100);
        if (blackN < surviveThreshold) {
          eroded[idx] = 255; // erode → white
        }
      }
    }
  }

  // Write back as RGB PNG
  const outRgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const v = eroded[i];
    outRgb[i * 3] = v;
    outRgb[i * 3 + 1] = v;
    outRgb[i * 3 + 2] = v;
  }

  await sharp(outRgb, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile(outputPath);
}

// ─────────────────────────────────────────────────────────────────────────
// Step 3: auto-colorize (flood fill enclosed white regions)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Colorize a clean B&W image using flood-fill region detection.
 *
 * Algorithm (per spec):
 *   1. Load B&W image as raw RGB buffer.
 *   2. For each pixel, if white (>200) and not visited:
 *        flood-fill 8-connected neighbors → collect region pixels.
 *        track if region touches image border.
 *   3. Keep regions that: don't touch border AND size > 3 AND size < 500000.
 *   4. Sort regions LARGEST FIRST.
 *   5. For each region i: color = palette[i % palette.length].
 *   6. Save as PNG.
 */
export async function colorizeImage(
  bwPath: string,
  outputPath: string,
  palette: Palette,
  options: { whiteThreshold?: number; minSize?: number; maxSize?: number; closeGaps?: number } = {}
): Promise<void> {
  const whiteThreshold = options.whiteThreshold ?? 200;
  const minSize = options.minSize ?? 1; // color even tiny enclosed regions (no whites left)
  const maxSize = options.maxSize ?? 1000000;
  const closeGaps = options.closeGaps ?? 4; // lighter gap-closing — less gap between color and outline

  // Resize to 1000×1000 then place on a 1024×1024 WHITE canvas.
  const resized = await sharp(bwPath)
    .resize(1000, 1000, { fit: "cover" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer();
  const { data: canvasData, info: canvasInfo } = await sharp(resized, {
    raw: { width: 1000, height: 1000, channels: 3 },
  })
    .extend({
      top: 12,
      bottom: 12,
      left: 12,
      right: 12,
      background: { r: 255, g: 255, b: 255 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const data = canvasData;
  const w = canvasInfo.width;
  const h = canvasInfo.height;
  const ch = canvasInfo.channels;
  const total = w * h;

  // Build single-channel luminance buffer (original — used for final output
  // AND for the expansion step that fills color up to the real outline)
  const lum = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (ch >= 3) {
      lum[i] = (data[i * ch] + data[i * ch + 1] + data[i * ch + 2]) / 3;
    } else {
      lum[i] = data[i * ch];
    }
  }

  // ── ORIGINAL mask: 1 = black line (real outline), 0 = white ────────
  // Used for the EXPANSION step — color fills right up to the real lines.
  const origMask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    origMask[i] = lum[i] <= whiteThreshold ? 1 : 0;
  }

  // ── GAP-CLOSED mask: dilated black lines for flood-fill boundaries ──
  // Used only to correctly identify enclosed regions (seals AI line art gaps).
  const fillMask = new Uint8Array(origMask);
  for (let pass = 0; pass < closeGaps; pass++) {
    const dilated = new Uint8Array(fillMask);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (fillMask[idx]) continue;
        if (
          fillMask[(y - 1) * w + x - 1] || fillMask[(y - 1) * w + x] || fillMask[(y - 1) * w + x + 1] ||
          fillMask[y * w + x - 1] || fillMask[y * w + x + 1] ||
          fillMask[(y + 1) * w + x - 1] || fillMask[(y + 1) * w + x] || fillMask[(y + 1) * w + x + 1]
        ) {
          dilated[idx] = 1;
        }
      }
    }
    for (let i = 0; i < total; i++) fillMask[i] = dilated[i];
  }

  // ── STEP 1: Find enclosed sub-regions using gap-closed mask ─────────
  interface Region {
    pixels: number[];
    size: number;
  }
  const subRegions: Region[] = [];
  const visited = new Uint8Array(total);
  const stack: number[] = new Array(total);

  for (let start = 0; start < total; start++) {
    if (visited[start] || fillMask[start] === 1) continue;

    let head = 0;
    let tail = 0;
    stack[tail++] = start;
    visited[start] = 1;

    const pixelIndices: number[] = [];
    let touchesBorder = false;
    const startY = Math.floor(start / w);
    const startX = start % w;
    if (startX === 0 || startX === w - 1 || startY === 0 || startY === h - 1) {
      touchesBorder = true;
    }

    while (head < tail) {
      const idx = stack[head++];
      pixelIndices.push(idx);
      const y = Math.floor(idx / w);
      const x = idx % w;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nidx = ny * w + nx;
          if (visited[nidx]) continue;
          if (fillMask[nidx] === 1) continue;
          visited[nidx] = 1;
          if (nx === 0 || nx === w - 1 || ny === 0 || ny === h - 1) {
            touchesBorder = true;
          }
          stack[tail++] = nidx;
        }
      }
    }

    // Keep enclosed regions (non-border-touching), minSize=1 (no whites left)
    if (!touchesBorder && pixelIndices.length >= minSize && pixelIndices.length < maxSize) {
      subRegions.push({ pixels: pixelIndices, size: pixelIndices.length });
    }
  }

  // ── STEP 2: Center-fill to find the BODY region ─────────────────────
  let bboxMinX = w, bboxMinY = h, bboxMaxX = 0, bboxMaxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (fillMask[y * w + x] === 1) {
        if (x < bboxMinX) bboxMinX = x;
        if (x > bboxMaxX) bboxMaxX = x;
        if (y < bboxMinY) bboxMinY = y;
        if (y > bboxMaxY) bboxMaxY = y;
      }
    }
  }
  const cx = Math.floor((bboxMinX + bboxMaxX) / 2);
  const cy = Math.floor((bboxMinY + bboxMaxY) / 2);

  const bodyRegion: Region | null = (() => {
    let startIdx = cy * w + cx;
    if (fillMask[startIdx] === 1) {
      let found = -1;
      for (let r = 1; r < 50 && found === -1; r++) {
        for (let dy = -r; dy <= r && found === -1; dy++) {
          for (let dx = -r; dx <= r && found === -1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            if (fillMask[ny * w + nx] === 0) {
              found = ny * w + nx;
            }
          }
        }
      }
      if (found === -1) return null;
      startIdx = found;
    }

    const centerVisited = new Uint8Array(total);
    const centerStack: number[] = new Array(total);
    let head = 0;
    let tail = 0;
    centerStack[tail++] = startIdx;
    centerVisited[startIdx] = 1;
    const centerPixels: number[] = [];

    while (head < tail) {
      const idx = centerStack[head++];
      centerPixels.push(idx);
      const y = Math.floor(idx / w);
      const x = idx % w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nidx = ny * w + nx;
          if (centerVisited[nidx]) continue;
          if (fillMask[nidx] === 1) continue;
          centerVisited[nidx] = 1;
          centerStack[tail++] = nidx;
        }
      }
    }

    if (centerPixels.length > 100) {
      return { pixels: centerPixels, size: centerPixels.length };
    }
    return null;
  })();

  // ── STEP 3: Combine regions ─────────────────────────────────────────
  const regions: Region[] = [];
  if (bodyRegion) {
    regions.push(bodyRegion);
  }
  subRegions.sort((a, b) => b.size - a.size);
  regions.push(...subRegions);

  // ── STEP 4: Build output with EXPANSION to fill up to real outline ───
  // First, create a color map: each pixel → which region index it belongs to
  // (255 = uncolored/background)
  const colorMap = new Uint8Array(total);
  colorMap.fill(255);
  regions.forEach((region, i) => {
    for (const idx of region.pixels) {
      colorMap[idx] = i;
    }
  });

  // Now EXPAND each region outward against the ORIGINAL mask (origMask).
  // This fills the gap between the flood-fill boundary (gap-closed) and the
  // real outline, ensuring color reaches right up to the black lines.
  // Keep expanding until no more changes (unlimited passes).
  let expanding = true;
  let safetyCounter = 0;
  while (expanding && safetyCounter < 30) {
    const next = new Uint8Array(colorMap);
    expanding = false;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (origMask[idx] === 1 || colorMap[idx] !== 255) continue;
        let bestRegion = 255;
        for (let dy = -1; dy <= 1 && bestRegion === 255; dy++) {
          const ny = y + dy;
          for (let dx = -1; dx <= 1 && bestRegion === 255; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nidx = ny * w + (x + dx);
            if (colorMap[nidx] !== 255) {
              bestRegion = colorMap[nidx];
            }
          }
        }
        if (bestRegion !== 255) {
          next[idx] = bestRegion;
          expanding = true;
        }
      }
    }
    for (let i = 0; i < total; i++) {
      colorMap[i] = next[i];
    }
    safetyCounter++;
  }

  // ── STEP 5: Fill remaining whites inside the subject ────────────────
  // After expansion, there may still be uncolored white pixels inside the
  // subject (e.g. a leg outlined separately that the center-fill didn't
  // reach). Fill any uncolored white pixel INSIDE the bounding box with
  // the body color (palette[0] = region 0).
  if (bodyRegion) {
    for (let y = bboxMinY; y <= bboxMaxY; y++) {
      for (let x = bboxMinX; x <= bboxMaxX; x++) {
        const idx = y * w + x;
        if (colorMap[idx] === 255 && origMask[idx] === 0) {
          colorMap[idx] = 0; // body color
        }
      }
    }
  }

  // ── Build final output RGB buffer ───────────────────────────────────
  const outRgb = Buffer.alloc(total * 3);
  for (let i = 0; i < total; i++) {
    const v = lum[i];
    outRgb[i * 3] = v;
    outRgb[i * 3 + 1] = v;
    outRgb[i * 3 + 2] = v;
  }

  // Apply colors from the expanded colorMap
  for (let i = 0; i < total; i++) {
    const regionIdx = colorMap[i];
    if (regionIdx !== 255) {
      const color: RGB = palette[regionIdx % palette.length];
      outRgb[i * 3] = color[0];
      outRgb[i * 3 + 1] = color[1];
      outRgb[i * 3 + 2] = color[2];
    }
  }

  await sharp(outRgb, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile(outputPath);
}

// ─────────────────────────────────────────────────────────────────────────
// Convenience: clean + colorize one item, return paths
// ─────────────────────────────────────────────────────────────────────────

export interface ProcessedImages {
  bwPath: string;     // cleaned B&W
  colorPath: string;  // auto-colorized
}

export async function processItem(
  categoryDir: string,
  item: string,
  category: string
): Promise<ProcessedImages> {
  const bwDir = path.join(categoryDir, "bw");
  const cleanDir = path.join(categoryDir, "clean");
  fs.mkdirSync(bwDir, { recursive: true });
  fs.mkdirSync(cleanDir, { recursive: true });

  const rawBw = path.join(bwDir, `${item}.png`);
  const cleanBw = path.join(cleanDir, `${item}-bw.png`);
  const colorImg = path.join(cleanDir, `${item}-color.png`);

  const palette = getPalette(item, category);

  // If raw image missing, generate a placeholder so the pipeline still runs
  // (used by the demo script which does NOT call the AI image API in bulk).
  if (!fs.existsSync(rawBw) || fs.statSync(rawBw).size < 1024) {
    await generatePlaceholderLineArt(rawBw, item, category);
  }

  if (!fs.existsSync(cleanBw) || fs.statSync(cleanBw).size < 1024) {
    await cleanBwImage(rawBw, cleanBw);
  }
  if (!fs.existsSync(colorImg) || fs.statSync(colorImg).size < 1024) {
    await colorizeImage(cleanBw, colorImg, palette);
  }

  return { bwPath: cleanBw, colorPath: colorImg };
}

// ─────────────────────────────────────────────────────────────────────────
// Placeholder line-art generator (for testing WITHOUT bulk AI generation)
// Draws a simple shape with thick outlines on white, suitable for the
// colorization pipeline to still produce a sensible result.
// ─────────────────────────────────────────────────────────────────────────

export async function generatePlaceholderLineArt(
  outPath: string,
  item: string,
  category: string
): Promise<void> {
  // Use category-specific SVG silhouettes for recognizable, colorizable art.
  const { generateSilhouetteSvg } = await import("./silhouettes");
  const svg = generateSilhouetteSvg(item, category);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Re-export layout constants for convenience
export {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  REF_SIZE,
  REF_X,
  REF_Y,
  BW_SIZE,
  BW_X,
  BW_Y,
  TITLE_Y,
  PAGE_NUM_X,
  PAGE_NUM_Y,
};
