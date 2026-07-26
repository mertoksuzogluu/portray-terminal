import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { YahooFinanceProvider } from "@/lib/providers/yahoo-finance";
import { marketDateOnly, toDateKey } from "@/lib/utils/dates";

/**
 * XU100 için dönem içi Yahoo geçmişini yazar.
 * demo-seed / carry-forward (~10k) ile gerçek seviye (~13–14k) karışmasın.
 */
export async function ensureBistHistory(
  periodStart: Date,
  periodEnd: Date
): Promise<{ upserted: number; error: string | null }> {
  const bench = await prisma.benchmark.findFirst({
    where: { symbol: "XU100", isActive: true },
  });
  if (!bench) {
    return { upserted: 0, error: "XU100 benchmark bulunamadı." };
  }

  try {
    const yahoo = new YahooFinanceProvider();
    // BIST 100 Yahoo’da XU100.IS
    const rows = await yahoo.getHistoricalPricesByProviderSymbol(
      "XU100.IS",
      periodStart,
      periodEnd
    );

    let upserted = 0;
    for (const row of rows) {
      const priceDate = marketDateOnly(row.date);
      const value = Number(row.close);
      if (!Number.isFinite(value) || value <= 0) continue;

      await prisma.benchmarkPrice.upsert({
        where: {
          benchmarkId_priceDate_source: {
            benchmarkId: bench.id,
            priceDate,
            source: "yahoo_finance",
          },
        },
        create: {
          benchmarkId: bench.id,
          priceDate,
          value: new Prisma.Decimal(value),
          source: "yahoo_finance",
        },
        update: {
          value: new Prisma.Decimal(value),
          fetchedAt: new Date(),
        },
      });
      upserted += 1;
    }

    return {
      upserted,
      error:
        upserted === 0
          ? `Yahoo XU100.IS boş döndü (${toDateKey(periodStart)}–${toDateKey(periodEnd)}).`
          : null,
    };
  } catch (err) {
    return {
      upserted: 0,
      error:
        err instanceof Error
          ? `BIST geçmişi alınamadı: ${err.message}`
          : "BIST geçmişi alınamadı.",
    };
  }
}
