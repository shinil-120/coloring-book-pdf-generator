/**
 * Shared prompt builder for coloring book image generation.
 *
 * Used by:
 *   - /api/generate (when generating via OpenAI/Z.AI/etc.)
 *   - /api/prompts  (when displaying prompts for external tools)
 *
 * The prompt is designed to produce clean B&W line art suitable for
 * children's coloring books — thick black outlines on white background,
 * single subject centered, no shading or grayscale.
 */
import { categorySuffix } from "./coloring-data";

/**
 * Build the standard coloring-book prompt for an item.
 *
 * @param itemName  e.g. "T-Rex", "Ant", "Rose"
 * @param categoryName  e.g. "Dinosaurs", "Bugs", "Flowers"
 *   (used to look up the suffix: "dinosaur", "insect", "flower", etc.)
 * @returns the full prompt string
 */
export function buildPrompt(itemName: string, categoryName: string): string {
  const suffix = categorySuffix(categoryName);
  return (
    `Black and white line drawing coloring page for kids of a ${itemName} ${suffix}. ` +
    `Simple clean outline, no shading, no gray tones, ` +
    `thick black lines on white background, suitable for children coloring book, ` +
    `cartoon style, cute and friendly, single subject centered on page, full body visible`
  );
}

/**
 * Suggested free external AI tools the user can paste the prompt into.
 * Listed in the "View Prompts" modal + the upload modal.
 */
export const FREE_AI_TOOLS = [
  {
    name: "ChatGPT (free)",
    url: "https://chat.openai.com",
    note: "Limited free image generations per day",
  },
  {
    name: "Bing Image Creator",
    url: "https://www.bing.com/images/create",
    note: "Free, powered by DALL-E 3",
  },
  {
    name: "Craiyon",
    url: "https://www.craiyon.com",
    note: "Free, no signup required",
  },
  {
    name: "Leonardo.AI (free tier)",
    url: "https://app.leonardo.ai",
    note: "150 free tokens/day",
  },
] as const;
