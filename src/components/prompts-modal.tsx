"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Copy,
  Check,
  Download,
  Loader2,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PromptItem {
  itemName: string;
  prompt: string;
}

interface FreeTool {
  name: string;
  url: string;
  note: string;
}

interface PromptsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorySlug: string;
  itemNames: string[];
}

export function PromptsModal({
  open,
  onOpenChange,
  categorySlug,
  itemNames,
}: PromptsModalProps) {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [freeTools, setFreeTools] = useState<FreeTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const fetchPrompts = useCallback(async () => {
    if (!categorySlug || itemNames.length === 0) return;
    setLoading(true);
    try {
      const url = `/api/prompts?categorySlug=${encodeURIComponent(categorySlug)}&itemNames=${encodeURIComponent(itemNames.join(","))}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPrompts(data.prompts ?? []);
        setFreeTools(data.freeTools ?? []);
      } else {
        toast.error("Failed to load prompts", {
          description: data?.error || "Unknown error",
        });
      }
    } catch (err) {
      toast.error("Failed to load prompts", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [categorySlug, itemNames]);

  useEffect(() => {
    if (open) fetchPrompts();
  }, [open, fetchPrompts]);

  const copyAll = useCallback(async () => {
    const text = prompts
      .map((p, i) => `${i + 1}. ${p.itemName}\n${p.prompt}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
      toast.success(`Copied ${prompts.length} prompts to clipboard`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [prompts]);

  const downloadTxt = useCallback(() => {
    const text = prompts
      .map((p, i) => `${i + 1}. ${p.itemName}\n${p.prompt}`)
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${categorySlug}-prompts.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded prompts as .txt");
  }, [prompts, categorySlug]);

  const copyOne = useCallback(async (idx: number) => {
    const p = prompts[idx];
    if (!p) return;
    try {
      await navigator.clipboard.writeText(p.prompt);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
      toast.success(`Copied prompt for "${p.itemName}"`);
    } catch {
      toast.error("Could not copy");
    }
  }, [prompts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden rounded-3xl border-stone-200 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-stone-100 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
            <FileText className="h-5 w-5 text-violet-500" />
            Prompts for {itemNames.length} Item{itemNames.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            Copy these prompts into free AI tools (ChatGPT, Bing, etc.) to generate
            B&amp;W line art for free. Then upload the images via the Upload button.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-stone-100 px-6 py-3">
          <Button
            type="button"
            size="sm"
            onClick={copyAll}
            disabled={loading || prompts.length === 0}
            className="gap-1.5 rounded-xl bg-violet-600 text-xs font-bold hover:bg-violet-700"
          >
            {copiedAll ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy All
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={downloadTxt}
            disabled={loading || prompts.length === 0}
            className="gap-1.5 rounded-xl text-xs font-bold"
          >
            <Download className="h-3.5 w-3.5" />
            Download .txt
          </Button>
        </div>

        <ScrollArea className="max-h-[55vh] px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {prompts.map((p, idx) => (
                <div
                  key={p.itemName}
                  className="rounded-xl border border-stone-200 bg-stone-50/60 p-3"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-bold text-stone-700">
                      {idx + 1}. {p.itemName}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => copyOne(idx)}
                      className="h-7 gap-1 px-2 text-[11px] text-violet-600 hover:bg-violet-50"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-stone-600">
                    {p.prompt}
                  </p>
                </div>
              ))}

              {freeTools.length > 0 && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                  <p className="mb-2 text-xs font-bold text-violet-800">
                    🌐 Suggested free AI tools:
                  </p>
                  <div className="space-y-1">
                    {freeTools.map((tool) => (
                      <a
                        key={tool.url}
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-violet-700 hover:text-violet-900 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="font-semibold">{tool.name}</span>
                        <span className="text-violet-500">— {tool.note}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
