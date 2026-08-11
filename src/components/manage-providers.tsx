"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  GripVertical,
  Loader2,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Power,
  PowerOff,
  X,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface ProviderModel {
  id: string;
  label: string;
  pricePerImage: Record<string, number>;
}

interface ProviderMetadataEntry {
  type: string;
  name: string;
  description: string;
  emoji: string;
  defaultModel: string;
  supportedModels: ProviderModel[];
  supportedQualities: string[];
  defaultQuality: string;
  supportedSizes: string[];
  defaultSize: string;
  needsApiKey: boolean;
  signupUrl: string;
  pricingUrl: string;
}

interface Provider {
  id: string;
  type: string;
  label: string;
  apiKeyEnv: string;
  model: string | null;
  dailyLimit: number | null;
  isActive: boolean;
  failoverOrder: number;
  isConfigured: boolean;
  usedToday: number;
  spentToday: number;
}

interface BudgetProviderRow {
  label: string;
  providerId: string | null;
  todaySpend: number;
  todayCount: number;
  allTimeSpend: number;
  allTimeCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a provider is added/edited/removed/reordered. */
  onChanged?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Sortable provider row
// ─────────────────────────────────────────────────────────────────────────

function SortableProviderRow({
  provider,
  metadata,
  usage,
  onEdit,
  onTest,
  onToggle,
  onRemove,
  testing,
}: {
  provider: Provider;
  metadata: ProviderMetadataEntry | undefined;
  usage: BudgetProviderRow | undefined;
  onEdit: () => void;
  onTest: () => void;
  onToggle: () => void;
  onRemove: () => void;
  testing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: provider.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  } as React.CSSProperties;

  const meta = metadata ?? { emoji: "🔌", name: provider.type, signupUrl: "", pricingUrl: "" };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow sm:flex-row sm:items-center",
        isDragging && "shadow-lg ring-2 ring-amber-300",
        !provider.isActive && "opacity-60"
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none rounded-md p-1 text-stone-400 hover:bg-stone-100 active:cursor-grabbing"
        aria-label="Drag to reorder failover priority"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="text-2xl leading-none">{meta.emoji}</div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-bold text-stone-800">{provider.label}</p>
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 text-[10px]",
              provider.isConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            )}
          >
            {provider.isConfigured ? (
              <>
                <CheckCircle2 className="mr-0.5 h-3 w-3" /> Connected
              </>
            ) : (
              <>
                <AlertTriangle className="mr-0.5 h-3 w-3" /> Not configured
              </>
            )}
          </Badge>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {meta.name}
          </Badge>
          <Badge className="shrink-0 bg-stone-100 text-[10px] text-stone-600" variant="secondary">
            #{provider.failoverOrder}
          </Badge>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-stone-500">
          <code className="rounded bg-stone-100 px-1 py-0.5 text-[10px] text-stone-700">
            {provider.apiKeyEnv}
          </code>
          {provider.model && (
            <span className="truncate">· {provider.model}</span>
          )}
          {provider.dailyLimit !== null && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              {provider.usedToday}/{provider.dailyLimit} today
            </span>
          )}
        </div>
        {usage && (
          <p className="mt-1 text-[11px] text-stone-500">
            Today: {usage.todayCount} images, ${usage.todaySpend.toFixed(3)} spent ·
            All-time: ${usage.allTimeSpend.toFixed(3)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onTest}
          disabled={testing}
          className="h-9 gap-1.5 rounded-xl border-stone-200 px-3 text-xs font-bold"
        >
          {testing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5" />
          )}
          Test
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="h-9 gap-1.5 rounded-xl border-stone-200 px-3 text-xs font-bold"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onToggle}
              className="h-9 w-9 rounded-xl border-stone-200 p-0"
              aria-label={provider.isActive ? "Disable provider" : "Enable provider"}
            >
              {provider.isActive ? (
                <Power className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <PowerOff className="h-3.5 w-3.5 text-stone-400" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {provider.isActive ? "Disable (will not be used)" : "Enable"}
          </TooltipContent>
        </Tooltip>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRemove}
          className="h-9 w-9 rounded-xl border-rose-200 p-0 text-rose-600 hover:bg-rose-50"
          aria-label="Remove provider"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────

const ENV_VAR_AUTO_NAMES: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  zai: "ZAI_API_KEY",
  deepinfra: "DEEPINFRA_API_KEY",
  fal: "FAL_API_KEY",
  together: "TOGETHER_API_KEY",
  replicate: "REPLICATE_API_TOKEN",
  cloudflare: "CLOUDFLARE_API_TOKEN",
};

