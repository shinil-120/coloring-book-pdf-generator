/**
 * scripts/migrate-to-turso.ts
 *
 * Migrates existing local coloring book data to Turso + Vercel Blob:
 *   1. Reads public/downloads/coloring-books.json
 *   2. Uploads each PDF to Vercel Blob
 *   3. Uploads all thumbnails to Vercel Blob
 *   4. Creates Turso records for each book
 *
 * Prerequisites:
 *   - Set env vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, BLOB_READ_WRITE_TOKEN
 *   - Run `bun run db:push` first to create tables
 *
 * Usage:
 *   bun run scripts/migrate-to-turso.ts
 */
import fs from "fs";
import path from "path";
import { upsertBook, isTursoConfigured } from "../src/lib/turso";
import { uploadPdf, uploadThumbnail, isBlobConfigured } from "../src/lib/blob-storage";

async function main() {
  console.log("\n📦 Migrating local data to Turso + Vercel Blob\n");

  if (!isTursoConfigured()) {
    console.error("❌ TURSO_DATABASE_URL not set. Set Turso env vars first.");
    process.exit(1);
  }
  if (!isBlobConfigured()) {
    console.error("❌ BLOB_READ_WRITE_TOKEN not set. Set Vercel Blob env vars first.");
    process.exit(1);
  }

  const jsonPath = path.join(process.cwd(), "public", "downloads", "coloring-books.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("❌ No coloring-books.json found at public/downloads/");
    process.exit(1);
  }

  const books = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`   Found ${books.length} book(s) to migrate\n`);

  for (const book of books) {
    console.log(`📖 ${book.name} (${book.slug})`);

    // 1. Upload PDF
    const pdfLocalPath = path.join(
      process.cwd(),
      "public",
      book.url.replace(/^\//, "")
    );
    if (!fs.existsSync(pdfLocalPath)) {
      console.log(`   ⚠️  PDF not found: ${pdfLocalPath} — skipping`);
      continue;
    }

    console.log(`   uploading PDF…`);
    const { url: pdfUrl } = await uploadPdf(book.slug, fs.readFileSync(pdfLocalPath));
    console.log(`   ✓ PDF → ${pdfUrl}`);

    // 2. Upload thumbnails
    const thumbDir = path.join(
      process.cwd(),
      "public",
      "downloads",
      "thumbnails",
      book.slug
    );
    if (fs.existsSync(thumbDir)) {
      const thumbFiles = fs
        .readdirSync(thumbDir)
        .filter((f) => /^page-\d+\.png$/.test(f))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)![0], 10);
          const nb = parseInt(b.match(/\d+/)![0], 10);
          return na - nb;
        });

      for (const file of thumbFiles) {
        const pageNum = parseInt(file.match(/\d+/)![0], 10);
        const thumbPath = path.join(thumbDir, file);
        const { url: thumbUrl } = await uploadThumbnail(
          book.slug,
          pageNum,
          fs.readFileSync(thumbPath)
        );
        process.stdout.write(`\r   ✓ thumbnails: ${pageNum}/${thumbFiles.length}   `);
      }
      console.log("");
    }

    // 3. Create Turso record
    console.log(`   creating Turso record…`);
    await upsertBook({
      slug: book.slug,
      name: book.name,
      category: book.category,
      description: book.description,
      pages: book.pages,
      sizeBytes: book.sizeBytes,
      pdfUrl,
      items: book.items || [],
    });
    console.log(`   ✓ Turso record created\n`);
  }

  console.log("✨ Migration complete!\n");
  console.log("   Your books are now stored in Turso + Vercel Blob.");
  console.log("   The app will read from /api/books (Turso) on next load.\n");
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
