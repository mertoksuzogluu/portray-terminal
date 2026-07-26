import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api/cron-auth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { generateMonthlyAiAnalystReports } from "@/lib/ai-analyst";
import { istanbulToday } from "@/lib/utils/dates";

/**
 * Her ayın 30'unda otomatik AI Analist raporu.
 * Manuel rapor kullanılmış olsa bile ayrıca üretilir (ayda maks 2).
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const today = istanbulToday();
    const day = today.getUTCDate();
    const lastDay = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const isPublishDay = day === 30 || (lastDay < 30 && day === lastDay);

    if (!isPublishDay && req.nextUrl.searchParams.get("force") !== "1") {
      return jsonOk({
        ok: true,
        skipped: true,
        reason: "Yalnızca ayın 30'unda (veya kısa aylarda son günde) üretilir.",
        day,
        lastDay,
      });
    }

    const result = await generateMonthlyAiAnalystReports(today, {
      trigger: "scheduled",
    });
    return jsonOk({ ok: true, skipped: false, ...result });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
