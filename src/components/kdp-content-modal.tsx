"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  DollarSign,
  Tag,
  FileText,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface KdpContent {
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  ageRange: string;
  categories: string[];
}

interface CostEstimate {
  pageCount: number;
  interiorType: string;
  perPageCost: number;
  fixedCost: number;
  totalPrintingCost: number;
  suggestedRetailPrice: number;
  estimatedRoyalty: number;
  amazonFee: number;
  currency: string;
  note: string;
}

interface KdpContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  itemCount: number;
  pdfType: "color" | "bw";
  items: string[];
}

export function KdpContentModal({
  open,
  onOpenChange,
  categoryName,
  itemCount,
  pdfType,
  items,
}: KdpContentModalProps) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<KdpContent | null>(null);
  const [cost, setCost] = useState<CostEstimate | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!categoryName) return;
    setLoading(true);
    setContent(null);
    setCost(null);
    try {
      const res = await fetch("/api/kdp-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryName,
          itemCount,
          pdfType,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setContent(data.content);
      setCost(data.costEstimate);
      toast.success("KDP content generated!", {
        description: "Copy the content to your Amazon KDP listing.",
      });
    } catch (err) {
      toast.error("Failed to generate KDP content", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [categoryName, itemCount, pdfType, items]);

  useEffect(() => {
    if (open && !content && !loading) {
      generate();
    }
  }, [open]);  

  const copyField = useCallback(async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(`Copied ${field}`);
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  const copyAll = useCallback(async () => {
    if (!content || !cost) return;
    const text = `TITLE: ${content.title}
SUBTITLE: ${content.subtitle}

DESCRIPTION:
${content.description.replace(/<[^>]+>/g, "")}

KEYWORDS: ${content.keywords.join(", ")}

AGE RANGE: ${content.ageRange}
CATEGORIES: ${content.categories.join(", ")}

--- COST ESTIMATE ---
Pages: ${cost.pageCount}
Interior: ${cost.interiorType}
Printing cost: $${cost.totalPrintingCost}
Suggested price: $${cost.suggestedRetailPrice}
Estimated royalty: $${cost.estimatedRoyalty}
${cost.note}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("All content copied to clipboard!");
    } catch {
      toast.error("Could not copy");
    }
  }, [content, cost]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden rounded-3xl border-stone-200 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-stone-100 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-stone-800">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            KDP Listing Content
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            AI-generated title, SEO description, keywords & pricing for Amazon KDP.
            {categoryName && ` Category: ${categoryName} · ${itemCount} pages · ${pdfType === "bw" ? "B&W" : "Color"}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[68vh] px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-sm font-bold text-stone-600">Generating KDP content…</p>
              <p className="text-[11px] text-stone-400">AI is optimizing for SEO (10-15 seconds)</p>
            </div>
          ) : content ? (
            <div className="space-y-4">
              {/* Title */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs font-bold text-stone-700">
                    <Tag className="h-3 w-3" /> Title
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => copyField("title", content.title)}>
                    {copiedField === "title" ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </Button>
                </div>
                <p className="text-sm font-bold text-stone-800">{content.title}</p>
                <p className="text-[10px] text-stone-400">{content.title.length} chars</p>
              </div>

              {/* Subtitle */}
              {content.subtitle && (
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-bold text-stone-700">
                      <FileText className="h-3 w-3" /> Subtitle
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => copyField("subtitle", content.subtitle)}>
                      {copiedField === "subtitle" ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                    </Button>
                  </div>
                  <p className="text-xs text-stone-700">{content.subtitle}</p>
                </div>
              )}

              {/* Description */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs font-bold text-stone-700">
                    <FileText className="h-3 w-3" /> Description
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => copyField("description", content.description.replace(/<[^>]+>/g, ""))}>
                    {copiedField === "description" ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </Button>
                </div>
                <div className="text-xs text-stone-700 [&_b]:font-bold [&_ul]:ml-4 [&_li]:mb-1" dangerouslySetInnerHTML={{ __html: content.description }} />
              </div>

              {/* Keywords */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs font-bold text-stone-700">
                    <TrendingUp className="h-3 w-3" /> Keywords ({content.keywords.length})
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => copyField("keywords", content.keywords.join(", "))}>
                    {copiedField === "keywords" ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {content.keywords.map((kw, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Age + Categories */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                  <p className="text-xs font-bold text-stone-700">Age Range</p>
                  <p className="text-xs text-stone-600">{content.ageRange}</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                  <p className="text-xs font-bold text-stone-700">Categories</p>
                  <p className="text-xs text-stone-600">{content.categories.join(", ")}</p>
                </div>
              </div>

              {/* Cost Estimate */}
              {cost && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="mb-2 flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-800">Cost & Pricing Estimate</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-stone-500">Pages</p>
                      <p className="font-bold text-stone-800">{cost.pageCount}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Interior</p>
                      <p className="font-bold text-stone-800">{cost.interiorType}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Printing cost</p>
                      <p className="font-bold text-stone-800">${cost.totalPrintingCost}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Suggested price</p>
                      <p className="font-bold text-emerald-700">${cost.suggestedRetailPrice}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Amazon fee (60%)</p>
                      <p className="font-bold text-stone-800">${cost.amazonFee}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Your royalty</p>
                      <p className="font-bold text-emerald-700">${cost.estimatedRoyalty}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-stone-500">{cost.note}</p>
                </div>
              )}

              {/* Copy All */}
              <Button onClick={copyAll} className="w-full gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold hover:bg-emerald-700">
                <Copy className="h-3.5 w-3.5" />
                Copy All Content
              </Button>

              {/* Regenerate */}
              <Button onClick={generate} variant="outline" className="w-full gap-1.5 rounded-xl text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <p className="text-sm text-stone-500">Click generate to create KDP content</p>
              <Button onClick={generate} className="gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold hover:bg-emerald-700">
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
