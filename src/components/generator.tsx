"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  Settings2,
  Layers,
  Sparkles,
  Search,
  Check,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  FileText,
  Pause,
  Play,
  Power,
  RotateCcw,
  ShieldCheck,
  DollarSign,
  Image as ImageIcon,
  ChevronDown,
  RefreshCw,
  FilePlus2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ManageCategories } from "@/components/manage-categories";
import { ManageProviders } from "@/components/manage-providers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  themeColor: string;
  description: string;
  isBuiltin: boolean;
  itemCount: number;
}

interface Item {
  id: string;
  name: string;
  sortOrder: number;
  isDeleted: boolean;
}

interface Provider {
  id: string;
  type: string;
  label: string;
  apiKeyEnv: string;
  model: string | null;
  dailyLimit: number | null;
  isActive: boolean;
  isConfigured: boolean;
  usedToday: number;
  spentToday: number;
  failoverOrder: number;
}

interface ProviderMeta {
  type: string;
  name: string;
  emoji: string;
}

interface BudgetResponse {
  todaySpend: number;
  allTimeSpend: number;
  imageCount: number;
  byProvider: {
    label: string;
    providerId: string | null;
    todaySpend: number;
    todayCount: number;
    allTimeSpend: number;
    allTimeCount: number;
  }[];
  providers?: Provider[];
}

interface BudgetProviderRow {
  label: string;
  providerId: string | null;
  todaySpend: number;
  todayCount: number;
  allTimeSpend: number;
  allTimeCount: number;
}

interface GenerateItemResult {
  itemName: string;
  success: boolean;
  skipped: boolean;
  providerLabel?: string;
  providerType?: string;
  costUsd: number;
  blobUrl?: string | null;
  sizeBytes?: number;
  error?: string;
  durationMs?: number;
}

interface GenerateSummary {
  totalItems: number;
  success: number;
  failed: number;
  skipped: number;
  totalCostUsd: number;
  results: GenerateItemResult[];
}

interface GenerateResponse {
  success: boolean;
  summary?: GenerateSummary;
  remainingItems?: string[];
  batchDurationMs?: number;
  category?: { slug: string; name: string };
  quality?: string;
  size?: string;
  batchSize?: number;
  resumeMode?: boolean;
  providersTried?: string[];
  dryRun?: boolean;
  perImageCostUsd?: number;
  providerLabel?: string;
  providerType?: string | null;
  providersConfigured?: number;
  error?: string;
}

interface ItemState {
  name: string;
  status: "pending" | "running" | "success" | "skipped" | "failed";
  providerLabel?: string;
  providerType?: string;
  costUsd?: number;
  durationMs?: number;
  blobUrl?: string | null;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const KDP_MIN_PAGES = 24;
const KDP_MAX_PAGES = 828;

const QUALITY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    priceRange: "$0.001 – $0.011 / image",
    description: "Fastest, cheapest. Good for drafts.",
    color: "text-emerald-600",
  },
  {
    value: "medium",
    label: "Medium",
    priceRange: "$0.003 – $0.042 / image",
    description: "Recommended balance of cost & quality.",
    color: "text-amber-600",
  },
  {
    value: "high",
    label: "High",
    priceRange: "$0.041 – $0.167 / image",
    description: "Best prompt fidelity. Use for final books.",
    color: "text-rose-600",
  },
];

const QUICK_PAGE_OPTIONS = [20, 24, 30, 40, 50, 100];

const THEME_COLOR_HEX: Record<string, string> = {
  emerald: "#10b981",
  sky: "#0ea5e9",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  lime: "#84cc16",
  orange: "#f97316",
  fuchsia: "#d946ef",
  indigo: "#6366f1",
  stone: "#78716c",
};

const PROVIDER_EMOJI: Record<string, string> = {
  openai: "🟢",
  zai: "🟣",
  deepinfra: "🔵",
  fal: "🟡",
  together: "🟠",
  replicate: "⚫",
  cloudflare: "🟠",
};

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────

