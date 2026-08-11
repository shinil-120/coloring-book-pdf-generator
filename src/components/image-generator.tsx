"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Wand2,
  Download,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  ImageIcon,
  Loader2,
  AlertCircle,
  Maximize2,
  X,
  ChevronDown,
  History,
  Zap,
  Settings2,
  Heart,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────

type ImageSize =
  | "1024x1024"
  | "768x1344"
  | "864x1152"
  | "1344x768"
  | "1152x864"
  | "1440x720"
  | "720x1440";

interface StylePreset {
  key: string;
  label: string;
  emoji: string;
  hint: string;
}

const STYLE_PRESETS: StylePreset[] = [
  { key: "auto", label: "Auto", emoji: "✨", hint: "No style modifier — let the model decide" },
  { key: "realistic", label: "Realistic Photo", emoji: "📷", hint: "Photorealistic, studio lighting" },
  { key: "digital_art", label: "Digital Art", emoji: "🎨", hint: "Concept-art illustration" },
  { key: "anime", label: "Anime", emoji: "🌸", hint: "Cel-shaded anime style" },
  { key: "oil", label: "Oil Painting", emoji: "🖼️", hint: "Thick classical brush strokes" },
  { key: "watercolor", label: "Watercolor", emoji: "💧", hint: "Soft wet-on-wet washes" },
  { key: "3d", label: "3D Render", emoji: "🧊", hint: "Octane / Blender render" },
  { key: "minimalist", label: "Minimalist", emoji: "⚪", hint: "Flat, limited palette" },
  { key: "coloring", label: "Coloring Page", emoji: "🖍️", hint: "B&W line art for kids" },
  { key: "fantasy", label: "Fantasy Art", emoji: "🐉", hint: "Epic, magical atmosphere" },
  { key: "cyberpunk", label: "Cyberpunk", emoji: "🌃", hint: "Neon, futuristic city" },
];

const SIZES: { value: ImageSize; label: string; ratio: string; popular?: boolean }[] = [
  { value: "1024x1024", label: "Square", ratio: "1:1", popular: true },
  { value: "1344x768", label: "Landscape", ratio: "16:9", popular: true },
  { value: "768x1344", label: "Portrait", ratio: "9:16", popular: true },
  { value: "1440x720", label: "Wide", ratio: "2:1" },
  { value: "720x1440", label: "Tall", ratio: "1:2" },
  { value: "1152x864", label: "Std Landscape", ratio: "4:3" },
  { value: "864x1152", label: "Std Portrait", ratio: "3:4" },
];

const PROMPT_IDEAS: { label: string; prompt: string; emoji: string }[] = [
  { emoji: "🦊", label: "Cute fox in autumn forest", prompt: "A cute baby fox sitting on a mossy log in an autumn forest, golden hour sunlight filtering through orange leaves, soft bokeh background, ultra detailed fur" },
  { emoji: "🐉", label: "Majestic dragon", prompt: "A majestic dragon perched on a mountain peak at sunset, scales shimmering with iridescent colors, vast valley below with rivers and forests, epic cinematic composition" },
  { emoji: "🌊", label: "Underwater coral reef", prompt: "Vibrant underwater coral reef teeming with tropical fish, sunbeams piercing through crystal-clear turquoise water, sea turtles gliding, ultra detailed marine life" },
  { emoji: "🏯", label: "Japanese pagoda at dawn", prompt: "A traditional Japanese pagoda at dawn, cherry blossoms drifting in the wind, mist rising from a koi pond, soft pink and gold color palette, serene atmosphere" },
  { emoji: "🚀", label: "Rocket launch at night", prompt: "A massive rocket launching into a starry night sky, fiery exhaust illuminating the launch pad, dramatic clouds of smoke, cinematic wide shot, ultra detailed" },
  { emoji: "🦄", label: "Magical unicorn", prompt: "A magical unicorn with a flowing rainbow mane galloping through a field of glowing wildflowers under a starry twilight sky, sparkles and stardust trailing behind" },
  { emoji: "🏙️", label: "Cyberpunk city street", prompt: "A rain-soaked cyberpunk city street at night, neon signs in pink and cyan reflecting in puddles, flying cars overhead, atmospheric fog, blade runner aesthetic" },
  { emoji: "🍰", label: "Fancy dessert plate", prompt: "An elegant dessert plate with a delicate chocolate lava cake, fresh raspberries, mint leaves, and a drizzle of caramel sauce, professional food photography, soft studio lighting" },
];

