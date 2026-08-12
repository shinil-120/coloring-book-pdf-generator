"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Trash2,
  Copy,
  GripVertical,
  FilePlus2,
  ArrowLeft,
  FileText,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Palette,
  Layers,
  BookOpen,
  Download,
  RefreshCw,
  AlertCircle,
  Files,
  Wand2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCategoryTheme } from "@/lib/coloring-data";
import { MergeBooks } from "@/components/merge-books";
import { CoverGenerator } from "@/components/cover-generator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookMeta {
  name: string;
  url: string;
  slug: string;
  size: string;
  pages: number;
  category: string;
  timestamp: string;
  readableTime: string;
  description: string;
}

interface EditPage {
  id: string;          // unique client id
  sourceIndex: number; // -1 = blank, >=0 = page index in source PDF
  label: string;       // item name or "(blank)"
  thumbnail: string;   // thumbnail URL (empty for blank)
  isBlank: boolean;
}

type Step = "select" | "edit" | "download" | "merge" | "cover" | "assembly";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PdfEditor() {
  const [step, setStep] = useState<Step>("select");
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [allBooks, setAllBooks] = useState<BookMeta[]>([]); // includes covers (for Merge Books)
  const [loadingBooks, setLoadingBooks] = useState(true);

  const [selectedBook, setSelectedBook] = useState<BookMeta | null>(null);
  const [pages, setPages] = useState<EditPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  // base64 PDF data returned from /api/edit-pdf (the source PDF)
  const [pdfData, setPdfData] = useState<string>("");

  const [blanksAdded, setBlanksAdded] = useState(false);
  const [assembling, setAssembling] = useState(false);

  // Edited PDF result
  const [editedPdfUri, setEditedPdfUri] = useState<string>("");
  const [editedInfo, setEditedInfo] = useState<{
    pages: number;
    blankPages: number;
    contentPages: number;
    fileName: string;
  } | null>(null);

  // Page preview modal state (click a page card to view it full-size)
  const [previewPageIdx, setPreviewPageIdx] = useState<number | null>(null);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Load book list ───
  const fetchBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch("/api/books", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const allBooksData: BookMeta[] = Array.isArray(data) ? data : data.books ?? [];
      setAllBooks(allBooksData); // keep all books (including covers) for Merge Books
      // SelectStep: only show interior coloring books (covers are in Merge Books)
      const list: BookMeta[] = allBooksData.filter((b) => b.category !== "Cover");
      setBooks(list);
    } catch {
      setBooks([]);
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // ─── Step 1 → Step 2: load a PDF ───
  const loadBook = useCallback(async (book: BookMeta) => {
    setLoadingPages(true);
    setSelectedBook(book);
    setPages([]);
    setPdfData("");
    setBlanksAdded(false);
    setEditedPdfUri("");
    setEditedInfo(null);
    try {
      const res = await fetch("/api/edit-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfPath: book.url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPdfData(data.pdfData);
      const loaded: EditPage[] = data.pages.map(
        (p: {
          index: number;
          label: string;
          thumbnail: string;
        }) => ({
          id: `page-${p.index}`,
          sourceIndex: p.index,
          label: p.label,
          thumbnail: p.thumbnail,
          isBlank: false,
        })
      );
      setPages(loaded);
      setStep("edit");
      toast.success(`Loaded "${book.name}"`, {
        description: `${data.pageCount} pages ready to edit`,
      });
    } catch (e) {
      toast.error("Failed to load PDF", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
      setSelectedBook(null);
    } finally {
      setLoadingPages(false);
    }
  }, []);

  // ─── Drag handlers ───
  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      setPages((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id);
        const newIndex = prev.findIndex((p) => p.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    []
  );

  // ─── Page actions ───
  const deletePage = useCallback((id: string) => {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next;
    });
    toast("Page deleted", { description: "Removed from the layout" });
  }, []);

  const duplicatePage = useCallback((id: string) => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      const copy: EditPage = {
        ...src,
        id: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: src.label,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    toast.success("Page duplicated", {
      description: "Copy inserted right after the original",
    });
  }, []);

  // ─── Add blank pages (KDP bleed-through prevention) ───
  // Inserts a blank page AFTER each content page (so pages don't bleed
  // through when printed). Result: [page1, blank, page2, blank, page3, ...]
  const addBlankPages = useCallback(() => {
    if (blanksAdded) return;
    setPages((prev) => {
      const next: EditPage[] = [];
      prev.forEach((p) => {
        next.push(p);  // content page FIRST
        next.push({    // blank AFTER
          id: `blank-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sourceIndex: -1,
          label: "(blank)",
          thumbnail: "",
          isBlank: true,
        });
      });
      return next;
    });
    setBlanksAdded(true);
    toast.success("Blank pages added", {
      description: "One blank inserted after each content page (KDP safe)",
    });
  }, [blanksAdded]);

  // ─── Reset to original ───
  const resetPages = useCallback(() => {
    if (!selectedBook) return;
    setBlanksAdded(false);
    setEditedPdfUri("");
    setEditedInfo(null);
    loadBook(selectedBook);
    toast("Reset to original", {
      description: "Reloaded the source PDF",
    });
  }, [selectedBook, loadBook]);

  // ─── Back to selection ───
  const backToSelect = useCallback(() => {
    setStep("select");
    setSelectedBook(null);
    setPages([]);
    setPdfData("");
    setBlanksAdded(false);
    setEditedPdfUri("");
    setEditedInfo(null);
  }, []);

  // ─── Assemble edited PDF ───
  const assemblePdf = useCallback(async () => {
    if (pages.length === 0 || !selectedBook) return;
    setAssembling(true);
    try {
      const pageOrder = pages.map((p) => p.sourceIndex);
      // Send slug instead of pdfData — server fetches PDF from Blob
      // (avoids Vercel 4.5MB body size limit on base64 PDFs)
      const res = await fetch("/api/assemble-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedBook.slug, pageOrder }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEditedPdfUri(data.pdf);
      const baseName = selectedBook
        ? selectedBook.url.split("/").pop() ?? "coloring-book.pdf"
        : "coloring-book.pdf";
      const editedName = baseName.replace(/\.pdf$/i, "") + "-edited.pdf";
      setEditedInfo({
        pages: data.pages,
        blankPages: data.blankPages,
        contentPages: data.contentPages,
        fileName: editedName,
      });
      setStep("download");
      toast.success("Edited PDF ready!", {
        description: `${data.pages} pages assembled`,
      });
    } catch (e) {
      toast.error("Assembly failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setAssembling(false);
    }
  }, [pages, selectedBook]);

  // ─── Download edited PDF ───
  const downloadEdited = useCallback(() => {
    if (!editedPdfUri || !editedInfo) return;
    const a = document.createElement("a");
    a.href = editedPdfUri;
    a.download = editedInfo.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Download started", {
      description: editedInfo.fileName,
    });
  }, [editedPdfUri, editedInfo]);

  // ─── Counts ───
  const counts = useMemo(() => {
    const blank = pages.filter((p) => p.isBlank).length;
    const content = pages.length - blank;
    return { blank, content, total: pages.length };
  }, [pages]);

  // ─── Active drag overlay ───
  const activePage = useMemo(
    () => pages.find((p) => p.id === activeId) ?? null,
    [pages, activeId]
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  if (step === "select") {
    return (
      <SelectStep
        books={books}
        loading={loadingBooks}
        onSelect={loadBook}
        loadingBook={loadingPages ? selectedBook?.slug ?? null : null}
        onRetry={fetchBooks}
        onMerge={() => setStep("merge")}
        onCover={() => setStep("cover")}
      />
    );
  }

  if (step === "merge") {
    return <MergeBooks books={allBooks} onBack={() => setStep("select")} />;
  }

  if (step === "cover") {
    return <CoverGenerator books={books} onBack={() => setStep("select")} />;
  }

  if (step === "download") {
    return (
      <DownloadStep
        info={editedInfo}
        onDownload={downloadEdited}
        onBack={backToSelect}
        onEditAgain={() => setStep("edit")}
      />
    );
  }

  // step === "edit"
  return (
    <div className="space-y-5">
      {/* Top bar: book info + actions */}
      <div className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={backToSelect}
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full text-stone-500 hover:bg-stone-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Change
          </Button>
          <div className="h-6 w-px bg-stone-200" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-stone-800">
              {selectedBook?.name}
            </div>
            <div className="text-xs font-medium text-stone-500">
              {selectedBook?.pages} source pages · {selectedBook?.readableTime}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={addBlankPages}
            disabled={blanksAdded}
            className="h-9 gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-4 text-xs font-bold text-white shadow-sm transition-all hover:from-violet-600 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FilePlus2 className="h-4 w-4" />
            {blanksAdded ? "Blanks Added" : "Add Blank Pages (KDP)"}
          </Button>
          <Button
            onClick={resetPages}
            variant="outline"
            className="h-9 gap-2 rounded-full border-stone-200 px-4 text-xs font-bold text-stone-600 hover:bg-stone-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loadingPages ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm font-bold text-stone-700">
            Loading PDF pages…
          </p>
          <p className="text-xs text-stone-500">
            Fetching thumbnails from the server
          </p>
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-stone-200 bg-white/60 p-16 text-center">
          <AlertCircle className="h-8 w-8 text-stone-400" />
          <p className="text-sm font-bold text-stone-700">No pages loaded</p>
        </div>
      ) : (
        <>
          {/* Hint + KDP specs row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-2.5 text-xs font-medium text-violet-700">
              <Wand2 className="h-3.5 w-3.5 shrink-0" />
              <span>
                Drag the <GripVertical className="inline h-3 w-3" /> handle on any
                page to rearrange. Pink badges = content, grey = blank.
              </span>
            </div>
            {/* KDP specs mini-panel */}
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] font-bold text-amber-800">
              <Palette className="h-3.5 w-3.5 text-amber-600" />
              <span className="hidden sm:inline">KDP Specs:</span>
              <span>8.5×11 in</span>
              <span className="text-amber-300">·</span>
              <span>0.5″ margins</span>
              <span className="text-amber-300">·</span>
              <span>{counts.total}p</span>
            </div>
          </div>

          {/* Grid */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pages.map((p) => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {pages.map((page, idx) => (
                  <SortablePageCard
                    key={page.id}
                    page={page}
                    position={idx + 1}
                    onDelete={() => deletePage(page.id)}
                    onDuplicate={() => duplicatePage(page.id)}
                    onPreview={() => setPreviewPageIdx(idx)}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activePage ? (
                <div className="rotate-3 opacity-90">
                  <PageCardVisual
                    page={activePage}
                    position={
                      pages.findIndex((p) => p.id === activePage.id) + 1
                    }
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Summary bar */}
          <div className="sticky bottom-4 z-30">
            <div className="flex flex-col gap-3 rounded-2xl border border-pink-200 bg-white/95 p-4 shadow-lg shadow-pink-100/50 backdrop-blur-md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-pink-100 px-3 py-1.5 text-xs font-bold text-pink-700">
                    <Files className="mr-1 h-3 w-3" />
                    {counts.total} pages selected
                  </Badge>
                  {counts.blank > 0 ? (
                    <Badge className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-600">
                      {counts.blank} blank + {counts.content} content
                    </Badge>
                  ) : (
                    <Badge className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      All content
                    </Badge>
                  )}
                  {/* KDP compliance badge */}
                  <Badge className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 border border-amber-200" title="8.5 × 11 inches, 0.5 inch margins">
                    <Palette className="mr-1 h-3 w-3" />
                    KDP Ready
                  </Badge>
                </div>

                <Button
                  onClick={assemblePdf}
                  disabled={assembling || pages.length === 0}
                  className="h-11 gap-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-6 text-sm font-bold text-white shadow-md shadow-pink-200 transition-all hover:from-pink-600 hover:to-rose-600 hover:shadow-lg hover:shadow-pink-300 disabled:opacity-60"
                >
                  {assembling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Assembling…
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Create Edited PDF
                    </>
                  )}
                </Button>
              </div>

              {/* Visual proportion bar — content vs blank */}
              {counts.total > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Layout</span>
                  <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                    {counts.blank > 0 && (
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-400 to-rose-400 transition-all duration-500"
                        style={{ width: `${(counts.content / counts.total) * 100}%` }}
                      />
                    )}
                    {counts.blank > 0 && (
                      <div
                        className="absolute inset-y-0 bg-stone-300 transition-all duration-500"
                        style={{
                          left: `${(counts.content / counts.total) * 100}%`,
                          width: `${(counts.blank / counts.total) * 100}%`,
                        }}
                      />
                    )}
                    {counts.blank === 0 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-rose-400" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-stone-500">
                    {counts.content}c{counts.blank > 0 ? ` / ${counts.blank}b` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Page preview modal — click a page card to view it full-size */}
      <PagePreviewModal
        pages={pages}
        currentIndex={previewPageIdx}
        onIndexChange={setPreviewPageIdx}
        bookName={selectedBook?.name}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Select a PDF
// ---------------------------------------------------------------------------

function SelectStep({
  books,
  loading,
  onSelect,
  loadingBook,
  onRetry,
  onMerge,
  onCover,
}: {
  books: BookMeta[];
  loading: boolean;
  onSelect: (book: BookMeta) => void;
  loadingBook: string | null;
  onRetry: () => void;
  onMerge: () => void;
  onCover: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-50 p-6 shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-200 to-purple-200 opacity-40 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white/70 px-3 py-1 text-xs font-bold text-violet-600">
              <FileText className="h-3 w-3" />
              Step 1 · Select a PDF
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-stone-800 sm:text-3xl">
              Choose a coloring book to edit
            </h2>
            <p className="text-sm font-medium text-stone-600">
              Load any generated PDF into the editor. You&apos;ll be able to
              rearrange pages, delete, duplicate, and insert KDP blank pages.
            </p>
          </div>
          {/* CTA buttons: Merge Books + Cover Generator */}
          {!loading && books.length > 0 && (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                onClick={onMerge}
                className="group flex shrink-0 items-center gap-3 rounded-2xl border-2 border-fuchsia-300 bg-white/80 p-3 text-left shadow-sm backdrop-blur transition-all hover:border-fuchsia-400 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-sm transition-transform group-hover:scale-110">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-stone-800">
                    Merge Books
                  </div>
                  <div className="text-[11px] font-medium text-stone-500">
                    Combine multiple into one
                  </div>
                </div>
              </button>
              <button
                onClick={onCover}
                className="group flex shrink-0 items-center gap-3 rounded-2xl border-2 border-indigo-300 bg-white/80 p-3 text-left shadow-sm backdrop-blur transition-all hover:border-indigo-400 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm transition-transform group-hover:scale-110">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-stone-800">
                    Cover Generator
                  </div>
                  <div className="text-[11px] font-medium text-stone-500">
                    KDP paperback cover
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-stone-200 bg-white p-4"
            >
              <div className="mb-2 h-5 w-3/4 rounded bg-stone-200" />
              <div className="mb-3 h-3 w-1/2 rounded bg-stone-100" />
              <div className="h-9 w-full rounded-full bg-stone-200" />
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-violet-200 bg-white/60 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100">
            <FileText className="h-8 w-8 text-violet-400" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-stone-800">
              No PDFs available
            </h3>
            <p className="max-w-sm text-sm font-medium text-stone-500">
              Generate coloring books first — they&apos;ll show up here for
              editing.
            </p>
          </div>
          <Button
            onClick={onRetry}
            variant="outline"
            className="gap-2 rounded-full border-violet-200 text-violet-600 hover:bg-violet-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book, idx) => {
            const isLoading = loadingBook === book.slug;
            const theme = getCategoryTheme(book.category);
            return (
              <button
                key={book.slug ?? idx}
                onClick={() => onSelect(book)}
                disabled={!!loadingBook}
                className={`group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 animate-fade-in-up stagger-${(idx % 6) + 1}`}
              >
                {/* themed top accent */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.gradient}`} />
                <div className="mt-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-stone-800">
                      {book.name}
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-stone-500">
                      {book.pages} pages · {book.size}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 gap-1 rounded-full border ${theme.badgeBg} ${theme.badgeText} text-[10px] font-bold`}
                  >
                    <span className="text-xs leading-none">{theme.emoji}</span>
                    {book.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-stone-400">
                  <RefreshCw className="h-2.5 w-2.5" />
                  {book.readableTime}
                </div>
                <div className="mt-1 flex h-9 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5" />
                      Load in Editor
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable page card
// ---------------------------------------------------------------------------

function SortablePageCard({
  page,
  position,
  onDelete,
  onDuplicate,
  onPreview,
}: {
  page: EditPage;
  position: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "group relative flex flex-col rounded-2xl border bg-white p-2.5 shadow-sm transition-all " +
        (isDragging
          ? "border-violet-400 shadow-xl ring-2 ring-violet-300 scale-105 z-50"
          : "border-stone-200 hover:border-violet-300 hover:shadow-md") +
        (page.isBlank ? " border-dashed" : "")
      }
    >
      {/* Page number badge — larger, more prominent */}
      <div
        className={
          "absolute -left-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold text-white shadow-md ring-2 ring-white transition-transform group-hover:scale-110 " +
          (page.isBlank
            ? "bg-gradient-to-br from-stone-400 to-stone-500"
            : "bg-gradient-to-br from-pink-400 to-rose-500")
        }
        title={page.isBlank ? `Blank page ${position}` : `Page ${position}`}
      >
        {position}
      </div>

      {/* Drag handle — larger, always visible, on the right */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{ touchAction: "none" }}
        className="absolute -right-2 -top-2 z-20 flex h-9 w-9 cursor-grab items-center justify-center rounded-full bg-white text-stone-500 shadow-md ring-2 ring-white transition-all hover:bg-violet-50 hover:text-violet-600 active:cursor-grabbing group-hover:scale-110"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <PageCardVisual page={page} position={position} onPreview={onPreview} />

      {/* Action buttons — always visible (no hover-reveal) */}
      <div className="mt-2 flex items-center gap-1.5">
        <Button
          onClick={onDuplicate}
          size="sm"
          className="h-8 flex-1 gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2 text-[11px] font-bold text-white shadow-sm transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-md"
        >
          <Copy className="h-3 w-3" />
          Copy
        </Button>
        <Button
          onClick={onDelete}
          size="sm"
          className="h-8 flex-1 gap-1 rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-2 text-[11px] font-bold text-white shadow-sm transition-all hover:from-red-600 hover:to-rose-600 hover:shadow-md"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      </div>
    </div>
  );
}

// Visual part of the card (used both in the grid and the drag overlay)
function PageCardVisual({
  page,
  position,
  onPreview,
}: {
  page: EditPage;
  position: number;
  onPreview?: () => void;
}) {
  return (
    <>
      {/* Thumbnail — clickable div (not button, to avoid drag conflicts) */}
      <div
        onClick={onPreview && !page.isBlank ? onPreview : undefined}
        className={
          "relative flex h-[112px] w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br transition-all " +
          (page.isBlank
            ? "from-stone-50 to-stone-100 cursor-default"
            : "from-stone-50 to-white cursor-pointer hover:ring-2 hover:ring-violet-200") +
          (onPreview && !page.isBlank ? " group/thumb" : "")
        }
        role={page.isBlank ? undefined : "button"}
        aria-label={page.isBlank ? "Blank page" : `Preview page ${position}`}
      >
        {page.isBlank ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 border-2 border-dashed border-stone-300 text-stone-400">
            <Eye className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">
              Blank
            </span>
          </div>
        ) : page.thumbnail ? (
          <>
            <img
              src={page.thumbnail}
              alt={`Page ${position} — ${page.label}`}
              className="h-full w-full object-contain p-1.5"
              loading="lazy"
              draggable={false}
            />
            {/* Hover overlay */}
            {onPreview && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-900/0 opacity-0 transition-all group-hover/thumb:bg-stone-900/15 group-hover/thumb:opacity-100">
                <div className="flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-stone-700 shadow-md">
                  <Eye className="h-3 w-3 text-violet-500" />
                  View
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-300">
            <FileText className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Label */}
      <div className="mt-1.5 truncate px-0.5 text-center text-xs font-bold text-stone-700">
        {page.isBlank ? (
          <span className="italic font-medium text-stone-400">(blank)</span>
        ) : (
          page.label
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Download
// ---------------------------------------------------------------------------

function DownloadStep({
  info,
  onDownload,
  onBack,
  onEditAgain,
}: {
  info: {
    pages: number;
    blankPages: number;
    contentPages: number;
    fileName: string;
  } | null;
  onDownload: () => void;
  onBack: () => void;
  onEditAgain: () => void;
}) {
  return (
    <div className="flex justify-center py-6">
      <Card className="w-full max-w-lg overflow-hidden rounded-3xl border-emerald-200 shadow-lg shadow-emerald-100/50">
        <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-emerald-200 opacity-50" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-200">
              <FileText className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Success
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-stone-800">
              Edited PDF Ready!
            </h2>
            <p className="text-sm font-medium text-stone-500">
              Your custom coloring book has been assembled.
            </p>
          </div>

          {info && (
            <div className="grid w-full grid-cols-3 gap-2">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {info.pages}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Total Pages
                </div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {info.contentPages}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Content
                </div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="text-xl font-extrabold text-stone-800">
                  {info.blankPages}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Blank
                </div>
              </div>
            </div>
          )}

          <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 text-xs font-medium text-emerald-700">
            8.5 × 11 inches (Amazon KDP) · 0.5&quot; margins
          </div>

          {info && (
            <div className="w-full truncate rounded-lg bg-stone-100 px-3 py-2 font-mono text-xs text-stone-600">
              {info.fileName}
            </div>
          )}

          <Button
            onClick={onDownload}
            className="h-12 w-full gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-bold text-white shadow-md shadow-emerald-200 transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg hover:shadow-emerald-300"
          >
            <Download className="h-4.5 w-4.5" />
            Download Edited PDF
          </Button>

          <div className="flex w-full gap-2">
            <Button
              onClick={onEditAgain}
              variant="outline"
              className="h-10 flex-1 gap-2 rounded-full border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Edit Again
            </Button>
            <Button
              onClick={onBack}
              variant="outline"
              className="h-10 flex-1 gap-2 rounded-full border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
            >
              <Files className="h-3.5 w-3.5" />
              New PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page preview modal (editor) — click a page card to view it full-size
// ---------------------------------------------------------------------------

function PagePreviewModal({
  pages,
  currentIndex,
  onIndexChange,
  bookName,
}: {
  pages: EditPage[];
  currentIndex: number | null;
  onIndexChange: (idx: number | null) => void;
  bookName?: string;
}) {
  const open = currentIndex !== null;
  const page = currentIndex !== null ? pages[currentIndex] : null;

  // Keyboard navigation
  useEffect(() => {
    if (!open || currentIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndexChange(Math.max(0, currentIndex - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onIndexChange(Math.min(pages.length - 1, currentIndex + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, currentIndex, pages.length, onIndexChange]);

  if (!page || currentIndex === null) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < pages.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <DialogContent className="max-w-3xl overflow-hidden rounded-3xl border-stone-200 bg-white p-0 shadow-2xl">
        <DialogTitle className="sr-only">
          Page {currentIndex + 1} preview
        </DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-violet-500 to-purple-500 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2 text-white">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm font-bold">
              {bookName ? `${bookName} — ` : ""}Page {currentIndex + 1} /{" "}
              {pages.length}
            </span>
          </div>
          <button
            onClick={() => onIndexChange(null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/30 text-white backdrop-blur transition-colors hover:bg-white/50"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main preview area */}
        <div className="relative flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-8">
          {/* Prev/Next */}
          <button
            onClick={() => hasPrev && onIndexChange(currentIndex - 1)}
            disabled={!hasPrev}
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-md backdrop-blur transition-all hover:bg-white hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-30 md:left-4"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => hasNext && onIndexChange(currentIndex + 1)}
            disabled={!hasNext}
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-md backdrop-blur transition-all hover:bg-white hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-30 md:right-4"
            aria-label="Next page"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Page image or blank placeholder */}
          {page.isBlank ? (
            <div className="flex h-[60vh] w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-white text-stone-400">
              <Eye className="h-12 w-12" />
              <span className="text-sm font-bold uppercase tracking-wide">
                Blank Page
              </span>
              <span className="text-xs text-stone-400">
                KDP bleed-through prevention
              </span>
            </div>
          ) : page.thumbnail ? (
            <div className="max-h-[60vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
              <img
                src={page.thumbnail}
                alt={`Page ${currentIndex + 1} — ${page.label}`}
                className="mx-auto h-full w-full object-contain"
                draggable={false}
              />
            </div>
          ) : (
            <div className="flex h-[60vh] w-full items-center justify-center text-stone-300">
              <FileText className="h-12 w-12" />
            </div>
          )}
        </div>

        {/* Footer with label + hint */}
        <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50 px-5 py-2.5">
          <div className="min-w-0">
            <span className="text-xs font-bold text-stone-700">
              {page.isBlank ? "(blank)" : page.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium text-stone-400">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                ←
              </kbd>
              <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                →
              </kbd>
              navigate
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                Esc
              </kbd>
              close
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
