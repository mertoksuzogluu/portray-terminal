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

async function syncThinWatchHistory(options: {
  assetIds: string[];
  force: boolean;
  timeBudgetMs: number;
}) {
  const minPoints = options.force ? 80 : 40;
  const thin: string[] = [];

  for (const assetId of options.assetIds) {
    const count = await prisma.assetPrice.count({
      where: {
        assetId,
        priceDate: { gte: new Date(Date.now() - 400 * 86400000) },
      },
    });
    if (count < minPoints) thin.push(assetId);
  }

  if (thin.length === 0) {
    return { processed: 0, skipped: options.assetIds.length, errors: [] as string[] };
  }

  // Sayfayı kilitlemesin: süre bütçesi dolunca bırak
  const work = syncHistoricalPrices({
    assetIds: thin.slice(0, options.force ? 12 : 6),
    years: 1,
    minPoints,
  }).catch((err) => ({
    processed: 0,
    skipped: 0,
    errors: [err instanceof Error ? err.message : "Senkron hatası"],
  }));

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), options.timeBudgetMs)
  );

  const result = await Promise.race([work, timeout]);
  if (!result) {
    // Yarım kalan iş uyarısı; bir sonraki yenilemede devam eder
    void work;
    return {
      processed: 0,
      skipped: 0,
      errors: ["Geçmiş doldurma zaman aşımı — «Geçmişi doldur & yenile» ile tekrar deneyin."],
    };
  }
  return result;
}

/**
 * Portföy + haftalık izleme için volatilite-ayarlı bant analizi.
 * Önce mevcut veriyle cevap döner; eksik geçmiş kısa süre bütçesiyle doldurulur.
 * ?refresh=1 → daha agresif senkron + portföy varlıkları.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const portfolioId = await getDefaultPortfolioId(user.id);
    if (!portfolioId) {
      return jsonError(new Error("Portföy bulunamadı."), 404);
    }

    const force = req.nextUrl.searchParams.get("refresh") === "1";
    const weekly = pickWeeklyWatchSymbols({ stockCount: 6 });
    const watchIds = await ensureWatchAssets(weekly.all);
    const watchAssetIds = [...watchIds.values()];

    // 1) Önce mevcut veriyle analiz — ekran boş kalmasın
    let data = await analyzeMarketOpportunities({ portfolioId });
    const needsHistory = data.watchlistHighlights.some(
      (o) => o.signal === "INSUFFICIENT_DATA" || o.observationCount < 40
    );

    let history: Awaited<ReturnType<typeof syncHistoricalPrices>> | null = null;

    if (force || needsHistory) {
      history = await syncThinWatchHistory({
        assetIds: watchAssetIds,
        force,
        timeBudgetMs: force ? 45000 : 18000,
      });

      if (force) {
        const held = await prisma.positionDailySnapshot.findMany({
          where: { portfolioId, accountId: "" },
          distinct: ["assetId"],
          select: { assetId: true },
          orderBy: { snapshotDate: "desc" },
          take: 40,
        });
        const watchSet = new Set(watchAssetIds);
        const extraHeld = held
          .map((h) => h.assetId)
          .filter((id) => !watchSet.has(id));
        if (extraHeld.length) {
          const heldHistory = await syncThinWatchHistory({
            assetIds: extraHeld,
            force: true,
            timeBudgetMs: 25000,
          });
          history = {
            processed: history.processed + heldHistory.processed,
            skipped: history.skipped + heldHistory.skipped,
            errors: [...history.errors, ...heldHistory.errors],
          };
        }
      }

      // 2) Doldurma olduysa analizi tazele
      if (history.processed > 0 || force) {
        data = await analyzeMarketOpportunities({ portfolioId });
      }
    }

    return jsonOk({
      ...data,
      historySync: history,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
