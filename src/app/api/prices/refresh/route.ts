import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { syncInflationData, syncMarketData } from "@/lib/services/market-sync";
import { createDailySnapshot } from "@/lib/services/snapshot-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Kullanıcı tetiklemeli fiyat yenileme: canlı fiyatları çeker (force),
 * ardından bugünkü snapshot'ı yeniden üretir ki panel güncel değerleri göstersin.
 */
export async function POST() {
  try {
    const user = await requireUser();

    const market = await syncMarketData({ force: true });
    try {
      await syncInflationData();
    } catch {
      // enflasyon opsiyonel — fiyat güncellemesini bloklamasın
    }

    const portfolios = await prisma.portfolio.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    for (const p of portfolios) {
      await createDailySnapshot(p.id);
    }

    return jsonOk({
      processed: market.processed,
      status: market.status,
      errors: market.errors,
      portfolios: portfolios.length,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
