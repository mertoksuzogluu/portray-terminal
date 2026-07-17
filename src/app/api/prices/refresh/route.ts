import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { syncInflationData, syncMarketData } from "@/lib/services/market-sync";
import { syncHistoricalPrices } from "@/lib/services/historical-sync";
import { createDailySnapshot } from "@/lib/services/snapshot-service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Kullanıcı tetiklemeli fiyat yenileme: canlı fiyatları çeker (force),
 * ardından bugünkü snapshot'ı yeniden üretir ki panel güncel değerleri göstersin.
 */
export async function POST() {
  try {
    const user = await requireUser();

    const portfolios = await prisma.portfolio.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    // 1) Önce mevcut fiyatlarla snapshot üret ki panel hemen dolsun.
    for (const p of portfolios) {
      await createDailySnapshot(p.id);
    }

    // 2) Canlı fiyatları çek (fetch'lerde timeout var; takılmaz).
    let market: Awaited<ReturnType<typeof syncMarketData>> = {
      processed: 0,
      errors: [],
      status: "SUCCESS",
    };
    try {
      market = await syncMarketData({ force: true });
    } catch (err) {
      market = {
        processed: 0,
        status: "FAILED",
        errors: [err instanceof Error ? err.message : "Senkron hatası"],
      };
    }

    try {
      await syncInflationData();
    } catch {
      // enflasyon opsiyonel — fiyat güncellemesini bloklamasın
    }

    // 2b) Portföy + bu haftanın izleme listesi için geçmiş doldur.
    let history: Awaited<ReturnType<typeof syncHistoricalPrices>> = {
      processed: 0,
      skipped: 0,
      errors: [],
    };
    try {
      const { pickWeeklyWatchSymbols } = await import(
        "@/lib/data/market-watch-universe"
      );
      const { ensureWatchAssets } = await import(
        "@/lib/services/market-opportunity"
      );
      const weekly = pickWeeklyWatchSymbols({ stockCount: 6 });
      const watchIds = await ensureWatchAssets(weekly.all);

      const held = await prisma.positionDailySnapshot.findMany({
        where: {
          portfolioId: { in: portfolios.map((p) => p.id) },
          accountId: "",
        },
        distinct: ["assetId"],
        select: { assetId: true },
        take: 30,
      });
      const assetIds = [
        ...new Set([...held.map((h) => h.assetId), ...watchIds.values()]),
      ];
      if (assetIds.length) {
        history = await syncHistoricalPrices({
          assetIds,
          years: 1,
          minPoints: 60,
        });
      }
    } catch (err) {
      history = {
        processed: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : "Geçmiş senkron hatası"],
      };
    }

    // 3) Güncel fiyatlarla snapshot'ı tazele.
    for (const p of portfolios) {
      await createDailySnapshot(p.id);
    }

    return jsonOk({
      processed: market.processed,
      status: market.status,
      errors: [...market.errors, ...history.errors],
      portfolios: portfolios.length,
      history,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
