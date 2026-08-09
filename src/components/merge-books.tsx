"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  FileText,
  Layers,
  Loader2,
  Download,
  CheckCircle2,
  Plus,
  Minus,
  X,
  Palette,
  Sparkles,
  Wand2,
  Package,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

interface MergeSelection {
  slug: string;
  count: number;
}

interface MergeResult {
  pdf: string;
  pages: number;
  contentPages: number;
  blankPages: number;
  fileName: string;
}

export function MergeBooks({
  books,
  onBack,
}: {
  books: BookMeta[];
  onBack: () => void;
}) {
  const [selections, setSelections] = useState<MergeSelection[]>([]);
  const [addBlanks, setAddBlanks] = useState(false);
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [bookList, setBookList] = useState<BookMeta[]>(books);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Sync when books prop changes
  useEffect(() => {
    setBookList(books);
  }, [books]);

  const handleDelete = useCallback(async (slug: string, name: string) => {
    setDeleting(slug);
    try {
      const res = await fetch("/api/delete-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      // Remove from local list + selections
      setBookList((prev) => prev.filter((b) => b.slug !== slug));
      setSelections((prev) => prev.filter((s) => s.slug !== slug));
      toast.success(`Deleted "${name}"`, {
        description: "Removed from database and storage",
      });
    } catch (e) {
      toast.error("Delete failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setDeleting(null);
    }
  }, []);

  const toggleBook = useCallback((slug: string, maxPages: number) => {
    setSelections((prev) => {
      const existing = prev.find((s) => s.slug === slug);
      if (existing) {
        return prev.filter((s) => s.slug !== slug);
      }
      return [...prev, { slug, count: Math.min(5, maxPages) }];
    });
  }, []);

  const setCount = useCallback((slug: string, count: number, max: number) => {
    const clamped = Math.max(1, Math.min(max, count));
    setSelections((prev) =>
      prev.map((s) => (s.slug === slug ? { ...s, count: clamped } : s))
    );
  }, []);

  const removeBook = useCallback((slug: string) => {
    setSelections((prev) => prev.filter((s) => s.slug !== slug));
  }, []);

  const totals = useMemo(() => {
    const content = selections.reduce((sum, s) => sum + s.count, 0);
    const blank = addBlanks ? content : 0;
    return { content, blank, total: content + blank };
  }, [selections, addBlanks]);

  const handleMerge = useCallback(async () => {
    if (selections.length === 0) return;
    setMerging(true);
    setResult(null);
    try {
      const res = await fetch("/api/merge-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          books: selections.map((s) => ({ slug: s.slug, pages: s.count })),
          addBlanks,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult({
        pdf: data.pdf,
        pages: data.pages,
        contentPages: data.contentPages,
        blankPages: data.blankPages,
        fileName: data.fileName,
      });
      toast.success("Compilation ready!", {
        description: `${data.pages} pages assembled`,
      });
    } catch (e) {
      toast.error("Merge failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setMerging(false);
    }
  }, [selections, addBlanks]);

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

  // Result screen
  if (result) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border-emerald-200 bg-white shadow-lg shadow-emerald-100/50">
          <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="flex flex-col items-center gap-5 p-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-200 opacity-50" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-200">
                <Package className="h-10 w-10 text-white" strokeWidth={2} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Compilation Ready!
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-stone-800">
                Merged PDF Complete
              </h2>
              <p className="text-sm font-medium text-stone-500">
                {selections.length} books combined into one PDF
              </p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {result.pages}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Total
                </div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {result.contentPages}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Content
                </div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {result.blankPages}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Blank
                </div>
              </div>
            </div>
            <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 text-xs font-medium text-emerald-700">
              8.5 × 11 inches (Amazon KDP) · 0.5″ margins
            </div>
            <div className="w-full truncate rounded-lg bg-stone-100 px-3 py-2 font-mono text-xs text-stone-600">
              {result.fileName}
            </div>
            <Button
              onClick={handleDownload}
              className="h-12 w-full gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-bold text-white shadow-md shadow-emerald-200 transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg hover:shadow-emerald-300"
            >
              <Download className="h-4.5 w-4.5" />
              Download Compilation PDF
            </Button>
            <Button
              onClick={() => setResult(null)}
              variant="outline"
              className="h-10 w-full gap-2 rounded-full border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Merge Builder
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-fuchsia-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
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
              <Sparkles className="h-4 w-4 text-fuchsia-500" />
              Merge Builder
            </div>
            <div className="text-xs font-medium text-stone-500">
              Combine pages from multiple books into one compilation
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Blanks toggle */}
          <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5">
            <Palette className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-xs font-bold text-stone-600">KDP blanks</span>
            <Switch
              checked={addBlanks}
              onCheckedChange={setAddBlanks}
              className="scale-90"
            />
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 rounded-xl border border-fuchsia-100 bg-fuchsia-50/60 px-4 py-2.5 text-xs font-medium text-fuchsia-700">
        <Wand2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          Click books below to add them to your compilation, then adjust the
          page count for each. Great for themed collections!
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Book selection grid */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-stone-700">
              Available Books ({bookList.length})
            </h3>
            <span className="text-xs font-medium text-stone-400">
              Click to add →
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {bookList.map((book, idx) => {
              const isSelected = selections.some((s) => s.slug === book.slug);
              const theme = getCategoryTheme(book.category);
              const isCover = book.category === "Cover";
              const isDeleting = deleting === book.slug;
              return (
                <div
                  key={book.slug ?? idx}
                  className={`group relative flex flex-col gap-1.5 overflow-hidden rounded-2xl border-2 bg-white p-3 text-left shadow-sm transition-all hover:shadow-md ${
                    isSelected
                      ? "border-fuchsia-400 ring-2 ring-fuchsia-200"
                      : "border-stone-200 hover:border-stone-300"
                  } ${isDeleting ? "opacity-50" : ""}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.gradient}`} />
                  {/* Delete button for covers */}
                  {isCover && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${book.name}"? This removes it from all databases.`)) {
                          handleDelete(book.slug, book.name);
                        }
                      }}
                      disabled={isDeleting}
                      className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-all hover:bg-red-600"
                      aria-label="Delete cover"
                      title="Delete from database and storage"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => toggleBook(book.slug, book.pages)}
                    disabled={isDeleting}
                    className="flex flex-1 flex-col gap-1.5 text-left"
                  >
                    <div className="mt-1 flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold text-stone-800">
                          {book.name.replace(" Coloring Book", "")}
                        </div>
                        <div className="text-[10px] font-medium text-stone-500">
                          {book.pages} pages available
                        </div>
                      </div>
                      {!isCover && (
                        <Badge
                          variant="outline"
                          className={`shrink-0 gap-0.5 rounded-full border ${theme.badgeBg} ${theme.badgeText} text-[9px] font-bold`}
                        >
                          <span className="text-[10px] leading-none">{theme.emoji}</span>
                        </Badge>
                      )}
                    </div>
                    {isSelected && (
                      <div className={`absolute right-${isCover ? '8' : '1.5'} top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-500 text-white shadow-sm`}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar: compilation summary */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border-2 border-fuchsia-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-sm">
                <Layers className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-extrabold text-stone-800">
                Your Compilation
              </h3>
            </div>

            {selections.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 py-8 text-center">
                <Package className="h-8 w-8 text-stone-300" />
                <p className="text-xs font-bold text-stone-500">
                  No books selected yet
                </p>
                <p className="text-[10px] text-stone-400">
                  Click books on the left to add them
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3 max-h-64 space-y-2 overflow-y-auto scroll-pretty pr-1">
                  {selections.map((sel) => {
                    const book = books.find((b) => b.slug === sel.slug);
                    if (!book) return null;
                    const theme = getCategoryTheme(book.category);
                    return (
                      <div
                        key={sel.slug}
                        className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2"
                      >
                        <Badge
                          variant="outline"
                          className={`shrink-0 gap-0.5 rounded-full border ${theme.badgeBg} ${theme.badgeText} text-[9px] font-bold`}
                        >
                          <span className="text-[10px] leading-none">{theme.emoji}</span>
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-stone-700">
                            {book.name.replace(" Coloring Book", "")}
                          </div>
                        </div>
                        {/* Page count stepper */}
                        <div className="flex items-center gap-1 rounded-full border border-stone-200 bg-white p-0.5">
                          <button
                            onClick={() => setCount(sel.slug, sel.count - 1, book.pages)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                            aria-label="Decrease pages"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[24px] text-center text-xs font-extrabold text-stone-700">
                            {sel.count}
                          </span>
                          <button
                            onClick={() => setCount(sel.slug, sel.count + 1, book.pages)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                            aria-label="Increase pages"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeBook(sel.slug)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-red-50 hover:text-red-500"
                          aria-label="Remove book"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-fuchsia-50 p-2 text-center">
                    <div className="text-lg font-extrabold text-fuchsia-700">
                      {totals.content}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-fuchsia-600">
                      Content
                    </div>
                  </div>
                  <div className="rounded-lg bg-stone-100 p-2 text-center">
                    <div className="text-lg font-extrabold text-stone-600">
                      {totals.blank}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-stone-500">
                      Blank
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2 text-center">
                    <div className="text-lg font-extrabold text-emerald-700">
                      {totals.total}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">
                      Total
                    </div>
                  </div>
                </div>

                {/* Proportion bar */}
                {totals.total > 0 && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-fuchsia-400 to-pink-400 transition-all duration-500"
                        style={{ width: `${(totals.content / totals.total) * 100}%` }}
                      />
                      {totals.blank > 0 && (
                        <div
                          className="absolute inset-y-0 bg-stone-300 transition-all duration-500"
                          style={{
                            left: `${(totals.content / totals.total) * 100}%`,
                            width: `${(totals.blank / totals.total) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleMerge}
                  disabled={merging || selections.length === 0}
                  className="h-11 w-full gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-sm font-bold text-white shadow-md shadow-fuchsia-200 transition-all hover:from-fuchsia-600 hover:to-pink-600 hover:shadow-lg hover:shadow-fuchsia-300 disabled:opacity-60"
                >
                  {merging ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Merging…
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Create Compilation ({totals.total}p)
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
