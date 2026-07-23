import { subYears } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getFundProvider, getStockProvider } from "@/lib/providers";
import { marketDateOnly } from "@/lib/utils/dates";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Aktif varlıklar için geçmiş fiyat doldurur (varsayılan 2 yıl).
 * Twelve Data rate limit'e dikkat: varlıklar arası bekleme var.
 */
export async function syncHistoricalPrices(options?: {
  assetIds?: string[];
  years?: number;
  /** Bu sayıdan az kayıt varsa yeniden çek. */
  minPoints?: number;
}): Promise<{ processed: number; skipped: number; errors: string[] }> {
  const years = options?.years ?? 2;
  const minPoints = options?.minPoints ?? 180;
  const end = marketDateOnly(new Date());
  const start = subYears(end, years);

  const assets = await prisma.asset.findMany({
    where: {
      isActive: true,
      ...(options?.assetIds?.length
        ? { id: { in: options.assetIds } }
        : {
            assetType: {
              in: ["STOCK", "ETF", "GOLD", "FX", "MUTUAL_FUND", "CRYPTO"],
            },
          }),
    },
  });

  const stockProvider = getStockProvider();
  const fundProvider = getFundProvider();
  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const asset of assets) {
    try {
      const existingCount = await prisma.assetPrice.count({
        where: {
          assetId: asset.id,
          priceDate: { gte: start },
        },
      });
      if (existingCount >= minPoints) {
        skipped += 1;
        continue;
      }

      if (asset.assetType === "MUTUAL_FUND") {
        const code = asset.tefasCode ?? asset.symbol;
        const rows = await fundProvider.getHistoricalPrices(code, start, end);
        for (const row of rows) {
          const priceDate = marketDateOnly(row.date);
          await prisma.assetPrice.upsert({
            where: {
              assetId_priceDate_source: {
                assetId: asset.id,
                priceDate,
                source: row.source,
              },
            },
            create: {
              assetId: asset.id,
              priceDate,
              close: new Prisma.Decimal(row.price),
              currency: asset.currency,
              source: row.source,
              dataQuality: "END_OF_DAY",
              isDelayed: true,
              fetchedAt: new Date(),
            },
            update: {
              close: new Prisma.Decimal(row.price),
              fetchedAt: new Date(),
            },
          });
        }
        if (rows.length) processed += 1;
        await sleep(350);
        continue;
      }

      if (!stockProvider.isConfigured()) {
        skipped += 1;
        continue;
      }

      const rows =
        asset.providerSymbol && stockProvider.getHistoricalPricesByProviderSymbol
          ? await stockProvider.getHistoricalPricesByProviderSymbol(
              asset.providerSymbol,
              start,
              end
            )
          : await stockProvider.getHistoricalPrices(asset.symbol, start, end);

      for (const row of rows) {
        const priceDate = marketDateOnly(row.date);
        await prisma.assetPrice.upsert({
          where: {
            assetId_priceDate_source: {
              assetId: asset.id,
              priceDate,
              source: row.source,
            },
          },
          create: {
            assetId: asset.id,
            priceDate,
            open: row.open ? new Prisma.Decimal(row.open) : null,
            high: row.high ? new Prisma.Decimal(row.high) : null,
            low: row.low ? new Prisma.Decimal(row.low) : null,
            close: new Prisma.Decimal(row.close),
            volume: row.volume ? new Prisma.Decimal(row.volume) : null,
            currency: asset.currency,
            source: row.source,
            dataQuality: "END_OF_DAY",
            isDelayed: true,
            fetchedAt: new Date(),
          },
          update: {
            open: row.open ? new Prisma.Decimal(row.open) : null,
            high: row.high ? new Prisma.Decimal(row.high) : null,
            low: row.low ? new Prisma.Decimal(row.low) : null,
            close: new Prisma.Decimal(row.close),
            volume: row.volume ? new Prisma.Decimal(row.volume) : null,
            fetchedAt: new Date(),
          },
        });
      }
      if (rows.length) processed += 1;
      await sleep(800); // Twelve Data rate limit
    } catch (err) {
      errors.push(
        `${asset.symbol}: ${err instanceof Error ? err.message : "hata"}`
      );
    }
  }

  return { processed, skipped, errors };
}
