import { NextResponse } from "next/server";
import {
  getTotalSpend,
  listProviders,
  isTursoConfigured,
} from "@/lib/provider-store";
import { turso } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UsageRow {
  label: string;
  providerId: string | null;
  todaySpend: number;
  todayCount: number;
  allTimeSpend: number;
  allTimeCount: number;
}

/**
 * GET /api/budget
 *
 * Returns a budget summary for the image-generation spend:
 *
 *   todaySpend      number   — USD spent today (UTC day)
 *   allTimeSpend    number   — USD spent since records began
 *   imageCount      number   — total images generated
 *   byProvider      [{
 *     label         string
 *     todaySpend    number
 *     todayCount    number
 *     allTimeSpend  number
 *   }]
 *
 * If Turso is not configured, returns zeros with `source: "none"`.
 */
export async function GET() {
  try {
    if (!isTursoConfigured() || !turso) {
      return NextResponse.json({
        success: true,
        source: "none",
        todaySpend: 0,
        allTimeSpend: 0,
        imageCount: 0,
        byProvider: [],
        message: "Turso not configured — set TURSO_DATABASE_URL",
      });
    }

    const totals = await getTotalSpend();
    const today = new Date().toISOString().slice(0, 10);

    // Per-provider breakdown — LEFT JOIN so providers with no usage still
    // appear (with zeros), so the UI can show them.
    const result = await turso.execute({
      sql: `
        SELECT
          p.id            AS providerId,
          p.label         AS label,
          COALESCE(SUM(CASE WHEN u.usedDate = ? THEN u.costUsd ELSE 0 END), 0) AS todaySpend,
          COALESCE(SUM(CASE WHEN u.usedDate = ? THEN u.imageCount ELSE 0 END), 0) AS todayCount,
          COALESCE(SUM(u.costUsd), 0)     AS allTimeSpend,
          COALESCE(SUM(u.imageCount), 0)   AS allTimeCount
        FROM providers p
        LEFT JOIN provider_usage u ON u.providerId = p.id
        GROUP BY p.id, p.label
        ORDER BY p.failoverOrder ASC, p.label ASC
      `,
      args: [today, today],
    });

    const byProvider: UsageRow[] = result.rows.map((row) => {
      const r = row as unknown as {
        providerId: string | null;
        label: string;
        todaySpend: number | null;
        todayCount: number | null;
        allTimeSpend: number | null;
        allTimeCount: number | null;
      };
      return {
        label: r.label,
        providerId: r.providerId,
        todaySpend: Number(r.todaySpend ?? 0),
        todayCount: Number(r.todayCount ?? 0),
        allTimeSpend: Number(r.allTimeSpend ?? 0),
        allTimeCount: Number(r.allTimeCount ?? 0),
      };
    });

    // Also fetch full provider list so the client can show isConfigured/
    // isActive status alongside the usage numbers.
    const providers = await listProviders();

    return NextResponse.json({
      success: true,
      source: "turso",
      todaySpend: totals.today,
      allTimeSpend: totals.allTime,
      imageCount: totals.imageCount,
      byProvider,
      providers,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/budget GET] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
