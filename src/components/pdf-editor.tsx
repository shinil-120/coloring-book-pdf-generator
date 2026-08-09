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
  CheckCircle2,
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

type Step = "select" | "edit" | "download";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PdfEditor() {
  const [step, setStep] = useState<Step>("select");
  const [books, setBooks] = useState<BookMeta[]>([]);
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

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Load book list ───
  const fetchBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch("/downloads/coloring-books.json", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: BookMeta[] = Array.isArray(data) ? data : data.books ?? [];
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
  const addBlankPages = useCallback(() => {
    if (blanksAdded) return;
    setPages((prev) => {
      const next: EditPage[] = [];
      prev.forEach((p) => {
        next.push({
          id: `blank-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sourceIndex: -1,
          label: "(blank)",
          thumbnail: "",
          isBlank: true,
        });
        next.push(p);
      });
      return next;
    });
    setBlanksAdded(true);
    toast.success("Blank pages added", {
      description: "One blank inserted before each content page (KDP safe)",
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
    if (!pdfData || pages.length === 0) return;
    setAssembling(true);
    try {
      const pageOrder = pages.map((p) => p.sourceIndex);
      const res = await fetch("/api/assemble-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfData, pageOrder }),
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
  }, [pdfData, pages, selectedBook]);

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
      />
    );
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
          {/* Hint */}
          <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-2.5 text-xs font-medium text-violet-700">
            <Wand2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              Drag the <GripVertical className="inline h-3 w-3" /> handle on any
              page to rearrange. Pink badges = content, grey = blank.
            </span>
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
            <div className="flex flex-col gap-3 rounded-2xl border border-pink-200 bg-white/95 p-4 shadow-lg shadow-pink-100/50 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-pink-100 px-3 py-1.5 text-xs font-bold text-pink-700">
                  <Files className="mr-1 h-3 w-3" />
                  {counts.total} pages selected
                </Badge>
                {counts.blank > 0 && (
                  <Badge className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-600">
                    {counts.blank} blank + {counts.content} content
                  </Badge>
                )}
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
          </div>
        </>
      )}
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
}: {
  books: BookMeta[];
  loading: boolean;
  onSelect: (book: BookMeta) => void;
  loadingBook: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-50 p-6 shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-200 to-purple-200 opacity-40 blur-2xl" />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white/70 px-3 py-1 text-xs font-bold text-violet-600">
            <FileText className="h-3 w-3" />
            Step 1 · Select a PDF
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-stone-800 sm:text-3xl">
            Choose a coloring book to edit
          </h2>
          <p className="max-w-xl text-sm font-medium text-stone-600">
            Load any generated PDF into the editor. You&apos;ll be able to
            rearrange pages, delete, duplicate, and insert KDP blank pages.
          </p>
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
            return (
              <button
                key={book.slug ?? idx}
                onClick={() => onSelect(book)}
                disabled={!!loadingBook}
                className="group relative flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-2">
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
                    className="shrink-0 rounded-full border-violet-200 bg-violet-50 text-[10px] font-bold text-violet-600"
                  >
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
}: {
  page: EditPage;
  position: number;
  onDelete: () => void;
  onDuplicate: () => void;
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
          ? "border-violet-400 shadow-lg ring-2 ring-violet-200"
          : "border-stone-200 hover:border-stone-300 hover:shadow-md") +
        (page.isBlank ? " border-dashed" : "")
      }
    >
      {/* Page number badge */}
      <div
        className={
          "absolute -left-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white shadow-sm ring-2 ring-white " +
          (page.isBlank
            ? "bg-stone-400"
            : "bg-gradient-to-br from-pink-400 to-rose-500")
        }
      >
        {position}
      </div>

      {/* Drag handle */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 cursor-grab items-center justify-center rounded-full bg-white text-stone-400 shadow-sm ring-2 ring-white transition-colors hover:text-violet-500 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <PageCardVisual page={page} position={position} />

      {/* Action buttons */}
      <div className="mt-2 flex items-center gap-1.5">
        <Button
          onClick={onDuplicate}
          size="sm"
          className="h-7 flex-1 gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2 text-[10px] font-bold text-white shadow-sm hover:from-emerald-600 hover:to-teal-600"
        >
          <Copy className="h-3 w-3" />
          Dup
        </Button>
        <Button
          onClick={onDelete}
          size="sm"
          className="h-7 flex-1 gap-1 rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-2 text-[10px] font-bold text-white shadow-sm hover:from-red-600 hover:to-rose-600"
        >
          <Trash2 className="h-3 w-3" />
          Del
        </Button>
      </div>
    </div>
  );
}

// Visual part of the card (used both in the grid and the drag overlay)
function PageCardVisual({
  page,
  position,
}: {
  page: EditPage;
  position: number;
}) {
  return (
    <>
      {/* Thumbnail */}
      <div
        className={
          "relative flex h-[112px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br " +
          (page.isBlank
            ? "from-stone-50 to-stone-100"
            : "from-stone-50 to-white")
        }
      >
        {page.isBlank ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 border-2 border-dashed border-stone-300 text-stone-400">
            <Eye className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">
              Blank
            </span>
          </div>
        ) : page.thumbnail ? (
          <img
            src={page.thumbnail}
            alt={`Page ${position} — ${page.label}`}
            className="h-full w-full object-contain p-1.5"
            loading="lazy"
            draggable={false}
          />
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
