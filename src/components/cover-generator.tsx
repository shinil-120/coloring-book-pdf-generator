"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  Download,
  CheckCircle2,
  Palette,
  Wand2,
  FileText,
  Ruler,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCategoryTheme } from "@/lib/coloring-data";

interface BookMeta {
  name: string;
  url: string;
  slug: string;
  size: string;
  sizeBytes: number;
  pages: number;
  category: string;
  timestamp: string;
  readableTime: string;
  description: string;
}

interface CoverResult {
  pdf: string;
  width: number;
  height: number;
  spineWidth: number;
  pageCount: number;
  fileName: string;
}

// Preset gradient themes
const THEMES = [
  { name: "Sunset", colors: ["#FF6B9D", "#FBA74D"] as [string, string] },
  { name: "Ocean", colors: ["#4ECDC4", "#3B82F6"] as [string, string] },
  { name: "Forest", colors: ["#10B981", "#059669"] as [string, string] },
  { name: "Berry", colors: ["#9B6DD7", "#E879F9"] as [string, string] },
  { name: "Fire", colors: ["#EF4444", "#F97316"] as [string, string] },
  { name: "Twilight", colors: ["#6366F1", "#1E1B4B"] as [string, string] },
  { name: "Candy", colors: ["#F472B6", "#FB7185"] as [string, string] },
  { name: "Mint", colors: ["#34D399", "#06B6D4"] as [string, string] },
];

