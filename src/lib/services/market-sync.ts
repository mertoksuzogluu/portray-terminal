import { prisma } from "@/lib/db/prisma";
import {
  getFundProvider,
  getFxProvider,
  getInflationProvider,
  getStockProvider,
} from "@/lib/providers";
import { Prisma } from "@prisma/client";
import { marketDateOnly } from "@/lib/utils/dates";

function isBistOpen(now = new Date()): boolean {
  // Europe/Istanbul kabaca: hafta içi 10:00–18:00
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (weekday === "Sat" || weekday === "Sun") return false;
  return hour >= 10 && hour < 18;
}

function isStale(fetchedAt: Date, maxAgeHours: number): boolean {
  const ageMs = Date.now() - fetchedAt.getTime();
  return ageMs > maxAgeHours * 60 * 60 * 1000;
}

export async function syncMarketData(options?: {
  force?: boolean;
}): Promise<{
  processed: number;
  errors: string[];
  status: "SUCCESS" | "PARTIAL" | "FAILED";
}> {
  const log = await prisma.dataSyncLog.create({
    data: {
      provider: "multi",
      syncType: "market_prices",
      status: "RUNNING",
    },
  });

  const errors: string[] = [];
  let processed = 0;
  const force = options?.force ?? false;
  const marketOpen = isBistOpen();

  try {
    const assets = await prisma.asset.findMany({
      where: { isActive: true },
    });

    const stockProvider = getStockProvider();
    const fundProvider = getFundProvider();

    for (const asset of assets) {
      try {
        const latest = await prisma.assetPrice.findFirst({
          where: { assetId: asset.id },
          orderBy: [{ priceDate: "desc" }, { fetchedAt: "desc" }],
        });

        // Piyasa kapalıyken ve veri taze ise atla
        if (
          !force &&
          latest &&
          !isStale(latest.fetchedAt, marketOpen ? 1 : 24)
        ) {
          continue;
        }

        if (asset.assetType === "MUTUAL_FUND") {
          const code = asset.tefasCode ?? asset.symbol;
          try {
            const quote = await fundProvider.getFundQuote(code);
            const priceDate = marketDateOnly(quote.priceDate);
            await prisma.assetPrice.upsert({
              where: {
                assetId_priceDate_source: {
                  assetId: asset.id,
                  priceDate,
                  source: quote.source,
                },
              },
              create: {
                assetId: asset.id,
                priceDate,
                close: new Prisma.Decimal(quote.price),
                previousClose: quote.previousPrice
                  ? new Prisma.Decimal(quote.previousPrice)
                  : null,
                currency: asset.currency,
                source: quote.source,
                dataQuality: quote.dataQuality,
                isDelayed: true,
                fetchedAt: quote.fetchedAt,
              },
              update: {
                close: new Prisma.Decimal(quote.price),
                previousClose: quote.previousPrice
                  ? new Prisma.Decimal(quote.previousPrice)
                  : null,
                dataQuality: quote.dataQuality,
                fetchedAt: quote.fetchedAt,
              },
            });
            processed += 1;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "TEFAS hatası";
            errors.push(`${asset.symbol}: ${msg}`);
            // Son başarılı fiyatı koru — sadece log
          }
          continue;
        }

        if (
          asset.assetType === "STOCK" ||
          asset.assetType === "ETF" ||
          asset.assetType === "GOLD" ||
          asset.assetType === "FX"
        ) {
          if (!stockProvider.isConfigured()) {
            // Demo mod — mevcut fiyatları bozma
            continue;
          }

          // Piyasa kapalıysa gereksiz sorgu yapma (force değilse)
          if (!force && !marketOpen && latest && !isStale(latest.fetchedAt, 48)) {
            continue;
          }

          // providerSymbol zaten hazır (ör. AAPL, THYAO.IS, USD/TRY) → dönüşümü atla
          const quote =
            asset.providerSymbol && stockProvider.getQuoteByProviderSymbol
              ? await stockProvider.getQuoteByProviderSymbol(asset.providerSymbol)
              : await stockProvider.getQuote(asset.symbol);
          const priceDate = marketDateOnly(quote.asOf);

          await prisma.assetPrice.upsert({
            where: {
              assetId_priceDate_source: {
                assetId: asset.id,
                priceDate,
                source: quote.source,
              },
            },
            create: {
              assetId: asset.id,
              priceDate,
              open: quote.open ? new Prisma.Decimal(quote.open) : null,
              high: quote.high ? new Prisma.Decimal(quote.high) : null,
              low: quote.low ? new Prisma.Decimal(quote.low) : null,
              close: new Prisma.Decimal(quote.price),
              previousClose: quote.previousClose
                ? new Prisma.Decimal(quote.previousClose)
                : null,
              volume: quote.volume ? new Prisma.Decimal(quote.volume) : null,
              currency: quote.currency || asset.currency,
              source: quote.source,
              dataQuality: quote.dataQuality,
              isDelayed: quote.isDelayed,
              fetchedAt: quote.fetchedAt,
            },
            update: {
              open: quote.open ? new Prisma.Decimal(quote.open) : null,
              high: quote.high ? new Prisma.Decimal(quote.high) : null,
              low: quote.low ? new Prisma.Decimal(quote.low) : null,
              close: new Prisma.Decimal(quote.price),
              previousClose: quote.previousClose
                ? new Prisma.Decimal(quote.previousClose)
                : null,
              volume: quote.volume ? new Prisma.Decimal(quote.volume) : null,
              dataQuality: quote.dataQuality,
              isDelayed: quote.isDelayed,
              fetchedAt: quote.fetchedAt,
            },
          });
          processed += 1;
        }
      } catch (err) {
        errors.push(
          `${asset.symbol}: ${err instanceof Error ? err.message : "bilinmeyen hata"}`
        );
      }
    }

    // Benchmark FX / altın / BIST
    await syncBenchmarks(force).catch((err: unknown) => {
      errors.push(
        `benchmark: ${err instanceof Error ? err.message : "hata"}`
      );
    });

    const status =
      errors.length === 0
        ? "SUCCESS"
        : processed > 0
          ? "PARTIAL"
          : "FAILED";

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        completedAt: new Date(),
        status,
        recordsProcessed: processed,
        errorMessage: errors.length ? errors.slice(0, 20).join("; ") : null,
        metadata: { marketOpen, errorCount: errors.length },
      },
    });

    return { processed, errors, status };
  } catch (err) {
    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        completedAt: new Date(),
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Sync failed",
      },
    });
    throw err;
  }
}

