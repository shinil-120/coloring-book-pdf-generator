import { NextRequest, NextResponse } from "next/server";
import { getCategory, listItems, isTursoConfigured } from "@/lib/category-store";
import {
  uploadExternalColoringPage,
  externalColoringPageExists,
  isBlobConfigured,
} from "@/lib/blob-storage";
import { slugify } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

/**
 * POST /api/upload-coloring-image
 *
 * Uploads an externally-generated coloring-page image (from ChatGPT free,
 * Bing Image Creator, etc.) to Vercel Blob. The image is stored at a
 * SEPARATE path from API-generated images so it doesn't overwrite them.
 * When the PDF is assembled, BOTH API and external images are included.
 *
 * Accepts multipart/form-data:
 *   - categorySlug: string (e.g. "Bugs")
 *   - itemName: string (e.g. "Ant") — must match an item in the category
 *   - image: File (PNG or JPG, max 10MB)
 *
 * Returns:
 *   { success: boolean, url: string, sizeBytes: number, message: string }
 */
export async function POST(req: NextRequest) {
  try {
    if (!isTursoConfigured()) {
      return NextResponse.json(
        { success: false, error: "Turso not configured — set TURSO_DATABASE_URL" },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const categorySlug = (formData.get("categorySlug") as string)?.trim() ?? "";
    const itemName = (formData.get("itemName") as string)?.trim() ?? "";
    const file = formData.get("image") as File | null;

    // Validate required fields
    if (!categorySlug) {
      return NextResponse.json(
        { success: false, error: "categorySlug is required" },
        { status: 400 }
      );
    }
    if (!itemName) {
      return NextResponse.json(
        { success: false, error: "itemName is required" },
        { status: 400 }
      );
    }
    if (!file) {
      return NextResponse.json(
        { success: false, error: "image file is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const contentType = file.type || "";
    if (!ALLOWED_TYPES.includes(contentType.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type: "${contentType}". Only PNG and JPG are allowed.`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max allowed: 10 MB.`,
        },
        { status: 400 }
      );
    }

    if (file.size < 1000) {
      return NextResponse.json(
        {
          success: false,
          error: `File too small: ${file.size} bytes. The image appears to be empty or corrupted.`,
        },
        { status: 400 }
      );
    }

    // Validate category + item exist
    const category = await getCategory(categorySlug);
    if (!category) {
      return NextResponse.json(
        { success: false, error: `Category "${categorySlug}" not found` },
        { status: 404 }
      );
    }

    const items = await listItems(category.id, false);
    const knownNames = new Set(items.map((i) => i.name));
    if (!knownNames.has(itemName)) {
      return NextResponse.json(
        {
          success: false,
          error: `Item "${itemName}" not found in category "${categorySlug}"`,
        },
        { status: 404 }
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to the EXTERNAL path (doesn't overwrite API-generated images)
    const upload = await uploadExternalColoringPage(category.slug, itemName, buffer);

    return NextResponse.json({
      success: true,
      url: upload.url,
      sizeBytes: file.size,
      itemName,
      categorySlug: category.slug,
      message: `Image uploaded for "${itemName}". It will be included as an additional page when you create the PDF.`,
    });
  } catch (err) {
    console.error("[/api/upload-coloring-image POST] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
