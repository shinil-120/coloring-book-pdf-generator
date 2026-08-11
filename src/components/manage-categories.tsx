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
  Search,
  GripVertical,
  Loader2,
  X,
  AlertTriangle,
  Lock,
  Filter,
  Check,
  RotateCcw,
  Library,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface Category {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  themeColor: string;
  description: string;
  isBuiltin: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Item {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  palette: unknown;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after categories or items change. */
  onChanged?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const VALID_THEME_COLORS = [
  "emerald", "sky", "amber", "rose", "violet",
  "lime", "orange", "fuchsia", "indigo", "stone",
] as const;

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

const COMMON_EMOJIS = [
  "🦕", "🐉", "🐠", "🚗", "🌸", "🐝", "🦁", "🦄",
  "🚀", "🍰", "🐶", "🐦", "🎨", "🪕", "🦚", "🏰",
  "🐟", "🦋", "🌹", "🦉", "🐰", "🐱", "🦓", "🦔",
  "🌿", "🪨", "⭐", "🌈", "🎯", "🍀",
];

type FilterMode = "all" | "builtin" | "custom";

// ─────────────────────────────────────────────────────────────────────────
// Sortable item row
// ─────────────────────────────────────────────────────────────────────────

function SortableItemRow({
  item,
  onRename,
  onDelete,
  onRestore,
}: {
  item: Item;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  } as React.CSSProperties;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(item.name);
      setEditing(false);
      return;
    }
    if (trimmed !== item.name) {
      onRename(trimmed);
    }
    setEditing(false);
  }, [draft, item.name, onRename]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5 transition-shadow",
        isDragging && "shadow-lg ring-2 ring-rose-300",
        item.isDeleted && "opacity-50"
      )}
    >
      {!item.isDeleted && (
        <button
          type="button"
          className="cursor-grab touch-none rounded-md p-1 text-stone-400 hover:bg-stone-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {item.isDeleted && (
        <span className="px-1 text-stone-400">
          <Trash2 className="h-4 w-4" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(item.name);
                setEditing(false);
              }
            }}
            autoFocus
            className="h-8 rounded-lg border-stone-200 bg-white text-sm"
          />
        ) : (
          <p className={cn("truncate text-sm font-medium text-stone-800", item.isDeleted && "line-through")}>
            {item.name}
          </p>
        )}
      </div>

      <Badge variant="outline" className="shrink-0 text-[10px] text-stone-500">
        #{item.sortOrder + 1}
      </Badge>

      {!item.isDeleted ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(item.name);
              setEditing(true);
            }}
            className="h-8 w-8 p-0 text-stone-500 hover:bg-stone-100"
            aria-label="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRestore}
          className="h-8 gap-1 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
        >
          <RotateCcw className="h-3 w-3" /> Restore
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────

