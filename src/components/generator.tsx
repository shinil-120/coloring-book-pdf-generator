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
  ChevronsUpDown,
  RefreshCw,
  FilePlus2,
  History,
  Trash2,
  Upload,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ManageCategories } from "@/components/manage-categories";
import { ManageProviders } from "@/components/manage-providers";
import { PromptsModal } from "@/components/prompts-modal";
import { UploadImageModal } from "@/components/upload-image-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// A single generation history entry — persisted to localStorage so users
// can see what they've generated across sessions and re-select that category.
interface HistoryEntry {
  id: string;
  categorySlug: string;
  categoryName: string;
  categoryEmoji: string;
  itemCount: number;
  quality: string;
  totalCostUsd: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  providerLabel: string;
  timestamp: string; // ISO
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
    minPrice: 0.001,
    maxPrice: 0.011,
  },
  {
    value: "medium",
    label: "Medium",
    priceRange: "$0.003 – $0.042 / image",
    description: "Recommended balance of cost & quality.",
    color: "text-amber-600",
    minPrice: 0.003,
    maxPrice: 0.042,
  },
  {
    value: "high",
    label: "High",
    priceRange: "$0.041 – $0.167 / image",
    description: "Best prompt fidelity. Use for final books.",
    color: "text-rose-600",
    minPrice: 0.041,
    maxPrice: 0.167,
  },
] as const;

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
  const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);
  const [categoryItems, setCategoryItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [selectedItemNames, setSelectedItemNames] = useState<Set<string>>(new Set());

  // ─── Recently used categories (persisted to localStorage) ───
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // ─── Generation history (localStorage) ───
  // Each entry records a successful generation run so the user can see
  // what they've generated across sessions and re-select that category.
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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

  // ─── Load recently-used categories from localStorage ───
  useEffect(() => {
    try {
      const raw = localStorage.getItem("generator-recent-categories");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentSlugs(parsed.filter((s) => typeof s === "string").slice(0, 6));
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // ─── Record a category as recently used (called on generate) ───
  const recordRecentCategory = useCallback((slug: string) => {
    if (!slug) return;
    setRecentSlugs((prev) => {
      // Remove if already present, then prepend, cap at 6
      const next = [slug, ...prev.filter((s) => s !== slug)].slice(0, 6);
      try {
        localStorage.setItem("generator-recent-categories", JSON.stringify(next));
      } catch {
        // localStorage may be full or unavailable
      }
      return next;
    });
  }, []);

  // ─── Load generation history from localStorage ───
  useEffect(() => {
    try {
      const raw = localStorage.getItem("generator-history");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, 50));
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // ─── Record a generation run in history (called after generate completes) ───
  const recordHistoryEntry = useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    const full: HistoryEntry = {
      ...entry,
      id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setHistory((prev) => {
      const next = [full, ...prev].slice(0, 50);
      try {
        localStorage.setItem("generator-history", JSON.stringify(next));
      } catch {
        // localStorage may be full — drop oldest entries
        let trimmed = next;
        while (trimmed.length > 0) {
          try {
            localStorage.setItem("generator-history", JSON.stringify(trimmed));
            break;
          } catch {
            trimmed = trimmed.slice(0, -1);
          }
        }
      }
      return next;
    });
  }, []);

  // ─── Clear generation history ───
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem("generator-history");
    } catch {
      // noop
    }
    toast.success("History cleared");
  }, []);

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

  // ─── Track which items have external (uploaded) images ───
  // Keyed by item name. When an item has an external image, it's excluded
  // from the cost estimate (since the external image is free).
  const [externalImages, setExternalImages] = useState<Map<string, boolean>>(new Map());

  // Refresh external image status when category changes
  useEffect(() => {
    if (!selectedSlug) {
      setExternalImages(new Map());
      return;
    }
    // Check each item for an external image (in background, non-blocking)
    const checkExternal = async () => {
      const newMap = new Map<string, boolean>();
      // Use the items API to check which items have external images
      // We do this in parallel for speed
      await Promise.all(
        categoryItems.map(async (item) => {
          try {
            const res = await fetch(
              `/api/check-external-image?categorySlug=${encodeURIComponent(selectedSlug)}&itemName=${encodeURIComponent(item.name)}`,
              { cache: "no-store" }
            );
            const data = await res.json();
            if (data.success && data.exists) {
              newMap.set(item.name, true);
            }
          } catch {
            // non-fatal
          }
        })
      );
      setExternalImages(newMap);
    };
    checkExternal();
  }, [selectedSlug, categoryItems]);

  // Count items that need paid generation (have NO external image)
  const paidItemCount = useMemo(() => {
    let count = 0;
    for (const name of selectedItemNames) {
      if (!externalImages.get(name)) count++;
    }
    return count;
  }, [selectedItemNames, externalImages]);

  // Count items with external images (free)
  const externalItemCount = useMemo(() => {
    let count = 0;
    for (const name of selectedItemNames) {
      if (externalImages.get(name)) count++;
    }
    return count;
  }, [selectedItemNames, externalImages]);

  // ─── Live cost estimate (client-side, updates instantly) ───
  // Computes a min/max range based on the selected quality's price range
  // across all providers. Items with external images are EXCLUDED from
  // the cost (since they're free — uploaded from external AI tools).
  const liveEstimate = useMemo(() => {
    const option = QUALITY_OPTIONS.find((q) => q.value === quality);
    if (!option || selectedCount === 0) {
      return { min: 0, max: 0, perImageMin: 0, perImageMax: 0, free: false, paidCount: 0, freeCount: 0 };
    }
    const perImageMin = option.minPrice;
    const perImageMax = option.maxPrice;
    // If any configured provider is free (Z.AI or Cloudflare), the min could be $0
    const hasFreeProvider = providers.some(
      (p) => p.isActive && p.isConfigured && (p.type === "zai" || p.type === "cloudflare")
    );
    const effectiveMin = hasFreeProvider ? 0 : perImageMin;
    return {
      min: effectiveMin * paidItemCount,
      max: perImageMax * paidItemCount,
      perImageMin: effectiveMin,
      perImageMax: perImageMax,
      free: hasFreeProvider,
      paidCount: paidItemCount,
      freeCount: externalItemCount,
    };
  }, [quality, selectedCount, providers, paidItemCount, externalItemCount]);

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

    // Record this category as recently used
    recordRecentCategory(selectedSlug);

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

        // Handle non-JSON responses (Vercel HTML error pages, 504 timeouts, etc.)
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            `Server returned ${contentType || "non-JSON"} (HTTP ${res.status}). ` +
            `This usually means a Vercel function timeout or crash. ` +
            `Try fewer items, lower quality, or a faster provider.`
          );
        }

        if (!res.ok || !data.success) {
          // If we have a top-level error message, use it
          if (data?.error) {
            throw new Error(data.error);
          }
          // Otherwise, look at per-item errors in the summary
          const failedItems = data?.summary?.results?.filter((r) => !r.success) ?? [];
          if (failedItems.length > 0) {
            const firstErr = failedItems[0]?.error ?? "Unknown error";
            const allFailed = failedItems.length === (data?.summary?.totalItems ?? 0);
            throw new Error(
              allFailed
                ? `All ${failedItems.length} item(s) failed. First error: ${firstErr.slice(0, 200)}`
                : `${failedItems.length} of ${data?.summary?.totalItems ?? "?"} item(s) failed. First error: ${firstErr.slice(0, 200)}`
            );
          }
          // Last resort: just show the HTTP status
          throw new Error(`Generation failed (HTTP ${res.status})`);
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

        // Record this run in history (localStorage)
        const successCount = itemStates.filter((s) => s.status === "success").length;
        const skippedCount = itemStates.filter((s) => s.status === "skipped").length;
        const failedCount = itemStates.filter((s) => s.status === "failed").length;
        const providerLabel = itemStates.find((s) => s.providerLabel)?.providerLabel ?? "Multiple";
        recordHistoryEntry({
          categorySlug: selectedSlug,
          categoryName: selectedCategory?.name ?? selectedSlug,
          categoryEmoji: selectedCategory?.emoji ?? "📦",
          itemCount: itemStates.length,
          quality,
          totalCostUsd: processedCost,
          successCount,
          skippedCount,
          failedCount,
          providerLabel,
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
  }, [selectedSlug, selectedItemNames, providers, quality, resumeMode, fetchBudget, recordRecentCategory, recordHistoryEntry, itemStates, selectedCategory]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    setCancelRequested(true);
    toast.info("Cancelling after current item…");
  }, []);

  // ─── Keyboard shortcut: Ctrl/Cmd+Enter to generate ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isGenerating && selectedSlug && selectedItemNames.size > 0) {
          handleGenerate();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isGenerating, selectedSlug, selectedItemNames.size, handleGenerate]);

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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryOpen(true)}
                      className="h-8 gap-1.5 rounded-full border-violet-200 bg-white/80 px-3 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
                    >
                      <History className="h-3 w-3" /> History
                      {history.length > 0 && (
                        <span className="ml-0.5 rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          {history.length}
                        </span>
                      )}
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
              <Popover open={categoryComboboxOpen} onOpenChange={setCategoryComboboxOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={categoryComboboxOpen}
                    aria-controls="category-combobox-list"
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 text-left text-sm shadow-sm transition-colors hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  >
                    {selectedCategory ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-lg">{selectedCategory.emoji}</span>
                        <span className="truncate font-semibold text-stone-800">
                          {selectedCategory.name}
                        </span>
                        <span className="shrink-0 text-xs text-stone-500">
                          ({selectedCategory.itemCount})
                        </span>
                      </span>
                    ) : (
                      <span className="text-stone-400">Pick a category…</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-stone-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command className="rounded-xl">
                    <CommandInput placeholder="Search 137 categories…" className="h-9" />
                    <CommandList id="category-combobox-list" className="max-h-[280px]">
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup heading="Categories" className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                        {categories.map((c) => (
                          <CommandItem
                            key={c.slug}
                            value={`${c.name} ${c.emoji} ${c.description}`}
                            onSelect={() => {
                              setSelectedSlug(c.slug);
                              setCategoryComboboxOpen(false);
                            }}
                            className="gap-2 py-2"
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                selectedSlug === c.slug ? "opacity-100 text-rose-500" : "opacity-0"
                              )}
                            />
                            <span className="text-base">{c.emoji}</span>
                            <span className="flex-1 truncate font-semibold text-stone-800">
                              {c.name}
                            </span>
                            <span className="shrink-0 text-xs text-stone-500">
                              ({c.itemCount})
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

            {/* Recently used categories — quick-access chips */}
            {recentSlugs.length > 0 && !selectedSlug && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                  Recently used
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recentSlugs
                    .map((slug) => categories.find((c) => c.slug === slug))
                    .filter((c): c is Category => !!c)
                    .slice(0, 6)
                    .map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => setSelectedSlug(c.slug)}
                        className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-600 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <span>{c.emoji}</span>
                        <span>{c.name}</span>
                      </button>
                    ))}
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
                        const hasExternal = externalImages.get(item.name);
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
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
                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                            {hasExternal && (
                              <Badge variant="secondary" className="shrink-0 bg-violet-100 px-1.5 py-0 text-[9px] font-bold text-violet-700">
                                ✓ uploaded
                              </Badge>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Open file picker for this specific item
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/png,image/jpeg,image/jpg";
                                input.onchange = async () => {
                                  const file = input.files?.[0];
                                  if (!file) return;
                                  // Validate
                                  if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
                                    toast.error("Only PNG and JPG allowed");
                                    return;
                                  }
                                  if (file.size > 10 * 1024 * 1024) {
                                    toast.error("File too large (max 10MB)");
                                    return;
                                  }
                                  // Upload
                                  const formData = new FormData();
                                  formData.append("categorySlug", selectedSlug);
                                  formData.append("itemName", item.name);
                                  formData.append("image", file);
                                  try {
                                    const res = await fetch("/api/upload-coloring-image", {
                                      method: "POST",
                                      body: formData,
                                    });
                                    const data = await res.json();
                                    if (res.ok && data.success) {
                                      toast.success(`Uploaded "${item.name}"`, {
                                        description: `${(file.size / 1024).toFixed(0)} KB · free (no charge)`,
                                      });
                                      // Mark as having external image
                                      setExternalImages((prev) => {
                                        const next = new Map(prev);
                                        next.set(item.name, true);
                                        return next;
                                      });
                                    } else {
                                      toast.error("Upload failed", {
                                        description: data?.error || `HTTP ${res.status}`,
                                      });
                                    }
                                  } catch (err) {
                                    toast.error("Upload failed", {
                                      description: err instanceof Error ? err.message : "Network error",
                                    });
                                  }
                                };
                                input.click();
                              }}
                              className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-violet-100 hover:text-violet-600"
                              title="Upload external image for this item"
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </button>
                          </div>
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

          {/* Live cost estimate — updates instantly as you change settings */}
          <div className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-5 shadow-sm">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-orange-200/40 to-rose-200/40 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-600" />
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                    Live cost estimate
                  </p>
                </div>
                <p className="text-[11px] text-stone-600">
                  {selectedCount > 0
                    ? `${selectedCount} image${selectedCount === 1 ? "" : "s"} × ${quality} quality`
                    : "Select items to see cost estimate"}
                </p>
                {liveEstimate.freeCount > 0 && (
                  <p className="mt-0.5 text-[10px] text-violet-600">
                    {liveEstimate.freeCount} free (uploaded) · {liveEstimate.paidCount} paid
                  </p>
                )}
              </div>
              {selectedCount > 0 && (
                <div className="shrink-0 text-right">
                  {liveEstimate.min === liveEstimate.max ? (
                    <p className="text-2xl font-extrabold tabular-nums text-stone-800">
                      ${liveEstimate.max.toFixed(3)}
                    </p>
                  ) : (
                    <p className="text-2xl font-extrabold tabular-nums text-stone-800">
                      ${liveEstimate.min.toFixed(3)}
                      <span className="text-base font-bold text-stone-500"> – </span>
                      ${liveEstimate.max.toFixed(3)}
                    </p>
                  )}
                  {liveEstimate.free && (
                    <p className="text-[10px] font-bold text-emerald-600">
                      ✓ Free provider available
                    </p>
                  )}
                  {liveEstimate.freeCount > 0 && (
                    <p className="text-[10px] font-bold text-violet-600">
                      {liveEstimate.freeCount} uploaded (free)
                    </p>
                  )}
                </div>
              )}
            </div>
            {selectedCount > 0 && (
              <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-amber-200/60 pt-2 text-[10px] text-stone-600">
                <span>
                  Per image:{" "}
                  <strong className="font-bold tabular-nums">
                    ${liveEstimate.perImageMin.toFixed(3)}
                    {liveEstimate.perImageMin !== liveEstimate.perImageMax && (
                      <> – ${liveEstimate.perImageMax.toFixed(3)}</>
                    )}
                  </strong>
                </span>
                <span>
                  Estimated time:{" "}
                  <strong className="font-bold tabular-nums">
                    ~{Math.max(15, selectedCount * 8)}s
                  </strong>
                </span>
                {budget && (
                  <span>
                    After this run:{" "}
                    <strong className="font-bold tabular-nums text-emerald-700">
                      ${(5 - budget.allTimeSpend - liveEstimate.max).toFixed(3)} left
                    </strong>
                  </span>
                )}
              </div>
            )}
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
            {readyToGenerate && !isGenerating && (
              <p className="-mt-1 text-center text-[10px] font-medium text-stone-400">
                Tip: press{" "}
                <kbd className="rounded bg-stone-100 px-1 py-0.5 text-[9px] font-bold text-stone-600">
                  {typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")
                    ? "⌘"
                    : "Ctrl"}
                </kbd>{" "}
                +{" "}
                <kbd className="rounded bg-stone-100 px-1 py-0.5 text-[9px] font-bold text-stone-600">
                  Enter
                </kbd>{" "}
                to generate
              </p>
            )}

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

          {/* View Prompts — above Create PDF (per-item upload is now in the item picker) */}
          {selectedSlug && selectedItemNames.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                <Upload className="h-4 w-4 text-violet-600" />
                <p className="text-xs font-bold text-violet-800">
                  Free alternative: generate externally + upload per-item
                </p>
              </div>
              <p className="mb-3 text-[11px] text-violet-700">
                Use free AI tools (ChatGPT, Bing) to generate B&amp;W line art, then
                click the upload icon (⬆) next to each item. Uploaded images are
                <strong> free</strong> — excluded from the cost estimate.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPromptsOpen(true)}
                  className="gap-1.5 rounded-xl border-violet-200 bg-white text-xs font-bold text-violet-700 hover:bg-violet-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Prompts ({selectedItemNames.size})
                </Button>
                {liveEstimate.freeCount > 0 && (
                  <Badge variant="secondary" className="self-center bg-violet-100 text-[10px] font-bold text-violet-700">
                    {liveEstimate.freeCount} uploaded (free)
                  </Badge>
                )}
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
                          <p className="mt-1 text-[10px] text-emerald-600">
                            ✓ Also available in &quot;Coloring Book PDF&quot; and &quot;Edit PDF&quot; tabs
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

          {/* Empty state — context-aware onboarding */}
          {!isGenerating && itemStates.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-stone-200 bg-white/60 p-8 text-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 via-orange-100 to-amber-100 shadow-inner">
                <Wand2 className="h-10 w-10 text-rose-500" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-base font-extrabold text-stone-800">
                  {providers.filter((p) => p.isActive && p.isConfigured).length === 0
                    ? "Welcome — let's get you set up"
                    : "Ready to generate"}
                </p>
                <p className="mt-1 max-w-md text-xs text-stone-500">
                  {providers.filter((p) => p.isActive && p.isConfigured).length === 0
                    ? "Follow these 3 steps to generate your first coloring book:"
                    : "Pick a category, select items, choose quality, then click Generate. Each image takes 5-15 seconds."}
                </p>
              </div>

              {/* Step-by-step onboarding (only when no providers configured) */}
              {providers.filter((p) => p.isActive && p.isConfigured).length === 0 && (
                <div className="w-full max-w-md space-y-2 text-left">
                  <div className={cn(
                    "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                    providers.length === 0
                      ? "border-rose-200 bg-rose-50/50"
                      : "border-stone-200 bg-stone-50/50 opacity-60"
                  )}>
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                      providers.length === 0
                        ? "bg-rose-500 text-white"
                        : "bg-emerald-500 text-white"
                    )}>
                      {providers.length === 0 ? "1" : "✓"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-700">Add a provider</p>
                      <p className="text-[11px] text-stone-500">
                        Click "Add a provider" → pick OpenAI (or Z.AI for free) → paste your API key
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                    providers.length > 0 && !selectedSlug
                      ? "border-amber-200 bg-amber-50/50"
                      : "border-stone-200 bg-stone-50/50 opacity-60"
                  )}>
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                      providers.length > 0 && !selectedSlug
                        ? "bg-amber-500 text-white"
                        : selectedSlug
                          ? "bg-emerald-500 text-white"
                          : "bg-stone-300 text-stone-500"
                    )}>
                      {selectedSlug ? "✓" : "2"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-700">Pick a category & items</p>
                      <p className="text-[11px] text-stone-500">
                        Choose from 137 categories, then select which items to generate
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                    selectedSlug && selectedItemNames.size > 0
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-stone-200 bg-stone-50/50 opacity-60"
                  )}>
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                      selectedSlug && selectedItemNames.size > 0
                        ? "bg-emerald-500 text-white"
                        : "bg-stone-300 text-stone-500"
                    )}>
                      3
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-700">Click Generate</p>
                      <p className="text-[11px] text-stone-500">
                        Watch live progress, then download your KDP-ready PDF
                      </p>
                    </div>
                  </div>
                </div>
              )}

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

      {/* Generation History modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden rounded-3xl border-stone-200 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-stone-100 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
              <History className="h-5 w-5 text-violet-500" />
              Generation History
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Your last {history.length} generation{history.length === 1 ? "" : "s"} (stored in your browser, max 50).
              Click a row to re-select that category.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[68vh] overflow-y-auto px-6 py-4">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60 p-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-rose-100">
                  <History className="h-7 w-7 text-violet-400" />
                </div>
                <p className="text-sm font-bold text-stone-700">No history yet</p>
                <p className="max-w-sm text-xs text-stone-500">
                  Generate some coloring pages and your past runs will appear here —
                  so you can quickly re-select a category or see how much you&apos;ve spent.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => {
                  const date = new Date(entry.timestamp);
                  const dateStr = date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const timeStr = date.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelectedSlug(entry.categorySlug);
                        setHistoryOpen(false);
                        toast.info(`Re-selected "${entry.categoryName}"`, {
                          description: "Pick items and click Generate to continue",
                        });
                      }}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 text-left transition-all hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-xl">
                        {entry.categoryEmoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-stone-800">
                            {entry.categoryName}
                          </p>
                          <Badge variant="secondary" className="shrink-0 bg-stone-100 text-[9px] text-stone-600">
                            {entry.quality}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-stone-500">
                          {dateStr} at {timeStr} · {entry.itemCount} items · via {entry.providerLabel}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums text-stone-800">
                          ${entry.totalCostUsd.toFixed(3)}
                        </p>
                        <p className="text-[10px] text-stone-500">
                          {entry.successCount}✓
                          {entry.skippedCount > 0 && ` · ${entry.skippedCount}↷`}
                          {entry.failedCount > 0 && ` · ${entry.failedCount}✗`}
                        </p>
                      </div>
                    </button>
                  );
                })}

                <div className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Clear all ${history.length} history entries? This cannot be undone.`)) {
                        clearHistory();
                      }
                    }}
                    className="h-8 gap-1.5 text-xs text-stone-500 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear history
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Prompts modal — shows all prompts for selected items */}
      <PromptsModal
        open={promptsOpen}
        onOpenChange={setPromptsOpen}
        categorySlug={selectedSlug}
        itemNames={Array.from(selectedItemNames)}
      />

      {/* Upload External Image modal */}
      <UploadImageModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        categorySlug={selectedSlug}
        itemNames={Array.from(selectedItemNames)}
        categoryItems={categoryItems}
        onUploaded={() => {
          // Refresh item states to show uploaded images
          toast.success("Image uploaded!", {
            description: "Click 'Create PDF' to include it in the book.",
          });
        }}
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
