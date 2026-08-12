"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileImage,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  name: string;
  sortOrder: number;
  palette: unknown;
  isDeleted: boolean;
}

interface UploadImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorySlug: string;
  itemNames: string[];
  categoryItems: Item[];
  onUploaded?: () => void;
}

interface UploadResult {
  fileName: string;
  itemName: string | null; // matched item name, or null if no match
  success: boolean;
  error?: string;
  sizeBytes?: number;
}

export function UploadImageModal({
  open,
  onOpenChange,
  categorySlug,
  itemNames,
  categoryItems,
  onUploaded,
}: UploadImageModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Match a filename to an item name (case-insensitive, ignoring extension)
  const matchFileToItem = useCallback(
    (fileName: string): string | null => {
      // Remove extension
      const baseName = fileName.replace(/\.[^.]+$/, "").trim();

      // Try exact match (case-insensitive)
      const allItems = categoryItems.filter((i) => !i.isDeleted);
      const exactMatch = allItems.find(
        (i) => i.name.toLowerCase() === baseName.toLowerCase()
      );
      if (exactMatch) return exactMatch.name;

      // Try slugified match (e.g. "t-rex" → "T-Rex")
      const slugify = (s: string) =>
        s
          .replace(/&/g, "and")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      const slugMatch = allItems.find(
        (i) => slugify(i.name).toLowerCase() === slugify(baseName).toLowerCase()
      );
      if (slugMatch) return slugMatch.name;

      // Try partial match (filename contains item name or vice versa)
      const partialMatch = allItems.find(
        (i) =>
          i.name.toLowerCase().includes(baseName.toLowerCase()) ||
          baseName.toLowerCase().includes(i.name.toLowerCase())
      );
      if (partialMatch) return partialMatch.name;

      return null;
    },
    [categoryItems]
  );

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles).filter(
        (f) => f.type === "image/png" || f.type === "image/jpeg" || f.type === "image/jpg"
      );
      const rejected = Array.from(newFiles).length - fileArray.length;
      if (rejected > 0) {
        toast.warning(`${rejected} file(s) skipped`, {
          description: "Only PNG and JPG files are allowed.",
        });
      }
      // Check file sizes
      const valid = fileArray.filter((f) => f.size <= 10 * 1024 * 1024);
      const tooBig = fileArray.length - valid.length;
      if (tooBig > 0) {
        toast.warning(`${tooBig} file(s) too large`, {
          description: "Max file size: 10 MB per image.",
        });
      }
      setFiles((prev) => [...prev, ...valid]);
      setResults([]);
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (files.length === 0 || !categorySlug) return;
    setUploading(true);
    setProgress(0);
    setResults([]);

    const uploadResults: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const matchedItem = matchFileToItem(file.name);

      if (!matchedItem) {
        uploadResults.push({
          fileName: file.name,
          itemName: null,
          success: false,
          error: "No matching item found — rename file to match an item name (e.g. 'Ant.png')",
        });
        setProgress(Math.round(((i + 1) / files.length) * 100));
        setResults([...uploadResults]);
        continue;
      }

      const formData = new FormData();
      formData.append("categorySlug", categorySlug);
      formData.append("itemName", matchedItem);
      formData.append("image", file);

      try {
        const res = await fetch("/api/upload-coloring-image", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          uploadResults.push({
            fileName: file.name,
            itemName: matchedItem,
            success: true,
            sizeBytes: data.sizeBytes,
          });
        } else {
          uploadResults.push({
            fileName: file.name,
            itemName: matchedItem,
            success: false,
            error: data?.error || `HTTP ${res.status}`,
          });
        }
      } catch (err) {
        uploadResults.push({
          fileName: file.name,
          itemName: matchedItem,
          success: false,
          error: err instanceof Error ? err.message : "Network error",
        });
      }

      setProgress(Math.round(((i + 1) / files.length) * 100));
      setResults([...uploadResults]);
    }

    setUploading(false);
    const successCount = uploadResults.filter((r) => r.success).length;
    if (successCount > 0) {
      toast.success(`${successCount} image(s) uploaded!`, {
        description: "Click 'Create PDF' to include them in the book.",
      });
      onUploaded?.();
    }
  }, [files, categorySlug, matchFileToItem, onUploaded]);

  const handleClear = useCallback(() => {
    setFiles([]);
    setResults([]);
    setProgress(0);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden rounded-3xl border-stone-200 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-stone-100 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
            <Upload className="h-5 w-5 text-violet-500" />
            Upload External Images
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            Upload B&amp;W line art generated by free AI tools (ChatGPT, Bing, etc.).
            Files are matched to items by filename (e.g. &quot;Ant.png&quot; → item &quot;Ant&quot;).
            Uploaded images are ADDITIONAL — they don&apos;t replace API-generated ones.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
              dragOver
                ? "border-violet-400 bg-violet-50"
                : "border-stone-300 bg-stone-50/60 hover:border-violet-300 hover:bg-violet-50/40"
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-purple-100">
              <Upload className="h-6 w-6 text-violet-500" />
            </div>
            <p className="text-sm font-bold text-stone-700">
              Drag &amp; drop images here
            </p>
            <p className="text-[11px] text-stone-500">
              or click to browse · PNG or JPG · max 10MB each · bulk upload supported
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* Warning about B&W line art */}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-[11px] text-amber-800">
              <strong>Important:</strong> Images must be B&amp;W line drawings
              (black outlines on white background) — not colored photos.
              If the AI tool generated a colored image, ask it for a
              &quot;black and white line drawing&quot; instead.
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-stone-700">
                  {files.length} file(s) selected
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClear}
                  className="h-7 gap-1 text-[11px] text-stone-500"
                >
                  <X className="h-3 w-3" /> Clear
                </Button>
              </div>
              <div className="space-y-1.5">
                {files.map((file, idx) => {
                  const matched = matchFileToItem(file.name);
                  return (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white p-2"
                    >
                      <FileImage className="h-4 w-4 shrink-0 text-stone-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-stone-700">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-stone-400">
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      {matched ? (
                        <Badge variant="secondary" className="shrink-0 bg-emerald-100 text-[10px] text-emerald-700">
                          → {matched}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0 bg-rose-100 text-[10px] text-rose-700">
                          no match
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-bold text-violet-700">Uploading…</span>
                <span className="tabular-nums text-stone-500">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Upload results */}
          {results.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-bold text-stone-700">Results:</p>
              {results.map((r, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-2",
                    r.success
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-rose-200 bg-rose-50/40"
                  )}
                >
                  {r.success ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-stone-700">
                      {r.fileName}
                      {r.itemName && (
                        <span className="text-stone-500"> → {r.itemName}</span>
                      )}
                    </p>
                    {r.error && (
                      <p className="text-[10px] text-rose-600">{r.error}</p>
                    )}
                    {r.success && r.sizeBytes && (
                      <p className="text-[10px] text-emerald-600">
                        Uploaded ({(r.sizeBytes / 1024).toFixed(0)} KB) — included as additional page
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 px-6 py-3">
          <p className="text-[11px] text-stone-500">
            Tip: rename files to match item names (e.g. &quot;Ant.png&quot;, &quot;Bee.png&quot;)
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-bold"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="gap-1.5 rounded-xl bg-violet-600 text-xs font-bold hover:bg-violet-700"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : `Upload ${files.length} File(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
