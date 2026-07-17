import { NextRequest } from "next/server";
import { requireUser, getDefaultPortfolioId } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getMonthlyFundLeaders } from "@/lib/services/fund-monthly-leaders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Önceki takvim ayının (veya ?month=YYYY-MM) en iyi performans gösteren
 * TEFAS fonları + kural tabanlı analiz.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = req.nextUrl;
    const fundType = (searchParams.get("type") ?? "YAT") as "YAT" | "EMK" | "BYF";
    const yearMonth = searchParams.get("month") ?? undefined;
    const topN = Number(searchParams.get("top") ?? "10");
    const force = searchParams.get("refresh") === "1";

    if (!["YAT", "EMK", "BYF"].includes(fundType)) {
      return jsonError(new Error("Geçersiz fon tipi."), 400);
    }

    const portfolioId = await getDefaultPortfolioId(user.id);
    const data = await getMonthlyFundLeaders({
      portfolioId: portfolioId ?? undefined,
      fundType,
      yearMonth,
      topN: Number.isFinite(topN) ? Math.min(Math.max(topN, 5), 25) : 10,
      forceRefresh: force,
    });

    return jsonOk(data);
  } catch (error) {
    return jsonError(error, 400);
  }
}