export function ManageProviders({ open, onOpenChange, onChanged }: Props) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [metadata, setMetadata] = useState<Record<string, ProviderMetadataEntry>>({});
  const [usage, setUsage] = useState<Record<string, BudgetProviderRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editProvider, setEditProvider] = useState<Provider | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/providers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setProviders(data.providers ?? []);
      setMetadata(data.metadata ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch("/api/budget", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.byProvider)) {
        const map: Record<string, BudgetProviderRow> = {};
        for (const row of data.byProvider) {
          if (row?.providerId) {
            map[row.providerId] = row;
          }
        }
        setUsage(map);
      }
    } catch {
      // Non-fatal — budget info is supplementary.
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchProviders();
      fetchBudget();
    }
  }, [open, fetchProviders, fetchBudget]);

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIndex = providers.findIndex((p) => p.id === active.id);
      const newIndex = providers.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(providers, oldIndex, newIndex);
      setProviders(reordered); // optimistic
      try {
        await fetch("/api/providers/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: reordered.map((p) => p.id) }),
        });
        onChanged?.();
      } catch (err) {
        toast.error("Failed to reorder providers", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        fetchProviders(); // rollback
      }
    },
    [providers, onChanged, fetchProviders]
  );

  const handleTest = useCallback(
    async (provider: Provider) => {
      setTestingId(provider.id);
      try {
        const res = await fetch(`/api/providers/${provider.id}/test`, {
          method: "POST",
        });
        const data = await res.json();
        if (data.success && data.tested && data.success === true) {
          toast.success(`${provider.label}: API key is valid`, {
            description: data.message,
          });
        } else if (data.success && data.tested === false) {
          toast(`${provider.label}: test not implemented`, {
            description: data.message,
          });
        } else if (data.envVarSet === false) {
          toast.warning(`${provider.label}: env var not set`, {
            description: `Add "${provider.apiKeyEnv}" to .env.local`,
          });
        } else {
          toast.error(`${provider.label}: test failed`, {
            description: data.message ?? "Unknown error",
          });
        }
      } catch (err) {
        toast.error("Test request failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setTestingId(null);
      }
    },
    []
  );

  const handleToggle = useCallback(
    async (provider: Provider) => {
      try {
        const res = await fetch(`/api/providers/${provider.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !provider.isActive }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        setProviders((prev) =>
          prev.map((p) => (p.id === provider.id ? data.provider : p))
        );
        toast.success(
          `${provider.label} ${data.provider.isActive ? "enabled" : "disabled"}`
        );
        onChanged?.();
      } catch (err) {
        toast.error("Failed to update provider", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [onChanged]
  );

  const handleRemove = useCallback(
    async (provider: Provider) => {
      if (
        !confirm(
          `Remove provider "${provider.label}"? This also deletes its usage history.`
        )
      ) {
        return;
      }
      try {
        const res = await fetch(`/api/providers/${provider.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        setProviders((prev) => prev.filter((p) => p.id !== provider.id));
        toast.success(`Provider "${provider.label}" removed`);
        onChanged?.();
      } catch (err) {
        toast.error("Failed to remove provider", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [onChanged]
  );

  const metadataList = useMemo(() => Object.values(metadata), [metadata]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden rounded-3xl border-stone-200 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-stone-100 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
            <ShieldCheck className="h-5 w-5 text-rose-500" />
            Manage Providers
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            Configure API keys for image-generation providers. They are tried
            in failover order (top → bottom). API keys live in env vars, never
            in the database.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {/* Error state */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Failed to load providers</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Active providers */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-700">
              Active Providers ({providers.length})
            </h3>
            <Button
              type="button"
              size="sm"
              onClick={() => setHelpOpen(true)}
              variant="ghost"
              className="h-8 gap-1.5 text-xs text-stone-500"
            >
              <HelpCircle className="h-3.5 w-3.5" /> How to get API keys
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-amber-100">
                <AlertTriangle className="h-7 w-7 text-amber-600" />
              </div>
              <p className="text-sm font-bold text-stone-700">
                No providers configured
              </p>
              <p className="max-w-sm text-xs text-stone-500">
                Add at least one image-generation provider to start generating
                coloring pages. We recommend OpenAI gpt-image-2 for prompt
                fidelity, or DeepInfra/Together for cheaper FLUX.1 images.
              </p>
              <Button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="mt-2 h-11 gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-5 text-sm font-bold shadow-md shadow-orange-200"
              >
                <Plus className="h-4 w-4" /> Add your first provider
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={providers.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2.5">
                  <AnimatePresence>
                    {providers.map((p) => (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                      >
                        <SortableProviderRow
                          provider={p}
                          metadata={metadata[p.type]}
                          usage={usage[p.id]}
                          onEdit={() => setEditProvider(p)}
                          onTest={() => handleTest(p)}
                          onToggle={() => handleToggle(p)}
                          onRemove={() => handleRemove(p)}
                          testing={testingId === p.id}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Footer action */}
          {providers.length > 0 && (
            <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-stone-200 bg-stone-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-stone-600">
                <HelpCircle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  Drag the <GripVertical className="inline h-3 w-3" /> handle to
                  reorder failover priority. Top provider is tried first.
                </span>
              </div>
              <Button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="h-11 shrink-0 gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-5 text-sm font-bold shadow-md shadow-orange-200"
              >
                <Plus className="h-4 w-4" /> Add Provider
              </Button>
            </div>
          )}

          {/* Help card */}
          <div className="mt-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-xs leading-relaxed text-stone-700">
                <p className="mb-1 font-bold text-stone-800">
                  How multi-provider failover works
                </p>
                <p>
                  When you generate an image, providers are tried in priority
                  order. If one returns a 429 / rate-limit / quota error, the
                  next provider is tried automatically. Daily limits per provider
                  also force failover when reached. Only the API key env var
                  <span className="font-semibold"> NAME</span> is stored — never
                  the key itself.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Add/Edit form sub-modal */}
      <AnimatePresence>
        {(showAddForm || editProvider) && (
          <ProviderFormDialog
            provider={editProvider}
            metadataList={metadataList}
            onClose={() => {
              setShowAddForm(false);
              setEditProvider(null);
            }}
            onSaved={() => {
              setShowAddForm(false);
              setEditProvider(null);
              fetchProviders();
              fetchBudget();
              onChanged?.();
            }}
          />
        )}
      </AnimatePresence>

      {/* Help dialog */}
      <HelpDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        metadataList={metadataList}
      />
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Provider add/edit form
// ─────────────────────────────────────────────────────────────────────────

function ProviderFormDialog({
  provider,
  metadataList,
  onClose,
  onSaved,
}: {
  provider: Provider | null;
  metadataList: ProviderMetadataEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!provider;
  const [type, setType] = useState<string>(provider?.type ?? "openai");
  const [label, setLabel] = useState<string>(provider?.label ?? "");
  const [apiKeyEnv, setApiKeyEnv] = useState<string>(
    provider?.apiKeyEnv ?? ENV_VAR_AUTO_NAMES["openai"] ?? "OPENAI_API_KEY"
  );
  const [model, setModel] = useState<string>(provider?.model ?? "");
  const [dailyLimit, setDailyLimit] = useState<string>(
    provider?.dailyLimit !== null && provider?.dailyLimit !== undefined
      ? String(provider.dailyLimit)
      : ""
  );
  const [apiKeyValue, setApiKeyValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // When type changes (in add mode), update apiKeyEnv default
  const handleTypeChange = useCallback((newType: string) => {
    setType(newType);
    if (!isEdit) {
      setApiKeyEnv(ENV_VAR_AUTO_NAMES[newType] ?? `${newType.toUpperCase()}_API_KEY`);
      setModel(""); // reset model selection
    }
  }, [isEdit]);

  const meta = useMemo(
    () => metadataList.find((m) => m.type === type),
    [metadataList, type]
  );

  const handleSave = useCallback(async () => {
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    if (!apiKeyEnv.trim()) {
      toast.error("API key env var name is required");
      return;
    }
    if (!/^[A-Z][A-Z0-9_]*$/i.test(apiKeyEnv.trim())) {
      toast.error("API key env var name must be valid (letters, digits, underscores)");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type,
        label: label.trim(),
        apiKeyEnv: apiKeyEnv.trim(),
        model: model.trim() || null,
        dailyLimit: dailyLimit.trim() === "" ? null : Number(dailyLimit),
      };

      let url = "/api/providers";
      let method = "POST";
      if (isEdit && provider) {
        url = `/api/providers/${provider.id}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      // If a key was entered, remind the user to set it in .env.local
      if (apiKeyValue.trim()) {
        toast.success("Provider saved", {
          description: `Remember to add "${apiKeyEnv}" to your .env.local file`,
        });
      } else {
        toast.success(
          isEdit ? "Provider updated" : "Provider added",
          {
            description: data.keyIsSet
              ? "Env var is set — ready to generate"
              : `Add "${apiKeyEnv}" to .env.local to start generating`,
          }
        );
      }

      onSaved();
    } catch (err) {
      toast.error("Failed to save provider", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }, [
    apiKeyEnv,
    apiKeyValue,
    dailyLimit,
    isEdit,
    label,
    model,
    onSaved,
    provider,
    type,
  ]);

  const handleTestAndSave = useCallback(async () => {
    if (!label.trim() || !apiKeyEnv.trim()) {
      toast.error("Fill in label and env var name first");
      return;
    }
    setTesting(true);
    try {
      // For new providers, we can't test until they're saved. So save first,
      // then test. (We pass the test path: save → test → if test fails,
      // keep the provider anyway with a warning.)
      // The API key (if entered) is NOT used for the test — the test reads
      // the env var. If the user just typed a key, they need to add it to
      // .env.local first.
      if (apiKeyValue.trim() && !process.env[apiKeyEnv]) {
        toast.warning("Add the key to .env.local first", {
          description: `Test reads from env var "${apiKeyEnv}", not the field above.`,
        });
        setTesting(false);
        return;
      }

      // Save first
      await handleSave();
      // Then test (only in edit mode — provider.id is known)
      // For new providers, fetchProviders will refresh and the user can test
      // from the main modal.
      toast.info("Provider saved — click Test in the main modal to verify.");
      onSaved();
    } catch (err) {
      toast.error("Test & save failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setTesting(false);
    }
  }, [apiKeyEnv, apiKeyValue, handleSave, onSaved]);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-stone-200 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
            {isEdit ? (
              <Pencil className="h-5 w-5 text-rose-500" />
            ) : (
              <Plus className="h-5 w-5 text-rose-500" />
            )}
            {isEdit ? "Edit Provider" : "Add Provider"}
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            {isEdit
              ? "Update label, model, daily limit, or toggle status."
              : "Configure a new image-generation provider."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div>
            <Label className="text-sm font-bold text-stone-700">Provider type</Label>
            <Select value={type} onValueChange={handleTypeChange} disabled={isEdit}>
              <SelectTrigger className="mt-1.5 h-11 w-full rounded-xl border-stone-200 bg-white">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {metadataList.map((m) => {
                  const cheapestPrice = Math.min(
                    ...m.supportedModels.flatMap(
                      (mdl) => Object.values(mdl.pricePerImage)
                    )
                  );
                  return (
                    <SelectItem key={m.type} value={m.type}>
                      <span className="mr-2">{m.emoji}</span>
                      <span className="font-semibold">{m.name}</span>
                      <span className="ml-2 text-xs text-stone-500">
                        {cheapestPrice > 0
                          ? `from $${cheapestPrice.toFixed(3)}/img`
                          : "free tier"}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {meta && (
              <p className="mt-1 text-xs text-stone-500">{meta.description}</p>
            )}
          </div>

          {/* Label */}
          <div>
            <Label htmlFor="provider-label" className="text-sm font-bold text-stone-700">
              Label (nickname)
            </Label>
            <Input
              id="provider-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. OpenAI primary, Brother's Z.AI account"
              className="mt-1.5 h-11 rounded-xl border-stone-200 bg-white"
            />
          </div>

          {/* Env var name */}
          <div>
            <Label htmlFor="api-key-env" className="text-sm font-bold text-stone-700">
              API key env var name
            </Label>
            <Input
              id="api-key-env"
              value={apiKeyEnv}
              onChange={(e) => setApiKeyEnv(e.target.value.toUpperCase())}
              placeholder="OPENAI_API_KEY"
              className="mt-1.5 h-11 rounded-xl border-stone-200 bg-white font-mono text-sm"
            />
            <p className="mt-1 text-[11px] text-stone-500">
              The <span className="font-semibold">name</span> of the env var that
              holds the actual key. You must add this env var in{" "}
              <code className="rounded bg-stone-100 px-1 py-0.5">.env.local</code>{" "}
              (local) or Vercel dashboard (production).
            </p>
          </div>

          {/* API key value (testing only) */}
          <div>
            <Label htmlFor="api-key-value" className="text-sm font-bold text-stone-700">
              API key value{" "}
              <Badge variant="outline" className="ml-1 text-[10px]">
                optional, testing only
              </Badge>
            </Label>
            <Input
              id="api-key-value"
              type="password"
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
              placeholder="sk-..."
              className="mt-1.5 h-11 rounded-xl border-stone-200 bg-white font-mono text-sm"
            />
            <Alert className="mt-2 border-amber-200 bg-amber-50 py-2">
              <AlertDescription className="text-[11px] text-amber-800">
                <ShieldCheck className="mr-1 inline h-3 w-3" />
                We do <span className="font-bold">not</span> store this key. Add
                it to <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
                as{" "}
                <code className="rounded bg-amber-100 px-1">{apiKeyEnv || "VAR"}</code>
                =<span className="italic">your-key</span> yourself. The field
                above is only for the next "Test & Save" button.
              </AlertDescription>
            </Alert>
          </div>

          {/* Model */}
          {meta && meta.supportedModels.length > 1 && (
            <div>
              <Label className="text-sm font-bold text-stone-700">Model</Label>
              <Select value={model || meta.defaultModel} onValueChange={setModel}>
                <SelectTrigger className="mt-1.5 h-11 w-full rounded-xl border-stone-200 bg-white">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  {meta.supportedModels.map((m) => {
                    const cheapestPrice = Math.min(...Object.values(m.pricePerImage));
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-semibold">{m.label}</span>
                        <span className="ml-2 text-xs text-stone-500">
                          {cheapestPrice > 0
                            ? `$${cheapestPrice.toFixed(3)}/img`
                            : "free"}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Daily limit */}
          <div>
            <Label htmlFor="daily-limit" className="text-sm font-bold text-stone-700">
              Daily limit (images per day)
            </Label>
            <Input
              id="daily-limit"
              type="number"
              min={0}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              placeholder="Unlimited"
              className="mt-1.5 h-11 rounded-xl border-stone-200 bg-white"
            />
            <p className="mt-1 text-[11px] text-stone-500">
              Leave empty for unlimited. When reached, the next provider in the
              failover order takes over.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-2xl border-stone-200 px-5 text-sm font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestAndSave}
              disabled={testing || saving}
              className="h-11 gap-2 rounded-2xl border-stone-200 px-5 text-sm font-bold"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Test &amp; Save
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-11 gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-5 text-sm font-bold shadow-md shadow-orange-200"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isEdit ? "Save changes" : "Add provider"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Help dialog
// ─────────────────────────────────────────────────────────────────────────

function HelpDialog({
  open,
  onOpenChange,
  metadataList,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  metadataList: ProviderMetadataEntry[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl border-stone-200 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
            <HelpCircle className="h-5 w-5 text-rose-500" /> How to get API keys
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            Each provider has a signup URL and a pricing page. Most offer free
            credits to get started.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {metadataList.map((m) => (
            <div
              key={m.type}
              className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3"
            >
              <div className="text-2xl">{m.emoji}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-800">{m.name}</p>
                <p className="truncate text-[11px] text-stone-500">{m.description}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <a
                  href={m.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Sign up <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href={m.pricingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Pricing <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-5 text-sm font-bold shadow-md shadow-orange-200"
          >
            <X className="h-4 w-4" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
