"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColoringBookGenerator } from "@/components/coloring-book-generator";
import { PdfEditor } from "@/components/pdf-editor";
import { ImageGenerator } from "@/components/image-generator";
import { Generator } from "@/components/generator";
import { Palette, FileText, Wand2, Sparkles, Zap } from "lucide-react";

export default function Home() {
  const [tab, setTab] = useState<string>("books");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-rose-50 via-orange-50 to-amber-50">
      {/* ───────────────────────── Header ───────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-rose-100/80 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 via-orange-400 to-amber-400 shadow-md">
                <Palette className="h-5 w-5 text-white" strokeWidth={2.5} />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow">
                  <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                </span>
              </div>
              <div className="leading-tight">
                <h1 className="text-sm font-extrabold tracking-tight text-stone-800 sm:text-base lg:text-lg">
                  Coloring Book Studio
                </h1>
                <p className="hidden text-[11px] font-medium text-stone-500 sm:block">
                  Amazon KDP-ready PDFs from AI-generated images
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 md:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-700">
                Studio Ready
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ───────────────────────── Main ───────────────────────── */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="mb-6 flex flex-col items-start gap-3">
              <TabsList className="h-auto w-full gap-1 overflow-x-auto rounded-2xl border border-rose-100 bg-white p-1.5 shadow-sm sm:w-auto sm:flex-wrap sm:overflow-visible">
                <TabsTrigger
                  value="books"
                  className="h-9 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-bold text-stone-600 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white data-[state=active]:shadow-md sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <Palette className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">Books</span>
                </TabsTrigger>
                <TabsTrigger
                  value="editor"
                  className="h-9 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-bold text-stone-600 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">Edit PDF</span>
                </TabsTrigger>
                <TabsTrigger
                  value="generator"
                  className="h-9 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-bold text-stone-600 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <Zap className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">Generator</span>
                </TabsTrigger>
                <TabsTrigger
                  value="image-gen"
                  className="h-9 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-bold text-stone-600 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <Wand2 className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">AI Image</span>
                </TabsTrigger>
              </TabsList>

              <div className="hidden text-xs font-medium text-stone-500 sm:block">
                Up to 10 books · 8.5 × 11 in · 0.5&quot; margins
              </div>
            </div>

            <TabsContent value="books" className="mt-0">
              <ColoringBookGenerator />
            </TabsContent>

            <TabsContent value="editor" className="mt-0">
              <PdfEditor />
            </TabsContent>

            <TabsContent value="generator" className="mt-0">
              <Generator />
            </TabsContent>

            <TabsContent value="image-gen" className="mt-0">
              <ImageGenerator />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* ───────────────────────── Footer ───────────────────────── */}
      <footer className="mt-auto border-t border-rose-100/80 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
            <p className="text-xs font-semibold text-stone-600">
              © {new Date().getFullYear()} Coloring Book Studio · Built for
              Amazon KDP creators
            </p>
            <p className="text-xs font-semibold text-stone-500">
              AI-generated · Auto-colorized · Bleed-through safe
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