export function ManageCategories({ open, onOpenChange, onChanged }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setCategories(data.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchCategories();
  }, [open, fetchCategories]);

  // Built-in vs custom lists
  const builtIn = useMemo(
    () => categories.filter((c) => c.isBuiltin),
    [categories]
  );
  const custom = useMemo(
    () => categories.filter((c) => !c.isBuiltin),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = filter === "builtin" ? builtIn : filter === "custom" ? custom : categories;
    if (!q) return base;
    return base.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  }, [categories, builtIn, custom, filter, search]);

  const handleDelete = useCallback(
    async (category: Category) => {
      if (!confirm(`Delete category "${category.name}"? Its items will also be removed.`)) return;
      try {
        const res = await fetch(`/api/categories/${category.slug}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        setCategories((prev) => prev.filter((c) => c.id !== category.id));
        toast.success(`Category "${category.name}" deleted`);
        onChanged?.();
      } catch (err) {
        toast.error("Failed to delete category", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [onChanged]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden rounded-3xl border-stone-200 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-stone-100 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
            <Library className="h-5 w-5 text-rose-500" />
            Manage Categories
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            {categories.length} categories · {categories.reduce((s, c) => s + c.itemCount, 0)} items
            total · Built-in categories can&apos;t be deleted, but can be edited.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Failed to load categories</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Search + filter */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories…"
                className="h-11 rounded-xl border-stone-200 bg-white pl-10"
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white p-1">
              <Filter className="ml-1.5 h-3.5 w-3.5 text-stone-400" />
              {(["all", "builtin", "custom"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                    filter === f
                      ? "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-sm"
                      : "text-stone-500 hover:bg-stone-100"
                  )}
                >
                  {f === "all" ? "All" : f === "builtin" ? "Built-in" : "Custom"}
                </button>
              ))}
            </div>
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60 p-10 text-center">
              <AlertTriangle className="h-8 w-8 text-stone-400" />
              <p className="text-sm font-bold text-stone-700">No categories found</p>
              <p className="text-xs text-stone-500">Try a different search or filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Built-in section */}
              {(filter === "all" || filter === "builtin") && (
                <CategorySection
                  title="Built-in categories"
                  subtitle={`${builtIn.length} categories seeded by default`}
                  categories={filter === "all" ? builtIn : filtered}
                  onEdit={setEditingCategory}
                  onDelete={handleDelete}
                />
              )}

              {/* Custom section */}
              {(filter === "all" || filter === "custom") && (
                <CategorySection
                  title="Your custom categories"
                  subtitle={
                    custom.length === 0
                      ? "No custom categories yet — create one below"
                      : `${custom.length} custom categories`
                  }
                  categories={filter === "all" ? custom : filtered}
                  onEdit={setEditingCategory}
                  onDelete={handleDelete}
                  emptyHint={
                    <Button
                      type="button"
                      onClick={() => setShowAddForm(true)}
                      className="mt-2 h-11 gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-5 text-sm font-bold shadow-md shadow-orange-200"
                    >
                      <Plus className="h-4 w-4" /> Create your first category
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/60 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={fetchCategories}
            className="h-11 gap-2 rounded-2xl border-stone-200 px-4 text-sm font-bold text-stone-600"
          >
            <RotateCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="h-11 gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-5 text-sm font-bold shadow-md shadow-orange-200"
          >
            <Plus className="h-4 w-4" /> Add New Category
          </Button>
        </div>
      </DialogContent>

      {/* Add/Edit form sub-modal */}
      <AnimatePresence>
        {(showAddForm || editingCategory) && (
          <CategoryFormDialog
            category={editingCategory}
            onClose={() => {
              setShowAddForm(false);
              setEditingCategory(null);
            }}
            onSaved={() => {
              setShowAddForm(false);
              setEditingCategory(null);
              fetchCategories();
              onChanged?.();
            }}
          />
        )}
      </AnimatePresence>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Category section (a header + a list of category rows)
// ─────────────────────────────────────────────────────────────────────────

function CategorySection({
  title,
  subtitle,
  categories,
  onEdit,
  onDelete,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  categories: Category[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
  emptyHint?: React.ReactNode;
}) {
  if (categories.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-bold text-stone-700">{title}</h3>
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60 p-6 text-center">
          <p className="text-xs text-stone-500">{subtitle}</p>
          {emptyHint}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-stone-700">{title}</h3>
        <span className="text-[11px] text-stone-400">{subtitle}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} onEdit={() => onEdit(c)} onDelete={() => onDelete(c)} />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  const colorHex = THEME_COLOR_HEX[category.themeColor] ?? "#78716c";

  return (
    <>
      <div className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
        {/* Color stripe */}
        <div
          className="absolute left-0 top-0 h-full w-1.5"
          style={{ backgroundColor: colorHex }}
        />
        <div className="ml-1 text-2xl">{category.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-stone-800">{category.name}</p>
            {category.isBuiltin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                    <Lock className="h-2.5 w-2.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Built-in (read-only delete)</TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="truncate text-[11px] text-stone-500">
            {category.description || "—"}
          </p>
        </div>
        <Badge
          variant="secondary"
          className="shrink-0 bg-stone-100 text-[10px] text-stone-600"
        >
          {category.itemCount} items
        </Badge>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setItemEditorOpen(true)}
            className="h-9 gap-1.5 rounded-xl border-stone-200 px-3 text-xs font-bold"
          >
            <Pencil className="h-3.5 w-3.5" /> Items
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="h-9 w-9 rounded-xl border-stone-200 p-0"
            aria-label="Edit category"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onDelete}
                disabled={category.isBuiltin}
                className={cn(
                  "h-9 w-9 rounded-xl border-rose-200 p-0 text-rose-600 hover:bg-rose-50",
                  category.isBuiltin && "cursor-not-allowed opacity-40"
                )}
                aria-label="Delete category"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {category.isBuiltin
                ? "Built-in categories can't be deleted"
                : `Delete "${category.name}"`}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Item editor sub-modal */}
      <ItemEditorDialog
        category={category}
        open={itemEditorOpen}
        onOpenChange={setItemEditorOpen}
        onChanged={() => {/* refresh handled inside */}}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Category add/edit form
// ─────────────────────────────────────────────────────────────────────────

function CategoryFormDialog({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState(category?.emoji ?? "🦕");
  const [customEmoji, setCustomEmoji] = useState("");
  const [useCustomEmoji, setUseCustomEmoji] = useState(false);
  const [themeColor, setThemeColor] = useState<string>(category?.themeColor ?? "rose");
  const [description, setDescription] = useState(category?.description ?? "");
  const [itemsText, setItemsText] = useState("");
  const [saving, setSaving] = useState(false);

  const finalEmoji = useCustomEmoji ? customEmoji.trim() || "⭐" : emoji;

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!finalEmoji) {
      toast.error("Pick an emoji");
      return;
    }
    setSaving(true);
    try {
      // Parse items (one per line OR comma-separated)
      const items = itemsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((n) => ({ name: n }));

      const body: Record<string, unknown> = {
        name: name.trim(),
        emoji: finalEmoji,
        themeColor,
        description: description.trim(),
      };
      if (!isEdit && items.length > 0) {
        body.items = items;
      }

      const url = isEdit
        ? `/api/categories/${category!.slug}`
        : "/api/categories";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success(isEdit ? "Category updated" : "Category created", {
        description:
          !isEdit && items.length > 0
            ? `${items.length} items added`
            : undefined,
      });
      onSaved();
    } catch (err) {
      toast.error("Failed to save category", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }, [category, description, finalEmoji, isEdit, itemsText, name, onSaved, themeColor]);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-stone-200 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
            {isEdit ? <Pencil className="h-5 w-5 text-rose-500" /> : <Plus className="h-5 w-5 text-rose-500" />}
            {isEdit ? "Edit Category" : "Create New Category"}
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            {isEdit
              ? "Update name, emoji, theme color, or description."
              : "Fill in the details below. Items are optional — you can add them later."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="cat-name" className="text-sm font-bold text-stone-700">
              Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mythical Beasts"
              className="mt-1.5 h-11 rounded-xl border-stone-200 bg-white"
            />
            <p className="mt-1 text-[11px] text-stone-500">
              Auto-generates a slug (e.g. &quot;Mythical Beasts&quot; → &quot;Mythical-Beasts&quot;).
            </p>
          </div>

          {/* Emoji */}
          <div>
            <Label className="text-sm font-bold text-stone-700">
              Emoji <span className="text-rose-500">*</span>
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COMMON_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setEmoji(e);
                    setUseCustomEmoji(false);
                  }}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition-all",
                    !useCustomEmoji && emoji === e
                      ? "border-transparent bg-gradient-to-br from-rose-100 to-amber-100 ring-2 ring-rose-300"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  )}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustomEmoji(true)}
                className={cn(
                  "flex h-10 min-w-10 items-center justify-center rounded-xl border px-2 text-xs font-bold transition-all",
                  useCustomEmoji
                    ? "border-transparent bg-gradient-to-br from-rose-100 to-amber-100 ring-2 ring-rose-300"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                )}
              >
                Custom
              </button>
              {useCustomEmoji && (
                <Input
                  value={customEmoji}
                  onChange={(e) => setCustomEmoji(e.target.value)}
                  placeholder="🦑"
                  className="h-10 w-20 rounded-xl border-stone-200 bg-white text-center text-xl"
                  maxLength={4}
                />
              )}
            </div>
          </div>

          {/* Theme color */}
          <div>
            <Label className="text-sm font-bold text-stone-700">Theme color</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {VALID_THEME_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setThemeColor(c)}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    themeColor === c ? "scale-110 border-stone-800" : "border-transparent"
                  )}
                  style={{ backgroundColor: THEME_COLOR_HEX[c] }}
                  aria-label={`Color: ${c}`}
                >
                  {themeColor === c && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="cat-desc" className="text-sm font-bold text-stone-700">
              Description
            </Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description shown in the picker"
              className="mt-1.5 min-h-[60px] resize-y rounded-xl border-stone-200 bg-white"
            />
          </div>

          {/* Items (only for new categories) */}
          {!isEdit && (
            <div>
              <Label htmlFor="cat-items" className="text-sm font-bold text-stone-700">
                Items (one per line, or comma-separated)
              </Label>
              <Textarea
                id="cat-items"
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                placeholder={"Dragon\nPhoenix\nUnicorn\nGriffin"}
                className="mt-1.5 min-h-[100px] resize-y rounded-xl border-stone-200 bg-white font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-stone-500">
                You can add or edit items later via the &quot;Items&quot; button.
              </p>
            </div>
          )}

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
              onClick={handleSave}
              disabled={saving}
              className="h-11 gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-5 text-sm font-bold shadow-md shadow-orange-200"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isEdit ? "Save changes" : "Create category"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Item editor sub-modal (with dnd-kit drag-and-drop reorder)
// ─────────────────────────────────────────────────────────────────────────

function ItemEditorDialog({
  category,
  open,
  onOpenChange,
  onChanged,
}: {
  category: Category;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/categories/${category.slug}/items?includeDeleted=1`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setItems(data.items ?? []);
    } catch (err) {
      toast.error("Failed to load items", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [category.slug]);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  const visibleItems = useMemo(
    () => (showDeleted ? items : items.filter((i) => !i.isDeleted)),
    [items, showDeleted]
  );

  const activeCount = useMemo(
    () => items.filter((i) => !i.isDeleted).length,
    [items]
  );
  const deletedCount = items.length - activeCount;

  const handleAdd = useCallback(async () => {
    const name = newItemName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/categories/${category.slug}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success(`Added "${name}"`);
      setNewItemName("");
      fetchItems();
      onChanged?.();
    } catch (err) {
      toast.error("Failed to add item", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAdding(false);
    }
  }, [category.slug, newItemName, fetchItems, onChanged]);

  const handleRename = useCallback(
    async (item: Item, newName: string) => {
      try {
        const res = await fetch(
          `/api/categories/${category.slug}/items/${item.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName }),
          }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? data.item : it))
        );
        toast.success("Renamed");
        onChanged?.();
      } catch (err) {
        toast.error("Rename failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [category.slug, onChanged]
  );

  const handleDelete = useCallback(
    async (item: Item) => {
      try {
        const res = await fetch(
          `/api/categories/${category.slug}/items/${item.id}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, isDeleted: true } : it
          )
        );
        toast.success(`Soft-deleted "${item.name}"`, {
          description: "Toggle 'show deleted' to restore.",
        });
        onChanged?.();
      } catch (err) {
        toast.error("Delete failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [category.slug, onChanged]
  );

  const handleRestore = useCallback(
    async (item: Item) => {
      try {
        const res = await fetch(
          `/api/categories/${category.slug}/items/${item.id}/restore`,
          { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, isDeleted: false } : it
          )
        );
        toast.success(`Restored "${item.name}"`);
        onChanged?.();
      } catch (err) {
        toast.error("Restore failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [category.slug, onChanged]
  );

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      // Only allow reordering among non-deleted items
      if (items[oldIndex].isDeleted || items[newIndex].isDeleted) return;
      const reordered = arrayMove(items, oldIndex, newIndex);
      setItems(reordered); // optimistic

      // Persist the new sort order via the reorder endpoint.
      // We send ALL non-deleted item IDs (in their new order) so the
      // server can assign sortOrder = 0, 1, 2, … consistently.
      const orderedIds = reordered.filter((i) => !i.isDeleted).map((i) => i.id);
      try {
        const res = await fetch(
          `/api/categories/${encodeURIComponent(category.slug)}/items/reorder`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemIds: orderedIds }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        toast.success("Order saved", {
          description: `${orderedIds.length} items reordered`,
        });
        onChanged?.();
      } catch (err) {
        toast.error("Reorder failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        fetchItems(); // rollback
      }
    },
    [items, category.slug, onChanged, fetchItems]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden rounded-3xl border-stone-200 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-stone-100 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
            <span className="text-2xl">{category.emoji}</span>
            Items in &quot;{category.name}&quot;
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            {activeCount} active · {deletedCount} deleted · drag{" "}
            <GripVertical className="inline h-3 w-3" /> to reorder
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {/* Add item */}
          <div className="mb-3 flex gap-2">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Add a new item…"
              className="h-11 rounded-xl border-stone-200 bg-white"
            />
            <Button
              type="button"
              onClick={handleAdd}
              disabled={adding || !newItemName.trim()}
              className="h-11 gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-4 text-sm font-bold shadow-md shadow-orange-200"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>

          {/* Show deleted toggle */}
          <div className="mb-3 flex items-center justify-between rounded-xl bg-stone-50 p-3">
            <div>
              <p className="text-xs font-bold text-stone-700">Show deleted items</p>
              <p className="text-[11px] text-stone-500">
                {deletedCount > 0
                  ? `${deletedCount} soft-deleted items hidden`
                  : "No deleted items"}
              </p>
            </div>
            <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
          </div>

          {/* Items list */}
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60 p-8 text-center">
              <AlertTriangle className="h-6 w-6 text-stone-400" />
              <p className="text-sm font-bold text-stone-700">No items</p>
              <p className="text-xs text-stone-500">Add the first item above.</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  <AnimatePresence>
                    {visibleItems.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                      >
                        <SortableItemRow
                          item={item}
                          onRename={(newName) => handleRename(item, newName)}
                          onDelete={() => handleDelete(item)}
                          onRestore={() => handleRestore(item)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="flex justify-end border-t border-stone-100 bg-stone-50/60 px-6 py-4">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-5 text-sm font-bold shadow-md shadow-orange-200"
          >
            <X className="h-4 w-4" /> Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