async function syncBenchmarks(force: boolean): Promise<number> {
  let count = 0;
  const fx = getFxProvider();
  const benchmarks = await prisma.benchmark.findMany({
    where: { isActive: true },
  });

  for (const bench of benchmarks) {
    if (bench.benchmarkType === "FX" && fx.isConfigured()) {
      const pair =
        bench.symbol === "EURTRY" ? "EURTRY" : ("USDTRY" as const);
      try {
        const quote = await fx.getRate(pair);
        await prisma.benchmarkPrice.upsert({
          where: {
            benchmarkId_priceDate_source: {
              benchmarkId: bench.id,
              priceDate: marketDateOnly(quote.asOf),
              source: quote.source,
            },
          },
          create: {
            benchmarkId: bench.id,
            priceDate: marketDateOnly(quote.asOf),
            value: new Prisma.Decimal(quote.rate),
            source: quote.source,
          },
          update: {
            value: new Prisma.Decimal(quote.rate),
            fetchedAt: new Date(),
          },
        });
        count += 1;
      } catch {
        // son değeri koru
      }
    } else if (bench.benchmarkType === "INDEX" && !force) {
      // Twelve Data ile opsiyonel
      const stock = getStockProvider();
      if (!stock.isConfigured()) continue;
      try {
        const quote = await stock.getQuote(bench.symbol);
        await prisma.benchmarkPrice.upsert({
          where: {
            benchmarkId_priceDate_source: {
              benchmarkId: bench.id,
              priceDate: marketDateOnly(quote.asOf),
              source: quote.source,
            },
          },
          create: {
            benchmarkId: bench.id,
            priceDate: marketDateOnly(quote.asOf),
            value: new Prisma.Decimal(quote.price),
            source: quote.source,
          },
          update: {
            value: new Prisma.Decimal(quote.price),
            fetchedAt: new Date(),
          },
        });
        count += 1;
      } catch {
        // ignore
      }
    }
  }
  return count;
}

export async function syncInflationData(): Promise<{
  count: number;
  source: string;
}> {
  const provider = getInflationProvider();
  const { Prisma } = await import("@prisma/client");
  const { OFFICIAL_TUFE_SERIES } = await import("@/lib/data/tufe-official");

  let rows: Array<{
    period: string;
    indexValue: string;
    monthlyRate: string | null;
    annualRate: string | null;
  }> = [];
  let source = provider.name;

  if (provider.isConfigured()) {
    try {
      rows = await provider.fetchLatest();
    } catch {
      // EVDS başarısızsa resmi fallback
      rows = [];
    }
  }

  if (rows.length === 0) {
    source = "tufe_official";
    rows = OFFICIAL_TUFE_SERIES.map((r) => ({
      period: r.period,
      indexValue: String(r.indexValue),
      monthlyRate: String(r.monthlyRate),
      annualRate: String(r.annualRate),
    }));
  }

  let count = 0;
  for (const row of rows) {
    await prisma.inflationIndex.upsert({
      where: {
        countryCode_indexType_period: {
          countryCode: "TR",
          indexType: "TUFE",
          period: row.period,
        },
      },
      create: {
        countryCode: "TR",
        indexType: "TUFE",
        period: row.period,
        indexValue: new Prisma.Decimal(row.indexValue),
        monthlyRate: row.monthlyRate
          ? new Prisma.Decimal(row.monthlyRate)
          : null,
        annualRate: row.annualRate
          ? new Prisma.Decimal(row.annualRate)
          : null,
        source,
      },
      update: {
        indexValue: new Prisma.Decimal(row.indexValue),
        monthlyRate: row.monthlyRate
          ? new Prisma.Decimal(row.monthlyRate)
          : null,
        annualRate: row.annualRate
          ? new Prisma.Decimal(row.annualRate)
          : null,
        source,
        fetchedAt: new Date(),
      },
    });
    count += 1;
  }
  return { count, source };
}
