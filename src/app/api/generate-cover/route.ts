import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// KDP Paperback Cover dimensions (in points; 1 inch = 72 points)
// Full cover = Back (8.5") + Spine (pageCount × 0.002252") + Front (8.5")
// Height = 11.25" (11" + 0.125" bleed top + 0.125" bleed bottom)
const PT = 72;
const PAGE_W = 8.5 * PT;        // 612 — one cover panel width
const COVER_H = 11.25 * PT;     // 810 — full cover height with bleed
const SPINE_PER_PAGE = 0.002252 * PT; // ~0.162 pts per page (KDP white paper)

/**
 * POST /api/generate-cover
 * Body: {
 *   title: string,
 *   author: string,
 *   pageCount: number,
 *   bgGradient: [string, string],
 *   spineColor?: string,
 *   subtitle?: string,
 * }
 *
 * Generates a KDP-ready paperback cover PDF using pdf-lib:
 *   [ BACK COVER ] [ SPINE ] [ FRONT COVER ]
 * with bleed, title/author text, and a colored gradient background.
 *
 * Returns: { success, pdf: data-uri, width, height, spineWidth, fileName }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title: string = (body?.title ?? "Coloring Book").trim();
    const author: string = (body?.author ?? "Unknown Author").trim();
    const subtitle: string = (body?.subtitle ?? "").trim();
    const pageCount: number = Math.max(24, Math.min(828, body?.pageCount ?? 100));
    const bgGradient: [string, string] = Array.isArray(body?.bgGradient) && body.bgGradient.length === 2
      ? [body.bgGradient[0], body.bgGradient[1]]
      : ["#FF6B9D", "#FBA74D"];
    const spineColor: string = body?.spineColor ?? bgGradient[0];

    // Spine width in points
    const spineW = pageCount * SPINE_PER_PAGE;
    // Full cover width = back + spine + front
    const fullW = PAGE_W + spineW + PAGE_W;

    const doc = await PDFDocument.create();
    doc.setTitle(`${title} — Cover`);
    doc.setAuthor(author);
    doc.setSubject("Amazon KDP Paperback Cover");

    const page = doc.addPage([fullW, COVER_H]);
    const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);

    // ── Background gradient (horizontal stripes) ─────────────────────
    const c1 = hexToRgb(bgGradient[0]);
    const c2 = hexToRgb(bgGradient[1]);
    const stripes = 120;
    const stripeH = COVER_H / stripes;
    for (let i = 0; i < stripes; i++) {
      const t = i / (stripes - 1);
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * t) / 255;
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * t) / 255;
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * t) / 255;
      page.drawRectangle({
        x: 0,
        y: COVER_H - (i + 1) * stripeH,
        width: fullW,
        height: stripeH + 1,
        color: rgb(r, g, b),
      });
    }

    // ── Spine band (slightly darker) ─────────────────────────────────
    const spineX = PAGE_W;
    const spineRgb = hexToRgb(spineColor);
    const darkSpine = rgb(
      Math.max(0, spineRgb[0] - 40) / 255,
      Math.max(0, spineRgb[1] - 40) / 255,
      Math.max(0, spineRgb[2] - 40) / 255
    );
    page.drawRectangle({
      x: spineX,
      y: 0,
      width: spineW,
      height: COVER_H,
      color: darkSpine,
    });

    // Spine text (only if spine is wide enough) — pdf-lib doesn't support
    // rotated text easily, so we skip spine text for narrow spines.
    // For wider spines, we draw the title character by character vertically.
    if (spineW > 40) {
      const fontSize = Math.min(14, spineW * 0.35);
      const chars = title.split("");
      const charH = fontSize * 1.2;
      const totalH = chars.length * charH;
      let startY = (COVER_H + totalH) / 2;
      for (const ch of chars) {
        const w = helveticaBold.widthOfTextAtSize(ch, fontSize);
        page.drawText(ch, {
          x: spineX + (spineW - w) / 2,
          y: startY - charH,
          size: fontSize,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });
        startY -= charH;
      }
    }

    // ── Front cover (right panel) ────────────────────────────────────
    const frontX = PAGE_W + spineW;
    const white = rgb(1, 1, 1);
    const whiteOpaque = rgb(1, 1, 1);

    // Decorative bars
    page.drawRectangle({
      x: frontX + 50,
      y: COVER_H - COVER_H * 0.28 - 3,
      width: PAGE_W - 100,
      height: 3,
      color: rgb(1, 1, 1),
      opacity: 0.25,
    });
    page.drawRectangle({
      x: frontX + 50,
      y: COVER_H - COVER_H * 0.78 - 3,
      width: PAGE_W - 100,
      height: 3,
      color: rgb(1, 1, 1),
      opacity: 0.25,
    });

    // Title (centered)
    drawCenteredText(page, helveticaBold, title, 42, frontX + 50, COVER_H - COVER_H * 0.35 - 42, PAGE_W - 100, white);

    // Subtitle
    if (subtitle) {
      drawCenteredText(page, helvetica, subtitle, 18, frontX + 50, COVER_H - COVER_H * 0.5 - 18, PAGE_W - 100, whiteOpaque);
    }

    // Author (bottom)
    drawCenteredText(page, helveticaBold, author, 20, frontX + 50, COVER_H - COVER_H * 0.82 - 20, PAGE_W - 100, white);

    // ── Back cover (left panel) ──────────────────────────────────────
    const descText = `A fun coloring book with ${pageCount} pages of delightful illustrations. Perfect for kids and adults alike. Each page features clean line art ready to color.`;
    const descLines = wrapText(descText, PAGE_W - 100, helvetica, 11);
    let descY = COVER_H - COVER_H * 0.65 - 11;
    for (const line of descLines) {
      page.drawText(line, {
        x: 50,
        y: descY,
        size: 11,
        font: helvetica,
        color: rgb(1, 1, 1),
        opacity: 0.85,
      });
      descY -= 14;
    }

    // Barcode placeholder (bottom-right of back cover)
    const barcodeW = 120;
    const barcodeH = 60;
    page.drawRectangle({
      x: PAGE_W - barcodeW - 40,
      y: 40,
      width: barcodeW,
      height: barcodeH,
      color: rgb(1, 1, 1),
    });
    const isbnText = "ISBN";
    const isbnW = helveticaBold.widthOfTextAtSize(isbnText, 9);
    page.drawText(isbnText, {
      x: PAGE_W - barcodeW - 40 + (barcodeW - isbnW) / 2,
      y: 40 + barcodeH / 2 - 4,
      size: 9,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    const outBytes = await doc.save();
    const dataUri = `data:application/pdf;base64,${Buffer.from(outBytes).toString("base64")}`;

    const safeTitle = title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    const fileName = `${safeTitle || "coloring-book"}-cover.pdf`;

    return NextResponse.json({
      success: true,
      pdf: dataUri,
      width: fullW,
      height: COVER_H,
      spineWidth: spineW,
      pageCount,
      fileName,
    });
  } catch (err) {
    console.error("[/api/generate-cover] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function drawCenteredText(
  page: ReturnType<PDFDocument["addPage"]>,
  font: PDFFont,
  text: string,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  color: ReturnType<typeof rgb>
) {
  // Truncate if too wide
  let t = text;
  while (font.widthOfTextAtSize(t, size) > maxWidth && t.length > 1) {
    t = t.slice(0, -1);
  }
  if (t !== text) t = t.slice(0, -1) + "…";
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: x + (maxWidth - w) / 2, y, size, font, color });
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
