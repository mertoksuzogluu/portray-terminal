import { NextRequest } from "next/server";
import { requireUser, getDefaultPortfolioId } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  analyzeMarketOpportunities,
  ensureWatchAssets,
} from "@/lib/services/market-opportunity";
import { syncHistoricalPrices } from "@/lib/services/historical-sync";
import { pickWeeklyWatchSymbols } from "@/lib/data/market-watch-universe";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Portföy + haftalık izleme için volatilite-ayarlı bant analizi.
 * ?refresh=1 → haftanın varlıklarını garanti et + geçmiş doldur.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const portfolioId = await getDefaultPortfolioId(user.id);
    if (!portfolioId) {
      return jsonError(new Error("Portföy bulunamadı."), 404);
    }

    const force = req.nextUrl.searchParams.get("refresh") === "1";
    let history: Awaited<ReturnType<typeof syncHistoricalPrices>> | null = null;

    if (force) {
      const weekly = pickWeeklyWatchSymbols({ stockCount: 6 });
      const watchIds = await ensureWatchAssets(weekly.all);

      const held = await prisma.positionDailySnapshot.findMany({
        where: { portfolioId, accountId: "" },
        distinct: ["assetId"],
        select: { assetId: true },
        orderBy: { snapshotDate: "desc" },
        take: 40,
      });

      const assetIds = [
        ...new Set([...held.map((h) => h.assetId), ...watchIds.values()]),
      ];
      history = await syncHistoricalPrices({
        assetIds,
        years: 1,
        minPoints: 60,
      });
    }

    const data = await analyzeMarketOpportunities({ portfolioId });

    return jsonOk({
      ...data,
      historySync: history,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
