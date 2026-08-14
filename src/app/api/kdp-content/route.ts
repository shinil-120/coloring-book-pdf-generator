import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface KdpBody {
  categoryName?: string;
  itemCount?: number;
  pdfType?: "color" | "bw";
  items?: string[];
}

/**
 * POST /api/kdp-content
 *
 * Generates Amazon KDP listing content using AI (z-ai-web-dev-sdk):
 *   - Title (SEO-optimized, ≤200 chars)
 *   - Subtitle (≤200 chars)
 *   - Description (SEO-optimized, HTML-formatted, ~4000 chars)
 *   - 7+ Keywords (Amazon KDP search terms)
 *   - Printing cost estimate (based on page count + KDP rates)
 *   - Suggested retail price
 *
 * Uses the GLM chat model to generate SEO-optimized content based on
 * best practices for Amazon KDP coloring books.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as KdpBody;
    const categoryName = (body.categoryName ?? "").trim();
    const itemCount = body.itemCount ?? 0;
    const pdfType = body.pdfType ?? "color";
    const items = Array.isArray(body.items) ? body.items.slice(0, 10) : [];

    if (!categoryName) {
      return NextResponse.json(
        { success: false, error: "categoryName is required" },
        { status: 400 }
      );
    }

    // Calculate KDP printing cost estimate
    // KDP paperback printing costs (US marketplace, as of 2024-2025):
    //   - Fixed cost per book: $0.85
    //   - Per-page cost: $0.012 (black ink) / $0.017 (color ink)
    //   - For B&W interior: $0.012/page
    //   - For color interior: $0.017/page
    const perPageCost = pdfType === "bw" ? 0.012 : 0.017;
    const fixedCost = 0.85;
    const printingCost = fixedCost + (itemCount * perPageCost);

    // Suggested retail price (typically 2.5-3x printing cost for coloring books)
    const suggestedPrice = Math.ceil(printingCost * 3);
    const royalty = suggestedPrice - printingCost - (suggestedPrice * 0.6); // 60% to Amazon

    // Generate SEO content using AI — try Z.AI first, fall back to OpenAI
    const promptText = `You are an Amazon KDP listing expert with deep knowledge of SEO optimization using tools like Ahrefs and Semrush. Generate the complete KDP listing content for a children's coloring book.

BOOK DETAILS:
- Category: ${categoryName}
- Number of pages: ${itemCount}
- Interior type: ${pdfType === "bw" ? "Black & White (no color)" : "Color (colored reference + B&W coloring)"}
- Sample items: ${items.join(", ") || "various " + categoryName.toLowerCase()}

Generate the following in JSON format (return ONLY valid JSON, no markdown):

{
  "title": "SEO-optimized title (max 200 chars). Include keywords like 'Coloring Book', 'Kids', and the category theme. Make it catchy and searchable.",
  "subtitle": "SEO-optimized subtitle (max 200 chars). Expand on the title with benefits or features.",
  "description": "HTML-formatted description (max 4000 chars). Include: bullet points of features, age range, what's inside, benefits. Use <b>, <ul>, <li> tags. SEO-optimize with keywords naturally embedded.",
  "keywords": ["7+ Amazon KDP search keywords (max 50 chars each). Think like a parent searching for coloring books. Include long-tail keywords."],
  "ageRange": "Recommended age range (e.g., '4-8 years')",
  "categories": ["2-3 Amazon KDP browse categories that fit this book"]
}

Guidelines:
- Title should be ≤60 chars for best search visibility (Amazon truncates at 60)
- Use keywords that parents actually search for (think Google search intent)
- Description should have a strong hook in the first 2 lines (visible before "Read more")
- Keywords should include both broad terms ('coloring book for kids') and specific terms ('${categoryName.toLowerCase()} coloring book')
- Consider seasonal search trends and gift-buying intent`;

    const systemPrompt = "You are an expert Amazon KDP listing optimizer with deep SEO knowledge. You return ONLY valid JSON, no markdown, no explanations.";

    let content = "";

    // ── Try Z.AI first (if ZAI_API_KEY is set) ────────────────────────
    const zaiKey = process.env.ZAI_API_KEY;
    if (zaiKey) {
      try {
        const ZAI = (await import("z-ai-web-dev-sdk")).default;
        const zai = new ZAI({
          baseUrl: "https://api.z.ai/api/paas/v4",
          apiKey: zaiKey,
        } as any);

        const response = await zai.chat.completions.create({
          model: "glm-4.5",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: promptText },
          ],
          thinking: { type: "disabled" },
        });
        content = response.choices[0]?.message?.content ?? "";
        console.log("[/api/kdp-content] Z.AI succeeded");
      } catch (zaiErr) {
        const msg = zaiErr instanceof Error ? zaiErr.message : String(zaiErr);
        console.log(`[/api/kdp-content] Z.AI failed: ${msg.slice(0, 100)} — trying OpenAI fallback`);
      }
    }

    // ── Fall back to OpenAI (if Z.AI failed or not configured) ────────
    if (!content) {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return NextResponse.json(
          {
            success: false,
            error: "No AI provider available. Z.AI has insufficient balance and OPENAI_API_KEY is not set. Add OpenAI key to Vercel env vars.",
          },
          { status: 503 }
        );
      }

      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: promptText },
            ],
            temperature: 0.7,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        content = data.choices[0]?.message?.content ?? "";
        console.log("[/api/kdp-content] OpenAI succeeded");
      } catch (openaiErr) {
        return NextResponse.json(
          {
            success: false,
            error: `Both providers failed. Z.AI: insufficient balance. OpenAI: ${openaiErr instanceof Error ? openaiErr.message : "unknown error"}`,
          },
          { status: 500 }
        );
      }
    }

    // Parse the JSON from the AI response
    let kdpContent;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      kdpContent = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      // If JSON parsing fails, return the raw content as description
      kdpContent = {
        title: `${categoryName} Coloring Book for Kids`,
        subtitle: `${itemCount} Unique ${categoryName} Coloring Pages for Children`,
        description: content,
        keywords: [`${categoryName.toLowerCase()} coloring book`, "coloring book for kids", "children coloring pages"],
        ageRange: "4-8 years",
        categories: ["Children's Coloring Books", "Activity Books"],
      };
    }

    return NextResponse.json({
      success: true,
      content: {
        title: kdpContent.title ?? `${categoryName} Coloring Book for Kids`,
        subtitle: kdpContent.subtitle ?? "",
        description: kdpContent.description ?? "",
        keywords: Array.isArray(kdpContent.keywords) ? kdpContent.keywords : [],
        ageRange: kdpContent.ageRange ?? "4-8 years",
        categories: Array.isArray(kdpContent.categories) ? kdpContent.categories : [],
      },
      costEstimate: {
        pageCount: itemCount,
        interiorType: pdfType === "bw" ? "Black & White" : "Color",
        perPageCost,
        fixedCost,
        totalPrintingCost: Math.round(printingCost * 100) / 100,
        suggestedRetailPrice: suggestedPrice,
        estimatedRoyalty: Math.round(royalty * 100) / 100,
        amazonFee: Math.round(suggestedPrice * 0.6 * 100) / 100,
        currency: "USD",
        note: "Based on KDP US marketplace printing rates. Actual costs may vary by marketplace and trim size.",
      },
    });
  } catch (err) {
    console.error("[/api/kdp-content POST] error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
