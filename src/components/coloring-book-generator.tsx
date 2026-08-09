"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Download,
  Clock,
  FileText,
  Sparkles,
  ImageIcon,
  Layers,
  RefreshCw,
  AlertCircle,
  BookOpen,
  Palette,
  Search,
  X,
  Grid3x3,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
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

export function ColoringBookGenerator() {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/downloads/coloring-books.json", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const list: BookMeta[] = Array.isArray(data) ? data : data.books ?? [];
      setBooks(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load books");
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleDownload = (book: BookMeta) => {
    toast.success(`Downloading "${book.name}"`, {
      description: `${book.pages} pages · ${book.size}`,
    });
    const a = document.createElement("a");
    a.href = book.url;
    a.download = book.url.split("/").pop() ?? "coloring-book.pdf";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Unique categories for the filter chips
  const categories = useMemo(() => {
    const set = new Set(books.map((b) => b.category));
    return Array.from(set).sort();
  }, [books]);

  // Filtered + searched books
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter((b) => {
      if (activeCategory !== "all" && b.category !== activeCategory) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
      );
    });
  }, [books, search, activeCategory]);

  return (
    <div className="space-y-6">
      {/* Hero / intro banner */}
      <div className="relative overflow-hidden rounded-3xl border border-rose-200 bg-gradient-to-br from-pink-100 via-rose-50 to-amber-50 p-6 shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 -mr-12 -mt-12 h-48 w-48 rounded-full bg-gradient-to-br from-pink-200 to-orange-200 opacity-40 blur-2xl" />
        <div className="absolute bottom-0 left-1/3 -mb-16 h-40 w-40 rounded-full bg-gradient-to-tr from-amber-200 to-rose-200 opacity-40 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white/70 px-3 py-1 text-xs font-bold text-rose-600">
              <Sparkles className="h-3 w-3" />
              AI-Generated Coloring Books
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-stone-800 sm:text-3xl">
              Your Coloring Book Library
            </h2>
            <p className="text-sm font-medium text-stone-600">
              Download KDP-ready PDFs — each page features a colored reference,
              clean B&amp;W line art, and the item title. No covers, no blanks.
            </p>
          </div>
          <Button
            onClick={fetchBooks}
            variant="outline"
            className="h-11 shrink-0 gap-2 rounded-full border-rose-200 bg-white/80 px-5 text-sm font-bold text-stone-700 hover:bg-rose-50 hover:text-rose-600"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Books Available"
          value={loading ? "—" : String(books.length)}
          tint="bg-pink-50 text-pink-600 border-pink-100"
        />
        <StatCard
          icon={<Layers className="h-5 w-5" />}
          label="Total Pages"
          value={loading ? "—" : String(books.reduce((s, b) => s + b.pages, 0))}
          tint="bg-orange-50 text-orange-600 border-orange-100"
        />
        <StatCard
          icon={<ImageIcon className="h-5 w-5" />}
          label="Categories"
          value={loading ? "—" : String(new Set(books.map((b) => b.category)).size)}
          tint="bg-emerald-50 text-emerald-600 border-emerald-100"
        />
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Storage Used"
          value={
            loading
              ? "—"
              : formatBytes(books.reduce((s, b) => s + (b.sizeBytes || 0), 0))
          }
          tint="bg-violet-50 text-violet-600 border-violet-100"
        />
      </div>

      {/* Search + filter bar */}
      {!loading && !error && books.length > 0 && (
        <SearchBar
          search={search}
          onSearch={setSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={setActiveCategory}
          viewMode={viewMode}
          onViewMode={setViewMode}
          resultCount={filtered.length}
        />
      )}

      {/* Books grid / list */}
      {loading ? (
        <LoadingGrid />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchBooks} />
      ) : books.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <NoResults search={search} onClear={() => { setSearch(""); setActiveCategory("all"); }} />
      ) : viewMode === "list" ? (
        <div className="space-y-3">
          {filtered.map((book, idx) => (
            <BookRow
              key={book.slug ?? idx}
              book={book}
              index={idx}
              onDownload={() => handleDownload(book)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((book, idx) => (
            <BookCard
              key={book.slug ?? idx}
              book={book}
              index={idx}
              onDownload={() => handleDownload(book)}
            />
          ))}
        </div>
      )}

      {/* Info box */}
      <InfoBox />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SearchBar({
  search,
  onSearch,
  categories,
  activeCategory,
  onCategory,
  viewMode,
  onViewMode,
  resultCount,
}: {
  search: string;
  onSearch: (v: string) => void;
  categories: string[];
  activeCategory: string;
  onCategory: (c: string) => void;
  viewMode: "grid" | "list";
  onViewMode: (m: "grid" | "list") => void;
  resultCount: number;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/80 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by name, category, or description…"
            className="h-10 rounded-full border-stone-200 bg-stone-50 pl-10 pr-9 text-sm font-medium text-stone-700 placeholder:text-stone-400 focus:border-rose-300 focus:bg-white"
          />
          {search && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-stone-200 text-stone-500 hover:bg-stone-300"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Result count + view toggle */}
        <div className="flex items-center gap-2">
          <span className="hidden whitespace-nowrap text-xs font-bold text-stone-500 sm:inline">
            {resultCount} {resultCount === 1 ? "book" : "books"}
          </span>
          <div className="flex items-center gap-0.5 rounded-full border border-stone-200 bg-stone-50 p-0.5">
            <button
              onClick={() => onViewMode("grid")}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-rose-500 shadow-sm"
                  : "text-stone-400 hover:text-stone-600"
              }`}
              aria-label="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewMode("list")}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                viewMode === "list"
                  ? "bg-white text-rose-500 shadow-sm"
                  : "text-stone-400 hover:text-stone-600"
              }`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category chips */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onCategory("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
            activeCategory === "all"
              ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          All ({categories.length})
        </button>
        {categories.map((cat) => {
          const theme = getCategoryTheme(cat);
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onCategory(cat)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                active
                  ? `${theme.badgeBg} ${theme.badgeText} ring-2 ring-offset-1`
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              <span className="text-xs leading-none">{theme.emoji}</span>
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BookRow({
  book,
  index,
  onDownload,
}: {
  book: BookMeta;
  index: number;
  onDownload: () => void;
}) {
  const theme = getCategoryTheme(book.category);
  const thumb = `/downloads/thumbnails/${book.slug}/page-1.png`;

  return (
    <div
      className={`group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm transition-all hover:border-stone-300 hover:shadow-md animate-fade-in-up stagger-${(index % 6) + 1}`}
    >
      {/* thumbnail */}
      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-100 bg-gradient-to-br from-stone-50 to-stone-100">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.gradient}`} />
        <img
          src={thumb}
          alt={`${book.name} preview`}
          className="h-full w-full object-contain p-1.5"
          loading="lazy"
        />
      </div>

      {/* info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={`gap-1 rounded-full border ${theme.badgeBg} ${theme.badgeText} text-[10px] font-bold`}>
            <span className="text-xs leading-none">{theme.emoji}</span>
            {book.category}
          </Badge>
          <span className="text-[10px] font-bold text-stone-400">#{index + 1}</span>
        </div>
        <h4 className="mt-0.5 truncate text-sm font-extrabold text-stone-800">{book.name}</h4>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold text-stone-500">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3" /> {book.pages} pages
          </span>
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3 w-3" /> {book.size}
          </span>
          <span className="inline-flex items-center gap-1 text-stone-400">
            <Clock className="h-3 w-3" /> {book.readableTime}
          </span>
        </div>
      </div>

      {/* download */}
      <Button
        onClick={onDownload}
        size="sm"
        className="h-9 shrink-0 gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-xs font-bold text-white shadow-sm hover:from-emerald-600 hover:to-teal-600"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </Button>
    </div>
  );
}

function NoResults({
  search,
  onClear,
}: {
  search: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-stone-200 bg-white/60 p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
        <Search className="h-7 w-7 text-stone-400" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-stone-700">No books found</h3>
        <p className="text-sm font-medium text-stone-500">
          {search ? (
            <>No matches for &ldquo;<span className="font-bold text-stone-700">{search}</span>&rdquo;</>
          ) : (
            "Try a different category"
          )}
        </p>
      </div>
      <Button
        onClick={onClear}
        variant="outline"
        className="gap-2 rounded-full border-stone-200 text-stone-600 hover:bg-stone-50"
      >
        <X className="h-4 w-4" />
        Clear filters
      </Button>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border ${tint} p-4`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xl font-extrabold leading-tight text-stone-800">
          {value}
        </div>
        <div className="truncate text-[11px] font-semibold text-stone-500">
          {label}
        </div>
      </div>
    </div>
  );
}

function BookCard({
  book,
  index,
  onDownload,
}: {
  book: BookMeta;
  index: number;
  onDownload: () => void;
}) {
  const theme = getCategoryTheme(book.category);

  // Thumbnail path
  const thumb = `/downloads/thumbnails/${book.slug}/page-1.png`;

  return (
    <Card
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border-stone-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-100/60 animate-fade-in-up stagger-${(index % 6) + 1}`}
    >
      {/* Top accent bar with gradient */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${theme.gradient}`} />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className="shrink-0 rounded-full bg-stone-100 text-[10px] font-bold text-stone-600"
              >
                #{index + 1}
              </Badge>
              <Badge
                variant="outline"
                className={`shrink-0 gap-1 rounded-full border ${theme.badgeBg} ${theme.badgeText} text-[10px] font-bold`}
              >
                <span className="text-xs leading-none">{theme.emoji}</span>
                {book.category}
              </Badge>
            </div>
            <CardTitle className="truncate text-base font-extrabold leading-tight text-stone-800">
              {book.name}
            </CardTitle>
            <CardDescription className="text-xs font-medium text-stone-500">
              {book.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col pb-3">
        {/* Thumbnail preview — no timestamp overlay (moved below) */}
        <div className="relative mb-3 flex h-40 items-center justify-center overflow-hidden rounded-xl border border-stone-100 bg-gradient-to-br from-stone-50 to-stone-100">
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.gradient} opacity-60`} />
          <img
            src={thumb}
            alt={`${book.name} page 1 preview`}
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const parent = e.currentTarget.parentElement;
              if (parent && !parent.querySelector(".thumb-fallback")) {
                const fb = document.createElement("div");
                fb.className =
                  "thumb-fallback flex h-full w-full flex-col items-center justify-center gap-2 text-stone-400";
                fb.innerHTML =
                  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20v14H2z"/><path d="M8 21h8"/><path d="M12 17v4"/></svg><span class="text-xs font-semibold">Preview N/A</span>';
                parent.appendChild(fb);
              }
            }}
          />
        </div>

        {/* Meta row */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-stone-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1">
            <FileText className="h-3 w-3 text-stone-500" />
            {book.pages}p
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1">
            <Layers className="h-3 w-3 text-stone-500" />
            {book.size}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
            <Palette className="h-3 w-3" />
            KDP
          </span>
        </div>

        {/* Timestamp — subtle, below meta */}
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-stone-400">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">{book.readableTime || "—"}</span>
        </div>

        {/* Spacer pushes download button to bottom for alignment */}
        <div className="flex-1" />
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          onClick={onDownload}
          className="h-11 w-full gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-bold text-white shadow-md shadow-emerald-200 transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg hover:shadow-emerald-300"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </CardFooter>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-3 h-1.5 w-full rounded-full bg-stone-200" />
          <div className="mb-2 h-4 w-20 rounded bg-stone-200" />
          <div className="mb-3 h-5 w-3/4 rounded bg-stone-200" />
          <div className="mb-4 h-40 w-full rounded-xl bg-stone-100" />
          <div className="mb-4 flex gap-2">
            <div className="h-6 w-16 rounded-full bg-stone-100" />
            <div className="h-6 w-16 rounded-full bg-stone-100" />
          </div>
          <div className="h-11 w-full rounded-full bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-red-200 bg-red-50/50 p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
        <AlertCircle className="h-7 w-7 text-red-500" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-stone-800">
          Could not load coloring books
        </h3>
        <p className="text-sm font-medium text-stone-500">{error}</p>
        <p className="text-xs text-stone-400">
          Make sure <code className="rounded bg-white px-1.5 py-0.5">/downloads/coloring-books.json</code> exists.
        </p>
      </div>
      <Button
        onClick={onRetry}
        variant="outline"
        className="gap-2 rounded-full border-red-200 text-red-600 hover:bg-red-50"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-rose-200 bg-white/60 p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-100 to-rose-100">
        <BookOpen className="h-8 w-8 text-rose-400" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-stone-800">No books yet</h3>
        <p className="max-w-sm text-sm font-medium text-stone-500">
          Run the generation script to create coloring book PDFs. They&apos;ll
          appear here automatically once <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">coloring-books.json</code> is
          written.
        </p>
      </div>
      <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 font-mono text-xs text-stone-600">
        bun run scripts/regenerate-pdfs-no-covers.ts
      </div>
    </div>
  );
}

function InfoBox() {
  const items = [
    {
      icon: "🚫",
      title: "No covers, no blanks",
      desc: "Page 1 is the first item — nothing extra added.",
    },
    {
      icon: "🎨",
      title: "Colored reference + B&W line art",
      desc: "Top-left reference shows colors, center has the coloring image.",
    },
    {
      icon: "🌈",
      title: "Natural colors per category",
      desc: "Fruits = red/green, ocean = blue/grey, dragons = thematic.",
    },
    {
      icon: "🔢",
      title: "Page numbers in bottom-right",
      desc: "1-indexed, printed in light grey (10pt Helvetica).",
    },
    {
      icon: "📐",
      title: "Amazon KDP ready",
      desc: "8.5 × 11 inches, 0.5 inch margins on every page.",
    },
    {
      icon: "✏️",
      title: "Clean B&W outlines",
      desc: "Thinned 30% for a crisp, professional coloring experience.",
    },
  ];

  return (
    <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-200">
          <Sparkles className="h-4.5 w-4.5 text-amber-700" />
        </div>
        <h3 className="text-base font-extrabold text-stone-800">
          What&apos;s inside each book?
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-white/70 p-3.5"
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-stone-800">
                {item.title}
              </div>
              <div className="text-xs font-medium text-stone-500">
                {item.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