interface GeneratedImage {
  id: string;
  image: string; // data-uri
  prompt: string;
  size: ImageSize;
  style: string;
  styleLabel: string;
  seed: number;
  bytes: number;
  generatedAt: string;
  favorite?: boolean;
}

const HISTORY_KEY = "zai-image-gen-history-v1";
const MAX_HISTORY = 50;

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function loadHistory(): GeneratedImage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as GeneratedImage[];
  } catch {
    return [];
  }
}

function saveHistory(items: GeneratedImage[]) {
  if (typeof window === "undefined") return;
  try {
    // Cap to MAX_HISTORY to avoid blowing the localStorage quota.
    // (Each PNG data-uri can be ~1-2 MB; with 50 items we may still hit quota —
    //  in that case we drop the oldest until it fits.)
    let capped = items.slice(0, MAX_HISTORY);
    while (capped.length > 0) {
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
        return;
      } catch {
        // Quota exceeded — drop the oldest and retry.
        capped = capped.slice(0, capped.length - 1);
      }
    }
  } catch {
    /* noop */
  }
}

function downloadDataUri(dataUri: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function aspectRatioClass(size: ImageSize): string {
  switch (size) {
    case "1024x1024": return "aspect-square";
    case "768x1344":
    case "720x1440": return "aspect-[9/16]";
    case "864x1152": return "aspect-[3/4]";
    case "1344x768":
    case "1440x720": return "aspect-video";
    case "1152x864": return "aspect-[4/3]";
    default: return "aspect-square";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [style, setStyle] = useState<string>("auto");
  const [enhance, setEnhance] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<GeneratedImage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ref so we can abort an in-flight request if the user clicks again
  const abortRef = useRef<AbortController | null>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Persist history to localStorage whenever it changes
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const canGenerate = prompt.trim().length > 0 && !loading;

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error("Please enter a prompt first");
      return;
    }

    // Abort any previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          size,
          style,
          negativePrompt: negativePrompt.trim() || undefined,
          enhance,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const item: GeneratedImage = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        image: data.image,
        prompt: data.prompt,
        size: data.size,
        style: data.style,
        styleLabel: data.styleLabel,
        seed: data.seed,
        bytes: data.bytes,
        generatedAt: data.generatedAt,
      };

      setCurrent(item);
      setHistory((prev) => [item, ...prev].slice(0, MAX_HISTORY));
      toast.success("Image generated!", {
        description: `${data.size} · ${data.styleLabel} · ${formatBytes(data.bytes)}`,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error("Generation failed", { description: msg.slice(0, 200) });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [prompt, size, style, negativePrompt, enhance]);

  const handleRegenerate = useCallback(() => {
    if (!current) return;
    setPrompt(current.prompt);
    setSize(current.size);
    setStyle(current.style);
    // Defer to next tick so state updates before generate reads them
    setTimeout(() => handleGenerate(), 0);
  }, [current, handleGenerate]);

  const handleDownload = useCallback((item: GeneratedImage) => {
    const slug = item.prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "image";
    const filename = `${slug}-${item.size}-${item.seed}.png`;
    downloadDataUri(item.image, filename);
    toast.success("Downloaded", { description: filename });
  }, []);

  const handleCopyPrompt = useCallback(async (item: GeneratedImage) => {
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
      toast.success("Prompt copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, []);

  const handleToggleFavorite = useCallback((id: string) => {
    setHistory((prev) =>
      prev.map((it) => (it.id === id ? { ...it, favorite: !it.favorite } : it))
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setHistory((prev) => prev.filter((it) => it.id !== id));
    setCurrent((cur) => (cur?.id === id ? null : cur));
  }, []);

  const handleClearHistory = useCallback(() => {
    if (history.length === 0) return;
    if (!confirm(`Delete all ${history.length} generated images from history? This cannot be undone.`)) return;
    setHistory([]);
    setCurrent(null);
    toast.success("History cleared");
  }, [history.length]);

  const handleUseIdea = useCallback((ideaPrompt: string) => {
    setPrompt(ideaPrompt);
    toast.info("Prompt loaded — press Generate to create");
  }, []);

  const handleShare = useCallback(async (item: GeneratedImage) => {
    try {
      if (navigator.share) {
        // Web Share API (mobile) — share the image as a file
        const res = await fetch(item.image);
        const blob = await res.blob();
        const file = new File([blob], `ai-image-${item.seed}.png`, { type: "image/png" });
        await navigator.share({
          title: "AI Generated Image",
          text: item.prompt,
          files: [file],
        });
        return;
      }
      // Desktop fallback — copy prompt to clipboard
      await navigator.clipboard.writeText(item.prompt);
      toast.success("Prompt copied (Web Share not supported here)");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("Could not share");
    }
  }, []);

  const promptCount = prompt.length;
  const promptWarn = promptCount > 1800;

  // Group history by date for nicer display
  const groupedHistory = useMemo(() => {
    const groups: Record<string, GeneratedImage[]> = {};
    for (const item of history) {
      const date = new Date(item.generatedAt).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    }
    return Object.entries(groups);
  }, [history]);

  // ─────────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ══════════════════ LEFT: Controls ══════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-5 shadow-sm">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-orange-200/40 to-rose-200/40 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 via-rose-400 to-pink-500 shadow-lg shadow-rose-200">
                <Wand2 className="h-6 w-6 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold tracking-tight text-stone-800">
                  AI Image Generator
                </h2>
                <p className="mt-0.5 text-sm leading-snug text-stone-600">
                  Powered by the same z-ai-web-dev-sdk engine that draws your coloring
                  books — 1024×1024 default, photorealistic quality.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="bg-white/70 text-amber-700 hover:bg-white/70">
                    <Sparkles className="mr-1 h-3 w-3" /> 1024×1024 default
                  </Badge>
                  <Badge variant="secondary" className="bg-white/70 text-rose-700 hover:bg-white/70">
                    10 style presets
                  </Badge>
                  <Badge variant="secondary" className="bg-white/70 text-orange-700 hover:bg-white/70">
                    Saved locally
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Prompt */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="prompt" className="text-sm font-bold text-stone-700">
                Your prompt
              </Label>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  promptWarn ? "text-rose-600" : "text-stone-400"
                )}
              >
                {promptCount}/2000
              </span>
            </div>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A serene mountain landscape at golden hour with misty valleys, dramatic clouds, and a winding river…"
              className="min-h-[120px] resize-y border-stone-200 bg-stone-50/50 text-sm leading-relaxed focus-visible:ring-amber-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
            <p className="mt-1.5 text-[11px] text-stone-400">
              Tip: press <kbd className="rounded bg-stone-100 px-1 py-0.5 text-[10px] font-semibold">⌘/Ctrl</kbd> + <kbd className="rounded bg-stone-100 px-1 py-0.5 text-[10px] font-semibold">Enter</kbd> to generate
            </p>

            {/* Style presets */}
            <div className="mt-4">
              <Label className="mb-2 block text-sm font-bold text-stone-700">
                Style preset
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_PRESETS.map((s) => (
                  <Tooltip key={s.key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setStyle(s.key)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                          style === s.key
                            ? "border-transparent bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md shadow-rose-200"
                            : "border-stone-200 bg-white text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        )}
                      >
                        <span>{s.emoji}</span>
                        {s.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{s.hint}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Size selector */}
            <div className="mt-4">
              <Label className="mb-2 block text-sm font-bold text-stone-700">
                Image size
              </Label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {SIZES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSize(s.value)}
                    className={cn(
                      "group relative flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-all",
                      size === s.value
                        ? "border-transparent bg-gradient-to-br from-stone-800 to-stone-700 text-white shadow-md"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                    )}
                  >
                    <span className="text-xs font-bold">{s.label}</span>
                    <span className={cn(
                      "text-[10px] font-medium tabular-nums",
                      size === s.value ? "text-stone-300" : "text-stone-400"
                    )}>
                      {s.value} · {s.ratio}
                    </span>
                    {s.popular && (
                      <span className={cn(
                        "absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase",
                        size === s.value ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
                      )}>
                        Popular
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-stone-500 transition-colors hover:text-stone-700"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Advanced settings
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")}
              />
            </button>

            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3 rounded-2xl bg-stone-50/80 p-3">
                    <div>
                      <Label htmlFor="neg-prompt" className="text-xs font-bold text-stone-600">
                        Negative prompt (what to avoid)
                      </Label>
                      <Input
                        id="neg-prompt"
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="blurry, low quality, distorted, watermark, text"
                        className="mt-1 border-stone-200 bg-white text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white p-3">
                      <div>
                        <p className="text-xs font-bold text-stone-700">Quality booster</p>
                        <p className="text-[11px] text-stone-500">
                          Prepends “masterpiece, best quality, ultra detailed”
                        </p>
                      </div>
                      <Switch checked={enhance} onCheckedChange={setEnhance} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="mt-4 h-12 w-full gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-base font-bold shadow-lg shadow-orange-200 transition-all hover:shadow-xl hover:shadow-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  Generate Image
                </>
              )}
            </Button>
          </div>

          {/* Prompt ideas */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-stone-700">Need inspiration?</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_IDEAS.map((idea) => (
                <button
                  key={idea.label}
                  type="button"
                  onClick={() => handleUseIdea(idea.prompt)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600 transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                >
                  <span>{idea.emoji}</span>
                  {idea.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ══════════════════ RIGHT: Output ══════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="space-y-5"
        >
          {/* Current image */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-700">Latest result</h3>
              {current && (
                <Badge variant="secondary" className="bg-stone-100 text-stone-600">
                  {current.size} · {formatBytes(current.bytes)}
                </Badge>
              )}
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
                    <AlertCircle className="h-6 w-6 text-rose-600" />
                  </div>
                  <p className="text-sm font-semibold text-rose-700">Generation failed</p>
                  <p className="max-w-md text-xs text-rose-600">{error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerate}
                    className="border-rose-200 text-rose-700 hover:bg-rose-100"
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Retry
                  </Button>
                </motion.div>
              )}

              {!error && loading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "relative flex items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-stone-100",
                    aspectRatioClass(size)
                  )}
                >
                  {/* Animated shimmer */}
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  <div className="z-10 flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
                    <p className="text-xs font-semibold text-stone-500">
                      Painting your image…
                    </p>
                    <p className="text-[10px] text-stone-400">Usually takes 5–15 seconds</p>
                  </div>
                </motion.div>
              )}

              {!error && !loading && current && (
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3"
                >
                  <div className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                    <div className={cn("w-full", aspectRatioClass(current.size))}>
                      { }
                      <img
                        src={current.image}
                        alt={current.prompt}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewItem(current);
                        setPreviewOpen(true);
                      }}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                      aria-label="View full size"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Action bar */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleDownload(current)}
                      className="gap-1.5 bg-stone-800 hover:bg-stone-700"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerate}
                      className="gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyPrompt(current)}
                      className="gap-1.5"
                    >
                      {copiedId === current.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy prompt
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShare(current)}
                      className="gap-1.5"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Prompt display */}
                  <div className="rounded-xl bg-stone-50 p-3">
                    <p className="text-xs leading-relaxed text-stone-600">{current.prompt}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-stone-400">
                      <span className="rounded bg-stone-200 px-1.5 py-0.5 font-semibold">
                        {current.styleLabel}
                      </span>
                      <span>seed: {current.seed}</span>
                      <span>·</span>
                      <span>
                        {new Date(current.generatedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {!error && !loading && !current && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center",
                    aspectRatioClass(size)
                  )}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-orange-100">
                    <ImageIcon className="h-7 w-7 text-rose-400" />
                  </div>
                  <p className="text-sm font-bold text-stone-600">No image yet</p>
                  <p className="max-w-xs text-xs text-stone-500">
                    Write a prompt on the left, pick a style, and hit <strong>Generate Image</strong> to see your creation here.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-stone-500" />
                  <h3 className="text-sm font-bold text-stone-700">
                    History <span className="text-stone-400">({history.length})</span>
                  </h3>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearHistory}
                  className="h-8 gap-1.5 text-xs text-stone-500 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </Button>
              </div>

              <div className="max-h-[640px] space-y-4 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {groupedHistory.map(([date, items]) => (
                  <div key={date}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                      {date}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {items.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="group relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50"
                        >
                          <div className={cn("w-full", aspectRatioClass(item.size))}>
                            { }
                            <img
                              src={item.image}
                              alt={item.prompt}
                              className="h-full w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
                              onClick={() => {
                                setPreviewItem(item);
                                setPreviewOpen(true);
                              }}
                            />
                          </div>

                          {/* Hover overlay */}
                          <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/0 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="pointer-events-auto flex w-full items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(item.id)}
                                className={cn(
                                  "flex h-6 w-6 items-center justify-center rounded-md backdrop-blur-sm transition-colors",
                                  item.favorite
                                    ? "bg-rose-500 text-white"
                                    : "bg-white/80 text-stone-600 hover:bg-white"
                                )}
                                aria-label="Favorite"
                              >
                                <Heart className={cn("h-3 w-3", item.favorite && "fill-current")} />
                              </button>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDownload(item)}
                                  className="flex h-6 w-6 items-center justify-center rounded-md bg-white/80 text-stone-600 backdrop-blur-sm transition-colors hover:bg-white"
                                  aria-label="Download"
                                >
                                  <Download className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  className="flex h-6 w-6 items-center justify-center rounded-md bg-white/80 text-stone-600 backdrop-blur-sm transition-colors hover:bg-rose-100 hover:text-rose-600"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Favorite badge */}
                          {item.favorite && (
                            <div className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 shadow">
                              <Heart className="h-2.5 w-2.5 fill-current text-white" />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ══════════════════ Full-size preview modal ══════════════════ */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl border-stone-200 bg-white p-0 sm:rounded-3xl">
          <DialogTitle className="sr-only">Image preview</DialogTitle>
          {previewItem && (
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:p-6">
              <div className="flex-1 overflow-hidden rounded-2xl bg-stone-900">
                { }
                <img
                  src={previewItem.image}
                  alt={previewItem.prompt}
                  className="mx-auto max-h-[70vh] w-auto object-contain"
                />
              </div>
              <div className="flex w-full shrink-0 flex-col gap-3 sm:w-72">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                    {previewItem.styleLabel}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="rounded-xl bg-stone-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                    Prompt
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-700">
                    {previewItem.prompt}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-stone-50 p-2">
                    <p className="font-bold text-stone-400">Size</p>
                    <p className="font-semibold text-stone-700">{previewItem.size}</p>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <p className="font-bold text-stone-400">Seed</p>
                    <p className="font-semibold text-stone-700">{previewItem.seed}</p>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <p className="font-bold text-stone-400">Bytes</p>
                    <p className="font-semibold text-stone-700">{formatBytes(previewItem.bytes)}</p>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <p className="font-bold text-stone-400">Created</p>
                    <p className="font-semibold text-stone-700">
                      {new Date(previewItem.generatedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <Button onClick={() => handleDownload(previewItem)} className="gap-1.5 bg-stone-800 hover:bg-stone-700">
                    <Download className="h-4 w-4" />
                    Download PNG
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyPrompt(previewItem)}
                      className="flex-1 gap-1.5"
                    >
                      {copiedId === previewItem.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare(previewItem)}
                      className="flex-1 gap-1.5"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
