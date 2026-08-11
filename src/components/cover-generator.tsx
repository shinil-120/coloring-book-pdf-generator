"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
  LayoutGrid,
  Type,
  Zap,
  ZapOff,
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
  items?: string[];
}

interface CoverResult {
  pdf: string;
  width: number;
  height: number;
  spineWidth: number;
  pageCount: number;
  fileName: string;
}

interface PageData {
  index: number;
  pageNumber: number;
  label: string;
  thumbnail: string;
}

// Design styles
const DESIGN_STYLES = [
  { id: "classic", name: "Classic", icon: Type, desc: "Title-focused, clean" },
  { id: "gallery", name: "Gallery", icon: LayoutGrid, desc: "3×2 thumbnail grid" },
  { id: "zigzag", name: "Zigzag", icon: Zap, desc: "Colored, varied sizes" },
  { id: "zigzag-mixed", name: "Mixed Zigzag", icon: ZapOff, desc: "Colored + B&W mix" },
];

// Color themes
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
  const [selectedSlug, setSelectedSlug] = useState<string>(books[0]?.slug ?? "");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("Coloring Book Studio");
  const [subtitle, setSubtitle] = useState("");
  const [themeIdx, setThemeIdx] = useState(0);
  const [designStyle, setDesignStyle] = useState("gallery");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<CoverResult | null>(null);
  const [bookPages, setBookPages] = useState<PageData[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  const selectedBook = books.find((b) => b.slug === selectedSlug);
  const pageCount = selectedBook?.pages ?? 100;
  const theme = THEMES[themeIdx];

  // Auto-set title when a book is selected
  useEffect(() => {
    if (selectedBook) {
      const bookTitle = selectedBook.name.replace(" Coloring Book", "");
      setTitle(bookTitle + " Coloring Book");
      setSubtitle(`${pageCount} fun pages to color`);
    }
  }, [selectedSlug]);  

  // Fetch page thumbnails when book is selected (for design preview)
  useEffect(() => {
    if (!selectedSlug) return;
    setLoadingPages(true);
    setBookPages([]);
    fetch("/api/book-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: selectedSlug }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setBookPages(data.pages);
      })
      .catch(() => {})
      .finally(() => setLoadingPages(false));
  }, [selectedSlug]);

  const spineInches = (pageCount * 0.002252).toFixed(3);
  const coverWidthInches = (8.5 + pageCount * 0.002252 + 8.5).toFixed(2);

  // Get up to 6 thumbnail URLs for the cover design
  const thumbnailUrls = useMemo(() => {
    return bookPages.slice(0, 6).map((p) => p.thumbnail);
  }, [bookPages]);

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
          designStyle,
          thumbnailUrls,
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

      // Save cover to Blob + Turso
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
      } catch {}

      toast.success("Cover generated!", {
        description: `${designStyle} style · Added to Merge Books`,
      });
    } catch (e) {
      toast.error("Cover generation failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setGenerating(false);
    }
  }, [title, author, subtitle, pageCount, theme, designStyle, thumbnailUrls]);

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
                {designStyle} style · Added to Merge Books
              </p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">{result.pageCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Pages</div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">{spineInches}"</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Spine</div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">{coverWidthInches}"</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Width</div>
              </div>
            </div>
            <div className="w-full rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-xs font-medium text-indigo-700">
              KDP Paperback · Back + Spine + Front · 0.125″ bleed
            </div>
            <div className="w-full truncate rounded-lg bg-stone-100 px-3 py-2 font-mono text-xs text-stone-600">
              {result.fileName}
            </div>
            <Button onClick={handleDownload} className="h-12 w-full gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-300">
              <Download className="h-4.5 w-4.5" />
              Download Cover PDF
            </Button>
            <Button onClick={() => setResult(null)} variant="outline" className="h-10 w-full gap-2 rounded-full border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50">
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
          <Button onClick={onBack} variant="ghost" size="sm" className="gap-1.5 rounded-full text-stone-500 hover:bg-stone-100">
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
              Pick a book, choose a design, generate a cover
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left: Form */}
        <div className="space-y-4">
          {/* Book selection */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
              1. Pick a Coloring Book
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
                      isSelected ? "border-indigo-400 ring-2 ring-indigo-200" : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.gradient}`} />
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-base leading-none">{theme.emoji}</span>
                      <span className="truncate text-xs font-extrabold text-stone-800">
                        {book.name.replace(" Coloring Book", "")}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-stone-500">{book.pages} pages</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Design style selection */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
              2. Choose Design Style
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DESIGN_STYLES.map((style) => {
                const Icon = style.icon;
                const isSelected = designStyle === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setDesignStyle(style.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                      isSelected ? "border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-200" : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${isSelected ? "text-indigo-500" : "text-stone-400"}`} />
                    <div className={`text-xs font-bold ${isSelected ? "text-indigo-700" : "text-stone-600"}`}>
                      {style.name}
                    </div>
                    <div className="text-[9px] text-stone-400 text-center">{style.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color theme */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
              3. Color Theme
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => setThemeIdx(i)}
                  className={`group relative overflow-hidden rounded-xl border-2 p-1 transition-all ${
                    themeIdx === i ? "border-indigo-400 ring-2 ring-indigo-200" : "border-stone-200 hover:border-stone-300"
                  }`}
                  title={t.name}
                >
                  <div className="h-10 w-full rounded-lg" style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }} />
                  <div className="mt-1 text-center text-[9px] font-bold text-stone-600">{t.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Text fields */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
              4. Cover Text
            </Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="cover-title" className="mb-1 block text-[11px] font-bold text-stone-600">Title</Label>
                <Input id="cover-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" className="h-9 rounded-xl border-stone-200 bg-stone-50 text-sm font-bold text-stone-800 focus:border-indigo-300 focus:bg-white" />
              </div>
              <div>
                <Label htmlFor="cover-subtitle" className="mb-1 block text-[11px] font-bold text-stone-600">Subtitle</Label>
                <Input id="cover-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="30 fun pages to color" className="h-9 rounded-xl border-stone-200 bg-stone-50 text-sm font-medium text-stone-700 focus:border-indigo-300 focus:bg-white" />
              </div>
              <div>
                <Label htmlFor="cover-author" className="mb-1 block text-[11px] font-bold text-stone-600">Author</Label>
                <Input id="cover-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" className="h-9 rounded-xl border-stone-200 bg-stone-50 text-sm font-medium text-stone-700 focus:border-indigo-300 focus:bg-white" />
              </div>
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
              <h3 className="text-sm font-extrabold text-stone-800">Live Preview</h3>
            </div>

            {/* Cover preview */}
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
                {/* Back cover */}
                <div className="flex h-full flex-1 items-end justify-center p-2">
                  <span className="text-[7px] font-semibold text-white/70">Back</span>
                </div>
                {/* Spine */}
                <div className="h-full shrink-0" style={{ width: `${(pageCount * 0.002252 / (8.5 + pageCount * 0.002252 + 8.5)) * 100}%`, minWidth: "3px", background: "rgba(0,0,0,0.2)" }} />
                {/* Front cover — design-specific preview */}
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-1 p-2">
                  {designStyle === "gallery" && bookPages.length > 0 ? (
                    <>
                      {/* Gallery: 3×2 grid — show only colored reference (top-left crop) */}
                      <div className="grid grid-cols-3 gap-0.5 w-full mb-1">
                        {bookPages.slice(0, 6).map((p, i) => (
                          <div key={i} className="aspect-square overflow-hidden">
                            <img
                              src={p.thumbnail}
                              alt=""
                              className="h-full w-full object-cover opacity-90"
                              loading="lazy"
                              style={{ objectPosition: "top left", objectFit: "cover", transform: "scale(3.5)", transformOrigin: "top left" }}
                            />
                          </div>
                        ))}
                      </div>
                      <span className="text-center text-[7px] font-extrabold leading-tight text-white drop-shadow">{title || "Title"}</span>
                    </>
                  ) : (designStyle === "zigzag" || designStyle === "zigzag-mixed") && bookPages.length > 0 ? (
                    <>
                      {/* Zigzag: alternating left/right with varying sizes — colored only */}
                      <div className="relative w-full h-full">
                        {bookPages.slice(0, 6).map((p, i) => {
                          const sizes = ["w-1/3", "w-1/4", "w-1/5", "w-1/4", "w-1/5", "w-1/6"];
                          const isLeft = i % 2 === 0;
                          const isColored = designStyle === "zigzag" || i % 2 === 0;
                          return (
                            <div
                              key={i}
                              className={`absolute ${sizes[i % sizes.length]} aspect-square overflow-hidden ${isLeft ? "left-0" : "right-0"}`}
                              style={{ top: `${10 + i * 14}%` }}
                            >
                              <img
                                src={p.thumbnail}
                                alt=""
                                className={`h-full w-full ${isColored ? "opacity-90" : "opacity-40"}`}
                                loading="lazy"
                                style={{ objectPosition: "top left", objectFit: "cover", transform: "scale(3.5)", transformOrigin: "top left" }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <span className="text-center text-[7px] font-extrabold leading-tight text-white drop-shadow">{title || "Title"}</span>
                    </>
                  ) : (
                    <>
                      <div className="h-px w-3/4 bg-white/30" />
                      <span className="text-center text-[8px] font-extrabold leading-tight text-white drop-shadow">{title || "Title"}</span>
                      {subtitle && <span className="text-center text-[6px] text-white/80">{subtitle}</span>}
                      <div className="h-px w-3/4 bg-white/30" />
                      <span className="mt-1 text-[6px] font-bold text-white/90">{author || "Author"}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Specs */}
            <div className="mb-3 space-y-1.5 rounded-xl bg-stone-50 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-stone-500"><FileText className="h-3 w-3" /> Pages</span>
                <span className="font-bold text-stone-700">{pageCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-stone-500"><Ruler className="h-3 w-3" /> Spine</span>
                <span className="font-bold text-stone-700">{spineInches}"</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-stone-500"><Ruler className="h-3 w-3" /> Width</span>
                <span className="font-bold text-stone-700">{coverWidthInches}"</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-stone-500"><LayoutGrid className="h-3 w-3" /> Style</span>
                <span className="font-bold text-stone-700 capitalize">{designStyle}</span>
              </div>
            </div>

            {loadingPages && (
              <div className="mb-3 flex items-center justify-center gap-2 text-xs text-stone-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading page thumbnails...
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="h-11 w-full gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              ) : (
                <><BookOpen className="h-4 w-4" /> Generate Cover PDF</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
