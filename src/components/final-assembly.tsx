"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Download,
  CheckCircle2,
  BookOpen,
  Wand2,
  Sparkles,
  Package,
  Layers,
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

interface AssemblyResult {
  pdf: string;
  pages: number;
  coverPages: number;
  interiorPages: number;
  fileName: string;
}

// Preset cover themes (same as cover-generator)
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

export function FinalAssembly({
  books,
  onBack,
}: {
  books: BookMeta[];
  onBack: () => void;
}) {
  const [interiorSlug, setInteriorSlug] = useState<string>(books[0]?.slug ?? "");
  const [includeCover, setIncludeCover] = useState(true);
  const [coverThemeIdx, setCoverThemeIdx] = useState(0);
  const [title, setTitle] = useState("My Coloring Book");
  const [author, setAuthor] = useState("Coloring Book Studio");
  const [subject, setSubject] = useState("Amazon KDP Coloring Book");
  const [keywords, setKeywords] = useState("coloring book, KDP, kids, activity");
  const [assembling, setAssembling] = useState(false);
  const [result, setResult] = useState<AssemblyResult | null>(null);

  const selectedBook = books.find((b) => b.slug === interiorSlug);
  const pageCount = selectedBook?.pages ?? 100;
  const theme = THEMES[coverThemeIdx];

  const handleAssemble = useCallback(async () => {
    if (!interiorSlug) {
      toast.error("Please select an interior book");
      return;
    }
    if (!title.trim() || !author.trim()) {
      toast.error("Title and author are required");
      return;
    }
    setAssembling(true);
    setResult(null);
    try {
      // If including a cover, generate it first
      let coverData: string | undefined;
      if (includeCover) {
        toast.info("Generating cover…", { description: theme.name + " theme" });
        const coverRes = await fetch("/api/generate-cover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            author: author.trim(),
            subtitle: `${pageCount} fun pages to color`,
            pageCount,
            bgGradient: theme.colors,
            spineColor: theme.colors[0],
          }),
        });
        if (!coverRes.ok) {
          const err = await coverRes.json().catch(() => ({}));
          throw new Error(`Cover generation failed: ${err.error || coverRes.status}`);
        }
        const coverJson = await coverRes.json();
        coverData = coverJson.pdf;
      }

      // Assemble final PDF
      toast.info("Assembling final PDF…", { description: "Injecting metadata" });
      const res = await fetch("/api/final-assembly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interiorSlug,
          coverData,
          title: title.trim(),
          author: author.trim(),
          subject: subject.trim(),
          keywords: keywords.trim(),
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
        coverPages: data.coverPages,
        interiorPages: data.interiorPages,
        fileName: data.fileName,
      });
      toast.success("Final PDF assembled!", {
        description: `${data.pages} pages (cover + interior)`,
      });
    } catch (e) {
      toast.error("Assembly failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setAssembling(false);
    }
  }, [interiorSlug, includeCover, title, author, subject, keywords, pageCount, theme]);

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
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border-emerald-200 bg-white shadow-lg shadow-emerald-100/50">
          <div className="h-2 w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500" />
          <div className="flex flex-col items-center gap-5 p-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-200 opacity-50" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-500 shadow-lg shadow-emerald-200">
                <Package className="h-10 w-10 text-white" strokeWidth={2} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Final PDF Ready!
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-stone-800">
                KDP-Ready File Assembled
              </h2>
              <p className="text-sm font-medium text-stone-500">
                Cover + interior + metadata combined
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
                  {result.coverPages}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Cover
                </div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {result.interiorPages}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Interior
                </div>
              </div>
            </div>
            <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 text-xs font-medium text-emerald-700">
              <Sparkles className="mr-1 inline h-3 w-3" />
              Metadata injected: Title, Author, Subject, Keywords
            </div>
            <div className="w-full truncate rounded-lg bg-stone-100 px-3 py-2 font-mono text-xs text-stone-600">
              {result.fileName}
            </div>
            <Button
              onClick={handleDownload}
              className="h-12 w-full gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-bold text-white shadow-md shadow-emerald-200 transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg hover:shadow-emerald-300"
            >
              <Download className="h-4.5 w-4.5" />
              Download Final PDF
            </Button>
            <Button
              onClick={() => setResult(null)}
              variant="outline"
              className="h-10 w-full gap-2 rounded-full border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Assembly Builder
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
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
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
              <Package className="h-4 w-4 text-emerald-500" />
              Final Assembly
            </div>
            <div className="text-xs font-medium text-stone-500">
              Combine cover + interior + metadata into one KDP-ready file
            </div>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 text-xs font-medium text-emerald-700">
        <Wand2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          Select your interior book, optionally generate a cover, enter your
          metadata, and download a single print-ready PDF.
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div className="space-y-4">
          {/* Interior selection */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
              Interior Book (coloring pages)
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {books.map((book) => {
                const isSelected = interiorSlug === book.slug;
                const theme = getCategoryTheme(book.category);
                return (
                  <button
                    key={book.slug}
                    onClick={() => setInteriorSlug(book.slug)}
                    className={`group relative flex flex-col gap-1 overflow-hidden rounded-xl border-2 bg-white p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-emerald-400 ring-2 ring-emerald-200"
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

          {/* Cover option */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Include Cover?
              </Label>
              <button
                onClick={() => setIncludeCover((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  includeCover ? "bg-emerald-500" : "bg-stone-300"
                }`}
                aria-label="Toggle cover"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    includeCover ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            {includeCover && (
              <div>
                <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
                  Cover Theme
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {THEMES.map((t, i) => (
                    <button
                      key={t.name}
                      onClick={() => setCoverThemeIdx(i)}
                      className={`group relative overflow-hidden rounded-xl border-2 p-1 transition-all ${
                        coverThemeIdx === i
                          ? "border-emerald-400 ring-2 ring-emerald-200"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                      title={t.name}
                    >
                      <div
                        className="h-8 w-full rounded-lg"
                        style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
                      />
                      <div className="mt-0.5 text-center text-[8px] font-bold text-stone-600">
                        {t.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
              Document Metadata
            </Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="meta-title" className="mb-1 block text-[11px] font-bold text-stone-600">
                  Title
                </Label>
                <Input
                  id="meta-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 rounded-xl border-stone-200 bg-stone-50 text-sm font-bold text-stone-800 focus:border-emerald-300 focus:bg-white"
                />
              </div>
              <div>
                <Label htmlFor="meta-author" className="mb-1 block text-[11px] font-bold text-stone-600">
                  Author
                </Label>
                <Input
                  id="meta-author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="h-9 rounded-xl border-stone-200 bg-stone-50 text-sm font-medium text-stone-700 focus:border-emerald-300 focus:bg-white"
                />
              </div>
              <div>
                <Label htmlFor="meta-subject" className="mb-1 block text-[11px] font-bold text-stone-600">
                  Subject
                </Label>
                <Input
                  id="meta-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-9 rounded-xl border-stone-200 bg-stone-50 text-sm font-medium text-stone-700 focus:border-emerald-300 focus:bg-white"
                />
              </div>
              <div>
                <Label htmlFor="meta-keywords" className="mb-1 block text-[11px] font-bold text-stone-600">
                  Keywords (comma-separated)
                </Label>
                <Input
                  id="meta-keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="h-9 rounded-xl border-stone-200 bg-stone-50 text-sm font-medium text-stone-700 focus:border-emerald-300 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar: summary */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                <Layers className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-extrabold text-stone-800">
                Assembly Summary
              </h3>
            </div>

            {/* Structure breakdown */}
            <div className="mb-3 space-y-2">
              <div className={`flex items-center gap-2 rounded-xl border p-2.5 transition-opacity ${includeCover ? "border-indigo-200 bg-indigo-50/50" : "border-stone-200 bg-stone-50 opacity-40"}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-stone-700">Cover</div>
                  <div className="text-[10px] text-stone-500">
                    {includeCover ? `${theme.name} theme` : "Not included"}
                  </div>
                </div>
                {includeCover && <Badge className="bg-indigo-100 text-[9px] text-indigo-700">1p</Badge>}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-stone-700">
                    {selectedBook?.name.replace(" Coloring Book", "") ?? "—"}
                  </div>
                  <div className="text-[10px] text-stone-500">{pageCount} pages</div>
                </div>
                <Badge className="bg-emerald-100 text-[9px] text-emerald-700">{pageCount}p</Badge>
              </div>
            </div>

            {/* Total */}
            <div className="mb-3 flex items-center justify-between rounded-xl bg-stone-50 p-3">
              <span className="text-xs font-bold text-stone-600">Total pages</span>
              <span className="text-lg font-extrabold text-stone-800">
                {(includeCover ? 1 : 0) + pageCount}
              </span>
            </div>

            {/* Metadata preview */}
            <div className="mb-3 rounded-xl bg-stone-50 p-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Metadata
              </div>
              <div className="space-y-0.5 text-[11px]">
                <div className="flex gap-1">
                  <span className="font-bold text-stone-500">Title:</span>
                  <span className="truncate font-semibold text-stone-700">{title || "—"}</span>
                </div>
                <div className="flex gap-1">
                  <span className="font-bold text-stone-500">Author:</span>
                  <span className="truncate font-semibold text-stone-700">{author || "—"}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleAssemble}
              disabled={assembling}
              className="h-11 w-full gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-bold text-white shadow-md shadow-emerald-200 transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-60"
            >
              {assembling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assembling…
                </>
              ) : (
                <>
                  <Package className="h-4 w-4" />
                  Assemble Final PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