export function CoverGenerator({
  books,
  onBack,
}: {
  books: BookMeta[];
  onBack: () => void;
}) {
  const [title, setTitle] = useState("My Coloring Book");
  const [author, setAuthor] = useState("Coloring Book Studio");
  const [subtitle, setSubtitle] = useState("30 fun pages to color");
  const [selectedSlug, setSelectedSlug] = useState<string>(
    books[0]?.slug ?? ""
  );
  const [themeIdx, setThemeIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<CoverResult | null>(null);

  const selectedBook = books.find((b) => b.slug === selectedSlug);
  const pageCount = selectedBook?.pages ?? 100;
  const theme = THEMES[themeIdx];

  // Spine width estimate (for display)
  const spineInches = (pageCount * 0.002252).toFixed(3);
  const coverWidthInches = (8.5 + pageCount * 0.002252 + 8.5).toFixed(2);

  const handleGenerate = useCallback(async () => {
    if (!title.trim() || !author.trim()) {
      toast.error("Title and author are required");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim(),
          subtitle: subtitle.trim(),
          pageCount,
          bgGradient: theme.colors,
          spineColor: theme.colors[0],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult({
        pdf: data.pdf,
        width: data.width,
        height: data.height,
        spineWidth: data.spineWidth,
        pageCount: data.pageCount,
        fileName: data.fileName,
      });

      // Save cover to Blob + Turso so it appears in the book list
      try {
        await fetch("/api/save-cover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfData: data.pdf,
            title: title.trim(),
            author: author.trim(),
            pageCount,
            fileName: data.fileName,
          }),
        });
      } catch {
        // non-fatal — cover is still downloadable
      }

      toast.success("Cover generated!", {
        description: `${pageCount} pages · ${coverWidthInches}" wide · Added to book list`,
      });
    } catch (e) {
      toast.error("Cover generation failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setGenerating(false);
    }
  }, [title, author, subtitle, pageCount, theme, coverWidthInches]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.pdf;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Download started", { description: result.fileName });
  }, [result]);

  // ── Result screen ─────────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border-indigo-200 bg-white shadow-lg shadow-indigo-100/50">
          <div className="h-2 w-full bg-gradient-to-r from-indigo-400 to-violet-500" />
          <div className="flex flex-col items-center gap-5 p-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-indigo-200 opacity-50" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-400 to-violet-500 shadow-lg shadow-indigo-200">
                <BookOpen className="h-10 w-10 text-white" strokeWidth={2} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Cover Generated!
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-stone-800">
                KDP Cover Ready
              </h2>
              <p className="text-sm font-medium text-stone-500">
                Full paperback cover with spine
              </p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {result.pageCount}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Pages
                </div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {spineInches}"
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Spine
                </div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {coverWidthInches}"
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Width
                </div>
              </div>
            </div>
            <div className="w-full rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-xs font-medium text-indigo-700">
              KDP Paperback · Back + Spine + Front · 0.125″ bleed
            </div>
            <div className="w-full truncate rounded-lg bg-stone-100 px-3 py-2 font-mono text-xs text-stone-600">
              {result.fileName}
            </div>
            <Button
              onClick={handleDownload}
              className="h-12 w-full gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-300"
            >
              <Download className="h-4.5 w-4.5" />
              Download Cover PDF
            </Button>
            <Button
              onClick={() => setResult(null)}
              variant="outline"
              className="h-10 w-full gap-2 rounded-full border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Cover Builder
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Builder form ──────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full text-stone-500 hover:bg-stone-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="h-6 w-px bg-stone-200" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-extrabold text-stone-800">
              <BookOpen className="h-4 w-4 text-indigo-500" />
              KDP Cover Generator
            </div>
            <div className="text-xs font-medium text-stone-500">
              Create a full paperback cover (back + spine + front)
            </div>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-xs font-medium text-indigo-700">
        <Wand2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          Enter your book details, pick a color theme, and generate a
          KDP-ready cover PDF with automatic spine sizing.
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div className="space-y-4">
          {/* Book selection */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
              Source Book (determines page count)
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {books.map((book) => {
                const isSelected = selectedSlug === book.slug;
                const theme = getCategoryTheme(book.category);
                return (
                  <button
                    key={book.slug}
                    onClick={() => setSelectedSlug(book.slug)}
                    className={`group relative flex flex-col gap-1 overflow-hidden rounded-xl border-2 bg-white p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-indigo-400 ring-2 ring-indigo-200"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.gradient}`} />
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-base leading-none">{theme.emoji}</span>
                      <span className="truncate text-xs font-extrabold text-stone-800">
                        {book.name.replace(" Coloring Book", "")}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-stone-500">
                      {book.pages} pages
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text fields */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="space-y-3">
              <div>
                <Label htmlFor="cover-title" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
                  Title
                </Label>
                <Input
                  id="cover-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Coloring Book"
                  className="h-10 rounded-xl border-stone-200 bg-stone-50 text-sm font-bold text-stone-800 focus:border-indigo-300 focus:bg-white"
                />
              </div>
              <div>
                <Label htmlFor="cover-subtitle" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
                  Subtitle (optional)
                </Label>
                <Input
                  id="cover-subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="30 fun pages to color"
                  className="h-10 rounded-xl border-stone-200 bg-stone-50 text-sm font-medium text-stone-700 focus:border-indigo-300 focus:bg-white"
                />
              </div>
              <div>
                <Label htmlFor="cover-author" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
                  Author Name
                </Label>
                <Input
                  id="cover-author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your Name"
                  className="h-10 rounded-xl border-stone-200 bg-stone-50 text-sm font-medium text-stone-700 focus:border-indigo-300 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Color theme */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
              Color Theme
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => setThemeIdx(i)}
                  className={`group relative overflow-hidden rounded-xl border-2 p-1 transition-all ${
                    themeIdx === i
                      ? "border-indigo-400 ring-2 ring-indigo-200"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                  title={t.name}
                >
                  <div
                    className="h-10 w-full rounded-lg"
                    style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
                  />
                  <div className="mt-1 text-center text-[9px] font-bold text-stone-600">
                    {t.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar: live preview + specs */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border-2 border-indigo-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
                <Palette className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-extrabold text-stone-800">
                Live Preview
              </h3>
            </div>

            {/* Cover preview (scaled down) */}
            <div className="mb-3 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div
                className="relative mx-auto flex overflow-hidden rounded-lg shadow-lg"
                style={{
                  width: "100%",
                  maxWidth: "180px",
                  aspectRatio: `${8.5 + pageCount * 0.002252 + 8.5} / 11.25`,
                  background: `linear-gradient(180deg, ${theme.colors[0]}, ${theme.colors[1]})`,
                }}
              >
                {/* Back cover (left) */}
                <div className="flex h-full flex-1 items-end justify-center p-2">
                  <span className="text-[7px] font-semibold text-white/70">
                    Back
                  </span>
                </div>
                {/* Spine (middle) */}
                <div
                  className="h-full shrink-0"
                  style={{
                    width: `${(pageCount * 0.002252 / (8.5 + pageCount * 0.002252 + 8.5)) * 100}%`,
                    minWidth: "3px",
                    background: "rgba(0,0,0,0.2)",
                  }}
                />
                {/* Front cover (right) */}
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-1 p-2">
                  <div className="h-px w-3/4 bg-white/30" />
                  <span className="text-center text-[8px] font-extrabold leading-tight text-white drop-shadow">
                    {title || "Title"}
                  </span>
                  {subtitle && (
                    <span className="text-center text-[6px] text-white/80">
                      {subtitle}
                    </span>
                  )}
                  <div className="h-px w-3/4 bg-white/30" />
                  <span className="mt-1 text-[6px] font-bold text-white/90">
                    {author || "Author"}
                  </span>
                </div>
              </div>
            </div>

            {/* Specs */}
            <div className="mb-3 space-y-1.5 rounded-xl bg-stone-50 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-stone-500">
                  <FileText className="h-3 w-3" /> Pages
                </span>
                <span className="font-bold text-stone-700">{pageCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-stone-500">
                  <Ruler className="h-3 w-3" /> Spine
                </span>
                <span className="font-bold text-stone-700">{spineInches}"</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-stone-500">
                  <Ruler className="h-3 w-3" /> Cover width
                </span>
                <span className="font-bold text-stone-700">{coverWidthInches}"</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-stone-500">
                  <Ruler className="h-3 w-3" /> Height
                </span>
                <span className="font-bold text-stone-700">11.25"</span>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="h-11 w-full gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" />
                  Generate Cover PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
