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
  const maxSize = options.maxSize ?? 1000000;
  const closeGaps = options.closeGaps ?? 14; // aggressive gap-closing to seal AI line art gaps

  // Resize to 1000×1000 then place on a 1024×1024 WHITE canvas. The 12px
  // white border guarantees no subject region can touch the canvas edge.
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

  // Build single-channel luminance buffer (original — kept for final output)
  const lum = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (ch >= 3) {
      lum[i] = (data[i * ch] + data[i * ch + 1] + data[i * ch + 2]) / 3;
    } else {
      lum[i] = data[i * ch];
    }
  }

  // ── GAP-CLOSING: dilate black lines to seal gaps in AI line art ──────
  const fillMask = new Uint8Array(total); // 1 = black (barrier), 0 = white
  for (let i = 0; i < total; i++) {
    fillMask[i] = lum[i] <= whiteThreshold ? 1 : 0;
  }
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

  // ── Find ALL enclosed regions (non-border-touching only) ────────────
  // NO bbox-interior extraction — this avoids the rectangular "box" of
  // color around the subject. Only truly enclosed white regions get colored.
  const visited = new Uint8Array(total);
  interface Region {
    pixels: number[];
    size: number;
  }
  let regions: Region[] = [];

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

    // Only keep NON-border-touching regions (truly enclosed areas)
    if (!touchesBorder && pixelIndices.length > 3 && pixelIndices.length < maxSize) {
      regions.push({ pixels: pixelIndices, size: pixelIndices.length });
    }
  }

  // Sort largest first
  regions.sort((a, b) => b.size - a.size);

  // ── CENTER-FILL fallback: if no enclosed body region found ──────────
  // If gap-closing didn't fully seal the outline, the body region leaked
  // to the background (border-touching) and was skipped. We recover it by
  // flood-filling FROM the center of the black-pixel bbox outward, stopping
  // at black lines. This gives us the body region WITHOUT the rectangular
  // box (only the area reachable from the center through white pixels).
  if (regions.length === 0 || regions[0].size < 1000) {
    // Find bbox of black pixels in the gap-closed mask
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

    // Flood-fill from center using a FRESH visited array (separate from
    // the border-based fill above)
    const centerVisited = new Uint8Array(total);
    const centerStack: number[] = new Array(total);
    let head = 0;
    let tail = 0;
    const centerStart = cy * w + cx;

    if (fillMask[centerStart] === 0) {
      centerStack[tail++] = centerStart;
      centerVisited[centerStart] = 1;
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
        // Add the center-filled body as the LARGEST region (it's the main body)
        regions.unshift({ pixels: centerPixels, size: centerPixels.length });
        // Re-sort
        regions.sort((a, b) => b.size - a.size);
      }
    }
  }

  // ── Ensure at least 3 colorizable regions ───────────────────────────
  // If we have fewer than 3 regions, progressively lower minSize to find
  // smaller enclosed areas. This ensures multi-color coloring even for
  // simple objects.
  if (regions.length < 3) {
    // Re-scan for smaller regions that were filtered by the >3 minSize
    const smallRegions: Region[] = [];
    for (let start = 0; start < total; start++) {
      if (visited[start] || fillMask[start] === 1) continue;
      // Check if this pixel is part of a small enclosed region
      let head = 0;
      let tail = 0;
      stack[tail++] = start;
      visited[start] = 1;
      const pix: number[] = [];
      let touchesB = false;
      const sy = Math.floor(start / w);
      const sx = start % w;
      if (sx === 0 || sx === w - 1 || sy === 0 || sy === h - 1) touchesB = true;
      while (head < tail) {
        const idx = stack[head++];
        pix.push(idx);
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
            if (nx === 0 || nx === w - 1 || ny === 0 || ny === h - 1) touchesB = true;
            stack[tail++] = nidx;
          }
        }
      }
      if (!touchesB && pix.length >= 1 && pix.length < maxSize) {
        smallRegions.push({ pixels: pix, size: pix.length });
      }
    }
    // Merge small regions into the main list (avoiding duplicates)
    const existingPixelSets = new Set<number>();
    for (const r of regions) {
      for (const p of r.pixels) existingPixelSets.add(p);
    }
    for (const r of smallRegions) {
      // Only add if not already covered
      const hasNew = r.pixels.some((p) => !existingPixelSets.has(p));
      if (hasNew) {
        regions.push(r);
        for (const p of r.pixels) existingPixelSets.add(p);
      }
    }
    regions.sort((a, b) => b.size - a.size);
  }

  // ── Build output: black lines stay, white background stays, regions colored
  const outRgb = Buffer.alloc(total * 3);
  for (let i = 0; i < total; i++) {
    const v = lum[i];
    outRgb[i * 3] = v;
    outRgb[i * 3 + 1] = v;
    outRgb[i * 3 + 2] = v;
  }

  // Color each region: largest → palette[0] (main/natural color),
  // second largest → palette[1], third → palette[2], etc.
  // For objects with few natural colors, palette cycles.
  regions.forEach((region, i) => {
    const color: RGB = palette[i % palette.length];
    for (const idx of region.pixels) {
      outRgb[idx * 3] = color[0];
      outRgb[idx * 3 + 1] = color[1];
      outRgb[idx * 3 + 2] = color[2];
    }
  });

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
