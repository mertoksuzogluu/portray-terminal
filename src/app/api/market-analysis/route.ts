import { NextRequest } from "next/server";
import { requireUser, getDefaultPortfolioId } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { analyzeMarketOpportunities } from "@/lib/services/market-opportunity";
import { syncHistoricalPrices } from "@/lib/services/historical-sync";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const WATCH_SYMBOLS = ["GRAMALTIN", "USDTRY", "THYAO", "TUPRS"];

/**
 * Portföy + izleme listesi için 2y fiyat bandı analizi.
 * ?refresh=1 → eksik geçmiş fiyatları doldurur (Twelve Data / TEFAS).
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
      const held = await prisma.positionDailySnapshot.findMany({
        where: { portfolioId, accountId: "" },
        distinct: ["assetId"],
        select: { assetId: true },
        orderBy: { snapshotDate: "desc" },
        take: 40,
      });
      const watch = await prisma.asset.findMany({
        where: { symbol: { in: WATCH_SYMBOLS }, isActive: true },
        select: { id: true },
      });
      const assetIds = [
        ...new Set([...held.map((h) => h.assetId), ...watch.map((w) => w.id)]),
      ];
      history = await syncHistoricalPrices({
        assetIds,
        years: 2,
        minPoints: 180,
      });
    }

    const data = await analyzeMarketOpportunities({
      portfolioId,
      years: 2,
    });

    return jsonOk({
      ...data,
      historySync: history,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