export function Generator() {
  // ─── Categories + items state ───
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [categoryItems, setCategoryItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [selectedItemNames, setSelectedItemNames] = useState<Set<string>>(new Set());

  // ─── Generator state ───
  const [pageCount, setPageCount] = useState<number>(30);
  const [quality, setQuality] = useState<string>("medium");
  const [resumeMode, setResumeMode] = useState(true);

  // ─── Budget + providers ───
  const [budget, setBudget] = useState<BudgetResponse | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerMeta, setProviderMeta] = useState<Record<string, ProviderMeta>>({});

  // ─── Generation state ───
  const [itemStates, setItemStates] = useState<ItemState[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentItemIdx, setCurrentItemIdx] = useState<number>(-1);
  const [totalCost, setTotalCost] = useState(0);
  const [cancelRequested, setCancelRequested] = useState(false);

  // ─── Dry run estimate ───
  const [dryRunResult, setDryRunResult] = useState<GenerateResponse | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);

  // ─── PDF assembly state ───
  const [assembling, setAssembling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfMeta, setPdfMeta] = useState<{ pages: number; missing: number; name: string } | null>(null);

  // ─── Manage modals ───
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [manageProvidersOpen, setManageProvidersOpen] = useState(false);

  // ─── Refs ───
  const cancelRef = useRef(false);

  // ─── Fetch categories ───
  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const res = await fetch("/api/categories", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setCategories(data.categories ?? []);
    } catch (err) {
      setCategoriesError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  // ─── Fetch items for a category ───
  const fetchItems = useCallback(async (slug: string) => {
    setItemsLoading(true);
    setItemsError(null);
    setCategoryItems([]);
    setSelectedItemNames(new Set());
    try {
      const res = await fetch(`/api/categories/${slug}/items`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setCategoryItems(data.items ?? []);
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // ─── Fetch budget + providers ───
  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch("/api/budget", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setBudget(data);
        if (Array.isArray(data.providers)) {
          setProviders(data.providers);
        }
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/providers", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setProviders(data.providers ?? []);
        setProviderMeta(data.metadata ?? {});
      }
    } catch {
      // Non-fatal
    }
  }, []);

  // ─── Initial load ───
  useEffect(() => {
    fetchCategories();
    fetchBudget();
    fetchProviders();
  }, [fetchCategories, fetchBudget, fetchProviders]);

  // ─── When category changes, fetch items ───
  useEffect(() => {
    if (selectedSlug) {
      fetchItems(selectedSlug);
    }
  }, [selectedSlug, fetchItems]);

  // ─── Derived state ───
  const selectedCategory = useMemo(
    () => categories.find((c) => c.slug === selectedSlug) ?? null,
    [categories, selectedSlug]
  );

  const maxSelectable = useMemo(() => Math.min(pageCount, categoryItems.length), [pageCount, categoryItems.length]);

  const selectedCount = selectedItemNames.size;

  // Clamp selection if user reduces pageCount below selected count
  useEffect(() => {
    if (selectedItemNames.size > maxSelectable) {
      const arr = Array.from(selectedItemNames).slice(0, maxSelectable);
      setSelectedItemNames(new Set(arr));
    }
  }, [maxSelectable, selectedItemNames]);

  // ─── Selection helpers ───
  const toggleItem = useCallback(
    (name: string) => {
      setSelectedItemNames((prev) => {
        const next = new Set(prev);
        if (next.has(name)) {
          next.delete(name);
        } else {
          if (next.size >= maxSelectable) {
            toast.warning(`Maximum ${maxSelectable} items selectable`, {
              description: "Increase page count or deselect an item first.",
            });
            return prev;
          }
          next.add(name);
        }
        return next;
      });
    },
    [maxSelectable]
  );

  const selectAll = useCallback(() => {
    const all = categoryItems.slice(0, maxSelectable).map((i) => i.name);
    setSelectedItemNames(new Set(all));
  }, [categoryItems, maxSelectable]);

  const selectNone = useCallback(() => {
    setSelectedItemNames(new Set());
  }, []);

  const selectFirstN = useCallback(
    (n: number) => {
      const arr = categoryItems.slice(0, Math.min(n, maxSelectable)).map((i) => i.name);
      setSelectedItemNames(new Set(arr));
    },
    [categoryItems, maxSelectable]
  );

  const selectRandomN = useCallback(
    (n: number) => {
      const shuffled = [...categoryItems].sort(() => Math.random() - 0.5);
      const arr = shuffled.slice(0, Math.min(n, maxSelectable)).map((i) => i.name);
      setSelectedItemNames(new Set(arr));
    },
    [categoryItems, maxSelectable]
  );

  // ─── KDP compliance ───
  const kdpCompliant = useMemo(() => {
    return pageCount >= KDP_MIN_PAGES && pageCount <= KDP_MAX_PAGES;
  }, [pageCount]);

  const kdpHint = useMemo(() => {
    if (pageCount < KDP_MIN_PAGES) {
      return {
        ok: false,
        text: `⚠️ Below KDP minimum (${KDP_MIN_PAGES} pages) — Amazon will reject`,
      };
    }
    if (pageCount > KDP_MAX_PAGES) {
      return {
        ok: false,
        text: `⚠️ Above KDP maximum (${KDP_MAX_PAGES} pages)`,
      };
    }
    return {
      ok: true,
      text: `✓ KDP-valid (${KDP_MIN_PAGES}-${KDP_MAX_PAGES} pages)`,
    };
  }, [pageCount]);

  // ─── Dry run (estimate) ───
  const handleDryRun = useCallback(async () => {
    if (!selectedSlug) {
      toast.error("Pick a category first");
      return;
    }
    if (selectedItemNames.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    setDryRunLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug: selectedSlug,
          itemNames: Array.from(selectedItemNames),
          quality,
          dryRun: true,
          resumeMode,
        }),
      });
      const data: GenerateResponse = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setDryRunResult(data);
      toast.success("Cost estimate ready", {
        description: data.providersConfigured === 0
          ? "No providers configured — add one to generate"
          : `Estimate via ${data.providerLabel}`,
      });
    } catch (err) {
      toast.error("Dry run failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDryRunLoading(false);
    }
  }, [selectedSlug, selectedItemNames, quality, resumeMode]);

  // ─── Generate (batch loop, with cancel support) ───
  const handleGenerate = useCallback(async () => {
    if (!selectedSlug) {
      toast.error("Pick a category first");
      return;
    }
    if (selectedItemNames.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    if (providers.filter((p) => p.isActive && p.isConfigured).length === 0) {
      toast.error("No active providers configured", {
        description: "Open Manage Providers to add an API key.",
      });
      return;
    }

    cancelRef.current = false;
    setCancelRequested(false);
    setIsGenerating(true);
    setPdfUrl(null);
    setPdfMeta(null);
    setTotalCost(0);

    // Initialize per-item state in selection order
    const names = Array.from(selectedItemNames);
    const initial: ItemState[] = names.map((name) => ({
      name,
      status: "pending",
    }));
    setItemStates(initial);

    let processedCost = 0;
    let remaining = [...names];

    // Batch loop — Vercel 60s limit means we call /api/generate repeatedly
    // with batchSize=5 until all items are done or cancelled.
    try {
      while (remaining.length > 0 && !cancelRef.current) {
        // Mark next batch as "running"
        const batchSize = Math.min(5, remaining.length);
        const batch = remaining.slice(0, batchSize);

        setItemStates((prev) =>
          prev.map((it) =>
            batch.includes(it.name) && it.status === "pending"
              ? { ...it, status: "running" }
              : it
          )
        );
        setCurrentItemIdx(names.indexOf(batch[0]));

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categorySlug: selectedSlug,
            itemNames: remaining, // send full list, server slices to batchSize
            quality,
            batchSize,
            resumeMode,
          }),
        });

        const data: GenerateResponse = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }

        const summary = data.summary;
        if (!summary) {
          throw new Error("Server returned no summary");
        }

        // Update per-item states based on the results
        setItemStates((prev) => {
          const next = [...prev];
          for (const r of summary.results) {
            const idx = next.findIndex((it) => it.name === r.itemName);
            if (idx === -1) continue;
            next[idx] = {
              name: r.itemName,
              status: r.success
                ? r.skipped
                  ? "skipped"
                  : "success"
                : "failed",
              providerLabel: r.providerLabel,
              providerType: r.providerType,
              costUsd: r.costUsd,
              durationMs: r.durationMs,
              blobUrl: r.blobUrl ?? null,
              error: r.error,
            };
          }
          return next;
        });

        processedCost += summary.totalCostUsd;
        setTotalCost(processedCost);

        // Update remaining: server returns remaining items (not processed in this batch)
        remaining = Array.isArray(data.remainingItems) ? data.remainingItems : [];
      }

      if (cancelRef.current) {
        toast.info("Generation cancelled", {
          description: `${processedCost.toFixed(3)} spent so far.`,
        });
      } else {
        toast.success("Generation complete!", {
          description: `Total cost: $${processedCost.toFixed(3)}`,
        });
      }
    } catch (err) {
      toast.error("Generation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsGenerating(false);
      setCurrentItemIdx(-1);
      fetchBudget();
    }
  }, [selectedSlug, selectedItemNames, providers, quality, resumeMode, fetchBudget]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    setCancelRequested(true);
    toast.info("Cancelling after current item…");
  }, []);

  // ─── Assemble PDF ───
  const handleAssemblePdf = useCallback(async () => {
    if (!selectedSlug || itemStates.length === 0) return;
    setAssembling(true);
    try {
      // Use items that succeeded OR were skipped (i.e. had an image)
      const successItems = itemStates
        .filter((s) => s.status === "success" || s.status === "skipped")
        .map((s) => s.name);
      if (successItems.length === 0) {
        toast.error("No generated images to assemble");
        return;
      }
      const res = await fetch("/api/assemble-category-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug: selectedSlug,
          itemNames: successItems,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setPdfUrl(data.pdf);
      setPdfMeta({
        pages: data.pages,
        missing: data.missingItems ?? 0,
        name: `${selectedCategory?.name ?? selectedSlug}-Coloring-Book.pdf`,
      });
      toast.success(`PDF assembled: ${data.pages} pages`, {
        description: data.missingItems > 0
          ? `${data.missingItems} items had no image`
          : "All items included",
      });
    } catch (err) {
      toast.error("PDF assembly failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAssembling(false);
    }
  }, [selectedSlug, itemStates, selectedCategory]);

  // ─── Refresh handlers ───
  const handleManageCategoriesChanged = useCallback(() => {
    fetchCategories();
    if (selectedSlug) fetchItems(selectedSlug);
  }, [fetchCategories, fetchItems, selectedSlug]);

  const handleManageProvidersChanged = useCallback(() => {
    fetchBudget();
    fetchProviders();
  }, [fetchBudget, fetchProviders]);

  // ─── Derived: readyToGenerate ───
  const readyToGenerate = useMemo(() => {
    return (
      !!selectedSlug &&
      selectedItemNames.size > 0 &&
      !isGenerating &&
      providers.some((p) => p.isActive && p.isConfigured)
    );
  }, [selectedSlug, selectedItemNames, isGenerating, providers]);

  const successCount = useMemo(
    () => itemStates.filter((s) => s.status === "success" || s.status === "skipped").length,
    [itemStates]
  );
  const failedCount = useMemo(
    () => itemStates.filter((s) => s.status === "failed").length,
    [itemStates]
  );
  const runningCount = useMemo(
    () => itemStates.filter((s) => s.status === "running").length,
    [itemStates]
  );
  const pendingCount = useMemo(
    () => itemStates.filter((s) => s.status === "pending").length,
    [itemStates]
  );

  const allDone = useMemo(
    () => itemStates.length > 0 && successCount + failedCount === itemStates.length,
    [itemStates, successCount, failedCount]
  );

  const progressPercent = useMemo(() => {
    if (itemStates.length === 0) return 0;
    return Math.round(((successCount + failedCount) / itemStates.length) * 100);
  }, [itemStates, successCount, failedCount]);

  // ─── Render ───
  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ══════════════════ LEFT: Controls ══════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-5 shadow-sm sm:p-6">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-orange-200/40 to-rose-200/40 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 via-rose-400 to-pink-500 shadow-lg shadow-rose-200">
                <Wand2 className="h-6 w-6 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold tracking-tight text-stone-800 sm:text-xl">
                    Generate coloring books
                  </h2>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setManageCategoriesOpen(true)}
                      className="h-8 gap-1.5 rounded-full border-amber-200 bg-white/80 px-3 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
                    >
                      <Settings2 className="h-3 w-3" /> Categories
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setManageProvidersOpen(true)}
                      className="h-8 gap-1.5 rounded-full border-rose-200 bg-white/80 px-3 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                    >
                      <ShieldCheck className="h-3 w-3" /> Providers
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-sm leading-snug text-stone-600">
                  Multi-provider AI failover across OpenAI, Z.AI, DeepInfra,
                  fal.ai, Together, Replicate &amp; Cloudflare.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="bg-white/70 text-[11px] text-amber-700 hover:bg-white/70">
                    <Sparkles className="mr-1 h-3 w-3" /> Multi-provider failover
                  </Badge>
                  <Badge variant="secondary" className="bg-white/70 text-[11px] text-rose-700 hover:bg-white/70">
                    <Layers className="mr-1 h-3 w-3" /> {categories.length || "—"} categories
                  </Badge>
                  <Badge variant="secondary" className="bg-white/70 text-[11px] text-orange-700 hover:bg-white/70">
                    <DollarSign className="mr-1 h-3 w-3" /> $0.003/image from $5
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Category picker */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm font-bold text-stone-700">Category</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setManageCategoriesOpen(true)}
                className="h-7 gap-1 px-2 text-[11px] text-stone-500 hover:text-rose-600"
              >
                <Settings2 className="h-3 w-3" /> Manage
              </Button>
            </div>
            {categoriesLoading ? (
              <Skeleton className="h-11 w-full rounded-xl" />
            ) : categoriesError ? (
              <Alert variant="destructive" className="py-2">
                <AlertDescription>{categoriesError}</AlertDescription>
              </Alert>
            ) : categories.length === 0 ? (
              <p className="text-xs text-stone-500">No categories available.</p>
            ) : (
              <Select value={selectedSlug} onValueChange={setSelectedSlug}>
                <SelectTrigger className="h-11 w-full rounded-xl border-stone-200 bg-white">
                  <SelectValue placeholder="Pick a category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      <span className="mr-2">{c.emoji}</span>
                      <span className="font-semibold">{c.name}</span>
                      <span className="ml-2 text-xs text-stone-500">
                        ({c.itemCount})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedCategory && (
              <div className="mt-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3">
                <div className="flex items-start gap-2">
                  <div
                    className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: THEME_COLOR_HEX[selectedCategory.themeColor] ?? "#78716c",
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-700">
                      {selectedCategory.emoji} {selectedCategory.name}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {selectedCategory.description || "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Item picker */}
          {selectedSlug && (
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-sm font-bold text-stone-700">
                  Items
                  <Badge variant="secondary" className="ml-2 bg-stone-100 text-[10px] text-stone-600">
                    {selectedCount} of {categoryItems.length}
                  </Badge>
                </Label>
                <span className="text-[11px] text-stone-500">
                  Max: {maxSelectable}
                </span>
              </div>

              {itemsLoading ? (
                <div className="space-y-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-lg" />
                  ))}
                </div>
              ) : itemsError ? (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription>{itemsError}</AlertDescription>
                </Alert>
              ) : categoryItems.length === 0 ? (
                <p className="text-xs text-stone-500">No items in this category.</p>
              ) : (
                <>
                  {/* Quick actions */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={selectAll}
                      className="h-8 rounded-lg border-stone-200 px-2.5 text-[11px] font-bold text-stone-600 hover:bg-stone-50"
                    >
                      <Check className="mr-1 h-3 w-3" /> All
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={selectNone}
                      className="h-8 rounded-lg border-stone-200 px-2.5 text-[11px] font-bold text-stone-600 hover:bg-stone-50"
                    >
                      None
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => selectFirstN(Math.min(10, maxSelectable))}
                      className="h-8 rounded-lg border-stone-200 px-2.5 text-[11px] font-bold text-stone-600 hover:bg-stone-50"
                    >
                      First {Math.min(10, maxSelectable)}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => selectRandomN(Math.min(10, maxSelectable))}
                      className="h-8 rounded-lg border-stone-200 px-2.5 text-[11px] font-bold text-stone-600 hover:bg-stone-50"
                    >
                      Random {Math.min(10, maxSelectable)}
                    </Button>
                  </div>

                  {/* Item list (scrollable) */}
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/30 p-2">
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {categoryItems.map((item) => {
                        const checked = selectedItemNames.has(item.name);
                        const disabled = !checked && selectedItemNames.size >= maxSelectable;
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                              checked
                                ? "bg-rose-50 text-rose-700"
                                : "text-stone-700 hover:bg-stone-100",
                              disabled && "cursor-not-allowed opacity-50"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={() => toggleItem(item.name)}
                              className="data-[state=checked]:bg-rose-500 data-[state=checked]:border-rose-500"
                            />
                            <span className="truncate">{item.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Page count slider */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <Label className="text-sm font-bold text-stone-700">Page count</Label>
              <Badge
                variant="secondary"
                className={cn(
                  "text-sm font-extrabold tabular-nums",
                  kdpCompliant
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                )}
              >
                {pageCount}
              </Badge>
            </div>
            <Slider
              value={[pageCount]}
              min={1}
              max={100}
              step={1}
              onValueChange={(v) => setPageCount(v[0] ?? 30)}
              className="h-6"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_PAGE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPageCount(n)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-bold transition-all",
                    pageCount === n
                      ? "border-transparent bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-sm"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p
              className={cn(
                "mt-3 text-[11px] font-semibold",
                kdpHint.ok ? "text-emerald-600" : "text-amber-600"
              )}
            >
              {kdpHint.text}
            </p>
          </div>

          {/* Quality selector */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <Label className="text-sm font-bold text-stone-700">Quality</Label>
              <span className="text-[11px] text-stone-500">Varies by provider</span>
            </div>
            <RadioGroup
              value={quality}
              onValueChange={setQuality}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {QUALITY_OPTIONS.map((q) => (
                <label
                  key={q.value}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-all",
                    quality === q.value
                      ? "border-transparent bg-gradient-to-br from-stone-800 to-stone-700 text-white shadow-md"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value={q.value}
                      checked={quality === q.value}
                      className={quality === q.value ? "border-white text-white" : ""}
                    />
                    <span className={cn("text-sm font-bold", quality === q.value ? "text-white" : "text-stone-700")}>
                      {q.label}
                    </span>
                  </div>
                  <span className={cn("ml-6 text-[10px] font-semibold", quality === q.value ? "text-stone-300" : q.color)}>
                    {q.priceRange}
                  </span>
                  <span className={cn("ml-6 text-[10px]", quality === q.value ? "text-stone-300" : "text-stone-500")}>
                    {q.description}
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Budget + Providers summary (compact) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Budget card */}
            <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <p className="text-xs font-bold text-stone-700">Budget</p>
              </div>
              {budget ? (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-stone-500">Spent today</span>
                    <span className="text-sm font-bold tabular-nums text-stone-800">
                      ${budget.todaySpend.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-stone-500">All-time</span>
                    <span className="text-sm font-bold tabular-nums text-stone-800">
                      ${budget.allTimeSpend.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-stone-500">Images</span>
                    <span className="text-sm font-bold tabular-nums text-stone-800">
                      {budget.imageCount}
                    </span>
                  </div>
                </div>
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
            </div>

            {/* Active providers card */}
            <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-rose-500" />
                  <p className="text-xs font-bold text-stone-700">Providers</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setManageProvidersOpen(true)}
                  className="h-7 px-2 text-[11px] text-stone-500 hover:text-rose-600"
                >
                  Manage →
                </Button>
              </div>
              {providers.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-stone-500">No providers configured</p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setManageProvidersOpen(true)}
                    className="h-9 gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-3 text-xs font-bold text-white"
                  >
                    <ShieldCheck className="h-3 w-3" /> Add a provider
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {providers.slice(0, 3).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="text-base leading-none">
                        {PROVIDER_EMOJI[p.type] ?? "🔌"}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-stone-700">
                        {p.label}
                      </span>
                      {p.isConfigured ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      )}
                    </div>
                  ))}
                  {providers.length > 3 && (
                    <p className="text-[10px] text-stone-400">
                      +{providers.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Resume mode + generate */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between rounded-xl bg-stone-50/80 p-3">
              <div>
                <p className="text-xs font-bold text-stone-700">
                  Continue from where I left off
                </p>
                <p className="text-[11px] text-stone-500">
                  Skip items that already have images (resumable batches).
                </p>
              </div>
              <Switch checked={resumeMode} onCheckedChange={setResumeMode} />
            </div>

            {/* Generate button */}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={!readyToGenerate}
              className="h-12 w-full gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-base font-bold shadow-lg shadow-orange-200 transition-all hover:shadow-xl hover:shadow-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating… ({successCount}/{itemStates.length})
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  Generate {selectedItemNames.size} Pages
                </>
              )}
            </Button>

            {/* Dry Run button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleDryRun}
              disabled={dryRunLoading || !selectedSlug || selectedItemNames.size === 0}
              className="mt-2 h-11 w-full gap-2 rounded-2xl border-stone-200 bg-white text-sm font-bold text-stone-700 hover:bg-stone-50"
            >
              {dryRunLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="h-4 w-4" />
              )}
              Estimate cost (no charge)
            </Button>

            {/* Dry run result */}
            <AnimatePresence>
              {dryRunResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                    <div className="flex items-start gap-2">
                      <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div className="flex-1 text-xs">
                        <p className="font-bold text-stone-800">
                          Estimated cost:{" "}
                          <span className="tabular-nums">
                            ${dryRunResult.summary?.totalCostUsd.toFixed(3)}
                          </span>
                        </p>
                        <p className="text-[11px] text-stone-600">
                          {dryRunResult.providersConfigured === 0
                            ? "No providers configured — add one first."
                            : `Via ${dryRunResult.providerLabel} · ${dryRunResult.summary?.success} to generate, ${dryRunResult.summary?.skipped} already exist`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDryRunResult(null)}
                        className="h-7 w-7 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ══════════════════ RIGHT: Progress + Results ══════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="space-y-5"
        >
          {/* Progress card (during generation) */}
          <AnimatePresence>
            {(isGenerating || itemStates.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-700">
                    {isGenerating ? "Generating…" : "Results"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-stone-100 text-[11px] text-stone-600">
                      ${totalCost.toFixed(3)} spent
                    </Badge>
                    {isGenerating ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={cancelRequested}
                        className="h-8 gap-1.5 rounded-lg border-rose-200 px-3 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                      >
                        {cancelRequested ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Pause className="h-3 w-3" />
                        )}
                        {cancelRequested ? "Cancelling…" : "Cancel"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Progress bar */}
                {itemStates.length > 0 && (
                  <div className="mb-3 space-y-1">
                    <Progress value={progressPercent} className="h-2" />
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span>
                        {successCount} ✓ · {failedCount} ✗ · {runningCount} running · {pendingCount} pending
                      </span>
                      <span className="font-bold tabular-nums">{progressPercent}%</span>
                    </div>
                  </div>
                )}

                {/* Current item highlight */}
                {isGenerating && currentItemIdx >= 0 && itemStates[currentItemIdx] && (
                  <div className="mb-3 rounded-xl bg-gradient-to-br from-rose-50 to-amber-50 p-3">
                    <p className="text-xs font-bold text-rose-700">
                      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                      Generating {itemStates[currentItemIdx].name}…
                      <span className="ml-1 text-rose-500">
                        ({currentItemIdx + 1}/{itemStates.length})
                      </span>
                    </p>
                  </div>
                )}

                {/* Per-item status list */}
                {itemStates.length > 0 && (
                  <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                    {itemStates.map((s, idx) => (
                      <ItemStatusRow key={`${s.name}-${idx}`} state={s} index={idx} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results gallery */}
          {allDone && itemStates.some((s) => s.blobUrl) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <h3 className="mb-3 text-sm font-bold text-stone-700">
                Generated Images
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {itemStates
                  .filter((s) => s.blobUrl)
                  .map((s, idx) => (
                    <ResultThumbnail key={`${s.name}-${idx}`} state={s} />
                  ))}
              </div>
            </motion.div>
          )}

          {/* Assemble PDF */}
          {itemStates.length > 0 && (successCount > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-bold text-stone-800">
                      Create PDF
                    </p>
                    <p className="text-[11px] text-stone-600">
                      Assemble {successCount} generated images into a KDP-ready
                      coloring book PDF.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleAssemblePdf}
                  disabled={assembling}
                  className="h-11 gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-5 text-sm font-bold shadow-md shadow-orange-200"
                >
                  {assembling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FilePlus2 className="h-4 w-4" />
                  )}
                  {assembling ? "Assembling…" : "Create PDF"}
                </Button>
              </div>

              {/* PDF result */}
              <AnimatePresence>
                {pdfUrl && pdfMeta && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-stone-800">
                            PDF ready: {pdfMeta.pages} pages
                          </p>
                          <p className="text-[11px] text-stone-600">
                            {pdfMeta.name}
                            {pdfMeta.missing > 0 && ` · ${pdfMeta.missing} items had no image`}
                          </p>
                        </div>
                        <a
                          href={pdfUrl}
                          download={pdfMeta.name}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 text-xs font-bold text-white shadow-md shadow-emerald-200"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Empty state */}
          {!isGenerating && itemStates.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-stone-200 bg-white/60 p-10 text-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 via-orange-100 to-amber-100 shadow-inner">
                <Wand2 className="h-10 w-10 text-rose-500" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-base font-extrabold text-stone-800">
                  Ready to generate
                </p>
                <p className="mt-1 max-w-md text-xs text-stone-500">
                  Pick a category, select items, choose quality, then click{" "}
                  <span className="font-bold text-rose-600">Generate</span>.
                  Each image takes 5-15 seconds. Vercel limits us to 60s per
                  batch — we&apos;ll automatically continue until all selected
                  items are done.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-stone-500">
                <Badge variant="outline" className="bg-white text-stone-600">
                  <Sparkles className="mr-1 h-3 w-3" /> 7 providers supported
                </Badge>
                <Badge variant="outline" className="bg-white text-stone-600">
                  <Layers className="mr-1 h-3 w-3" /> {categories.length || "—"} categories
                </Badge>
                <Badge variant="outline" className="bg-white text-stone-600">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Resumable batches
                </Badge>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Manage Categories modal */}
      <ManageCategories
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
        onChanged={handleManageCategoriesChanged}
      />

      {/* Manage Providers modal */}
      <ManageProviders
        open={manageProvidersOpen}
        onOpenChange={setManageProvidersOpen}
        onChanged={handleManageProvidersChanged}
      />
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function ItemStatusRow({ state, index }: { state: ItemState; index: number }) {
  const statusIcon = useMemo(() => {
    switch (state.status) {
      case "success":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "skipped":
        return <Check className="h-3.5 w-3.5 text-stone-400" />;
      case "failed":
        return <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />;
      case "running":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />;
      case "pending":
      default:
        return (
          <span className="text-[10px] font-bold text-stone-400">⏸</span>
        );
    }
  }, [state.status]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-stone-100 bg-white px-2 py-1.5 text-xs">
      <span className="w-4 shrink-0 text-center text-[10px] font-bold text-stone-400">
        {index + 1}
      </span>
      {statusIcon}
      <span className="min-w-0 flex-1 truncate font-semibold text-stone-700">
        {state.name}
      </span>
      {state.costUsd !== undefined && state.costUsd > 0 && (
        <span className="shrink-0 text-[10px] font-bold tabular-nums text-stone-500">
          ${state.costUsd.toFixed(3)}
        </span>
      )}
      {state.providerLabel && (
        <span className="shrink-0 text-[10px] text-stone-400">
          {state.providerLabel}
        </span>
      )}
      {state.durationMs !== undefined && state.durationMs > 0 && (
        <span className="shrink-0 text-[10px] text-stone-400">
          {(state.durationMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

function ResultThumbnail({ state }: { state: ItemState }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
      <div className="aspect-square w-full">
        {state.blobUrl ? (
          <img
            src={state.blobUrl}
            alt={state.name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-300">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="truncate text-[11px] font-bold text-white">{state.name}</p>
        <div className="flex items-center justify-between text-[9px] text-white/80">
          <span>{state.providerLabel ?? "—"}</span>
          {state.costUsd !== undefined && state.costUsd > 0 && (
            <span>${state.costUsd.toFixed(3)}</span>
          )}
        </div>
      </div>
      {state.blobUrl && (
        <a
          href={state.blobUrl}
          download={`${state.name}.png`}
          className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          aria-label={`Download ${state.name}`}
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
