"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  FileText,
  Clock,
  Layers,
  Palette,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCategoryTheme, type CategoryTheme } from "@/lib/coloring-data";

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

interface PageData {
  index: number;
  pageNumber: number;
  label: string;
  thumbnail: string;
}

interface BookPreviewModalProps {
  book: BookMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (book: BookMeta) => void;
}

export function BookPreviewModal({
  book,
  open,
  onOpenChange,
  onDownload,
}: BookPreviewModalProps) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  const theme: CategoryTheme = book
    ? getCategoryTheme(book.category)
    : getCategoryTheme("default");

  const fetchPages = useCallback(async (slug: string) => {
    setLoading(true);
    setError(null);
    setPages([]);
    try {
      const res = await fetch("/api/book-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPages(data.pages || []);
      setCurrentIdx(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && book) {
      fetchPages(book.slug);
    }
  }, [open, book, fetchPages]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setPages([]);
      setError(null);
      setCurrentIdx(0);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIdx((i) => Math.min(pages.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, pages.length]);

  const currentPage = pages[currentIdx];
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < pages.length - 1;

  const handleDownload = () => {
    if (book) {
      onOpenChange(false);
      onDownload(book);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden rounded-3xl border-stone-200 bg-white p-0 shadow-2xl">
        <DialogTitle className="sr-only">{book?.name} Preview</DialogTitle>
        {/* Header with gradient */}
        <div className={`relative bg-gradient-to-r ${theme.gradient} px-6 py-4`}>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/30 text-white backdrop-blur transition-colors hover:bg-white/50"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 pr-12">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-2xl backdrop-blur">
              {theme.emoji}
            </div>
            <div className="min-w-0 text-white">
              <h2 className="truncate text-lg font-extrabold drop-shadow-sm">
                {book?.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-white/90">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {book?.pages} pages
                </span>
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {book?.size}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {book?.readableTime}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body: main preview + thumbnails strip */}
        <div className="flex flex-col md:flex-row">
          {/* Main preview area */}
          <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-8">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Loader2 className="h-10 w-10 animate-spin text-stone-400" />
                <p className="text-sm font-bold text-stone-500">
                  Loading pages…
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
                  <X className="h-7 w-7 text-red-500" />
                </div>
                <p className="text-sm font-bold text-stone-700">
                  Failed to load pages
                </p>
                <p className="max-w-xs text-xs text-stone-500">{error}</p>
              </div>
            ) : currentPage ? (
              <>
                {/* Page label badge */}
                <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-stone-700 shadow-sm backdrop-blur">
                  <Eye className="h-3 w-3 text-rose-500" />
                  Page {currentPage.pageNumber} / {pages.length}
                  <span className="mx-1 text-stone-300">·</span>
                  <span className="text-stone-500">{currentPage.label}</span>
                </div>

                {/* Prev/Next buttons */}
                <button
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  disabled={!hasPrev}
                  className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-md backdrop-blur transition-all hover:bg-white hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30 md:left-4"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={() =>
                    setCurrentIdx((i) => Math.min(pages.length - 1, i + 1))
                  }
                  disabled={!hasNext}
                  className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-md backdrop-blur transition-all hover:bg-white hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30 md:right-4"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>

                {/* Main image */}
                <div className="relative max-h-[60vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
                  <img
                    src={currentPage.thumbnail}
                    alt={`Page ${currentPage.pageNumber} — ${currentPage.label}`}
                    className="mx-auto h-full w-full object-contain"
                    draggable={false}
                  />
                </div>
              </>
            ) : null}
          </div>

          {/* Thumbnail strip (right sidebar on desktop, bottom on mobile) */}
          {!loading && !error && pages.length > 0 && (
            <div className="flex max-h-[40vh] flex-col border-t border-stone-200 bg-white md:max-h-[70vh] md:w-56 md:border-l md:border-t-0">
              <div className="flex items-center gap-1.5 border-b border-stone-100 px-4 py-2.5 text-xs font-bold text-stone-600">
                <Layers className="h-3.5 w-3.5 text-rose-500" />
                All Pages ({pages.length})
              </div>
              <div className="scroll-pretty flex-1 overflow-y-auto p-2.5">
                <div className="grid grid-cols-3 gap-2 md:grid-cols-2">
                  {pages.map((page, i) => (
                    <button
                      key={page.index}
                      onClick={() => setCurrentIdx(i)}
                      className={`group relative overflow-hidden rounded-lg border-2 bg-white transition-all ${
                        i === currentIdx
                          ? "border-rose-400 shadow-md ring-2 ring-rose-100"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                      title={`Page ${page.pageNumber} — ${page.label}`}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-stone-50">
                        <img
                          src={page.thumbnail}
                          alt={`Page ${page.pageNumber}`}
                          className="h-full w-full object-contain p-0.5"
                          loading="lazy"
                        />
                      </div>
                      <div className="px-1 py-0.5 text-center text-[9px] font-bold text-stone-500">
                        {page.pageNumber}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Download button at bottom of sidebar */}
              <div className="border-t border-stone-100 p-3">
                <Button
                  onClick={handleDownload}
                  className="h-10 w-full gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold text-white shadow-md shadow-emerald-200 transition-all hover:from-emerald-600 hover:to-teal-600"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        {!loading && !error && pages.length > 0 && (
          <div className="flex items-center justify-center gap-4 border-t border-stone-100 bg-stone-50 px-4 py-2 text-[11px] font-medium text-stone-400">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                ←
              </kbd>
              <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                →
              </kbd>
              to navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                Esc
              </kbd>
              to close
            </span>
            <span className="hidden items-center gap-1 sm:inline-flex">
              <Palette className="h-3 w-3" />
              KDP 8.5×11
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
