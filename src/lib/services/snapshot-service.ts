import { prisma } from "@/lib/db/prisma";
import {
  computeCashBalance,
  getPortfolioPositions,
} from "./position-engine";
import { d, Decimal } from "@/lib/calculations/decimal";
import {
  dailyReturnFromFactor,
  dailyTwrFactor,
} from "@/lib/calculations/returns";
import {
  calculateRealReturn,
  type InflationPoint,
} from "@/lib/calculations/inflation";
import { startOfDay } from "@/lib/utils/dates";
import { Prisma } from "@prisma/client";
import type { Transaction } from "@prisma/client";

function dec(value: Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(8));
}

async function getLatestPriceMap(
  assetIds: string[],
  asOf: Date
): Promise<Map<string, { price: Decimal; fetchedAt: Date; quality: string }>> {
  const map = new Map<string, { price: Decimal; fetchedAt: Date; quality: string }>();
  if (assetIds.length === 0) return map;

  const prices = await prisma.assetPrice.findMany({
    where: {
      assetId: { in: assetIds },
      priceDate: { lte: asOf },
    },
    orderBy: [{ priceDate: "desc" }, { fetchedAt: "desc" }],
  });

  for (const p of prices) {
    if (map.has(p.assetId)) continue;
    map.set(p.assetId, {
      price: d(p.close.toString()),
      fetchedAt: p.fetchedAt,
      quality: p.dataQuality,
    });
  }
  return map;
}

/**
 * Belirtilen tarihe kadarki toplam dış katkı (yatırılan para):
 *   açık nakit giriş/çıkışları + (nakit negatife düştüyse) varlık alımlarını
 *   fonlamak için dışarıdan getirilen tutar (shortfall).
 *
 * Böylece kullanıcı ayrı "nakit yatırma" işlemi girmeden yalnızca alış
 * kaydetse bile yatırdığı para doğru hesaplanır ve nakit negatife düşmez.
 */
function netContribAsOf(allTx: Transaction[], upTo: Date): Decimal {
  const upToDay = startOfDay(upTo).getTime();
  const filtered = allTx.filter(
    (t) => startOfDay(t.transactionDate).getTime() <= upToDay
  );

  let explicit = d(0);
  for (const tx of filtered) {
    if (tx.assetId) continue;
    const amount = d(tx.grossAmount.toString()).times(
      d(tx.fxRateToBase.toString())
    );
    if (
      tx.transactionType === "CASH_DEPOSIT" ||
      tx.transactionType === "TRANSFER_IN"
    ) {
      explicit = explicit.plus(amount);
    } else if (
      tx.transactionType === "CASH_WITHDRAWAL" ||
      tx.transactionType === "TRANSFER_OUT"
    ) {
      explicit = explicit.minus(amount);
    }
  }

  const cash = computeCashBalance(filtered);
  const shortfall = cash.isNegative() ? cash.neg() : d(0);
  return explicit.plus(shortfall);
}

async function loadInflationSeries(): Promise<InflationPoint[]> {
  const rows = await prisma.inflationIndex.findMany({
    where: { countryCode: "TR", indexType: "TUFE" },
    orderBy: { period: "asc" },
  });
  return rows.map((r) => ({
    period: r.period,
    indexValue: r.indexValue.toString(),
    monthlyRate: r.monthlyRate?.toString() ?? null,
  }));
}

async function getFxRate(symbol: string, asOf: Date): Promise<Decimal | null> {
  const bench = await prisma.benchmark.findFirst({
    where: { symbol, isActive: true },
  });
  if (!bench) return null;
  const price = await prisma.benchmarkPrice.findFirst({
    where: { benchmarkId: bench.id, priceDate: { lte: asOf } },
    orderBy: { priceDate: "desc" },
  });
  return price ? d(price.value.toString()) : null;
}

/**
 * Idempotent günlük snapshot oluşturur / günceller.
 */
export async function createDailySnapshot(
  portfolioId: string,
  snapshotDate: Date = new Date()
): Promise<{ portfolioSnapshotId: string }> {
  const asOf = startOfDay(snapshotDate);

  const allTx = await prisma.transaction.findMany({
    where: { portfolioId, transactionDate: { lte: asOf } },
  });

  const positions = await getPortfolioPositions(portfolioId, asOf);
  const assetIds = positions.byAsset.map((p) => p.assetId);
  const priceMap = await getLatestPriceMap(assetIds, asOf);

  let investedMarketValue = d(0);
  const positionRows: Array<{
    assetId: string;
    quantity: Decimal;
    averageCost: Decimal;
    marketPrice: Decimal;
    marketValue: Decimal;
    unrealized: Decimal;
    totalReturn: Decimal | null;
    weight: Decimal;
  }> = [];

  for (const pos of positions.byAsset) {
    const px = priceMap.get(pos.assetId);
    const marketPrice = px?.price ?? pos.averageCost;
    const marketValue = pos.quantity.times(marketPrice);
    const unrealized = marketValue.minus(pos.totalCost);
    const totalReturn = pos.totalCost.isZero()
      ? null
      : unrealized.plus(pos.realizedGain).div(pos.totalCost);

    investedMarketValue = investedMarketValue.plus(marketValue);
    positionRows.push({
      assetId: pos.assetId,
      quantity: pos.quantity,
      averageCost: pos.averageCost,
      marketPrice,
      marketValue,
      unrealized,
      totalReturn,
      weight: d(0),
    });
  }

  const rawCash = computeCashBalance(allTx);
  // Nakit negatifse (kullanıcı nakit yatırmadan varlık aldıysa) bu tutar
  // aslında dışarıdan getirilen katkıdır: nakiti sıfırda tabanla, eksiği
  // netContributions'a ekle. Böylece toplam değer = varlıklar + nakit.
  const cashValue = rawCash.isNegative() ? d(0) : rawCash;
  const totalMarketValue = investedMarketValue.plus(cashValue);
  const netContributions = netContribAsOf(allTx, asOf);

  for (const row of positionRows) {
    row.weight = totalMarketValue.isZero()
      ? d(0)
      : row.marketValue.div(totalMarketValue);
  }

  const previous = await prisma.portfolioDailySnapshot.findFirst({
    where: {
      portfolioId,
      snapshotDate: { lt: asOf },
    },
    orderBy: { snapshotDate: "desc" },
  });

  const beginValue = previous
    ? d(previous.totalMarketValue.toString())
    : d(0);

  // Günlük dış akış = kümülatif katkının bir önceki güne göre değişimi
  // (açık nakit hareketleri + o gün alımları fonlamak için gelen para).
  const externalCashFlow = previous
    ? netContributions.minus(netContribAsOf(allTx, previous.snapshotDate))
    : netContributions;

  const factor = dailyTwrFactor(beginValue, totalMarketValue, externalCashFlow);
  const dailyReturn = dailyReturnFromFactor(factor);
  const dailyProfitLoss = previous
    ? totalMarketValue.minus(beginValue).minus(externalCashFlow)
    : d(0);

  const prevTwr = previous?.twrCumulative
    ? d(previous.twrCumulative.toString())
    : d(0);
  const twrCumulative =
    factor === null
      ? previous?.twrCumulative
        ? d(previous.twrCumulative.toString())
        : null
      : d(1).plus(prevTwr).times(factor).minus(1);

  const cumulativeProfitLoss = totalMarketValue.minus(netContributions);
  const cumulativeReturn = netContributions.isZero()
    ? null
    : cumulativeProfitLoss.div(netContributions);

  // Reel getiri
  // Reel getiri için tarihli katkı akışları: her işlem gününde kümülatif
  // katkının (açık nakit + alım fonlaması) değişimini alırız.
  const txDayTimes = [
    ...new Set(allTx.map((t) => startOfDay(t.transactionDate).getTime())),
  ].sort((a, b) => a - b);
  let prevCumContrib = d(0);
  const cashFlows: Array<{ date: Date; amount: Decimal }> = [];
  for (const time of txDayTimes) {
    const dte = new Date(time);
    const cum = netContribAsOf(allTx, dte);
    const delta = cum.minus(prevCumContrib);
    if (!delta.isZero()) cashFlows.push({ date: dte, amount: delta });
    prevCumContrib = cum;
  }

  const inflationSeries = await loadInflationSeries();
  const real = calculateRealReturn({
    currentValue: totalMarketValue,
    cashFlows,
    inflationSeries,
    asOf,
  });

  const usdRate = await getFxRate("USDTRY", asOf);
  const eurRate = await getFxRate("EURTRY", asOf);

  // Önceki pozisyon snapshot'ları ile günlük katkı
  const prevPositions = previous
    ? await prisma.positionDailySnapshot.findMany({
        where: {
          portfolioId,
          snapshotDate: previous.snapshotDate,
          accountId: "",
        },
      })
    : [];
  const prevPosMap = new Map(
    prevPositions.map((p) => [p.assetId, p])
  );

  const portfolioSnapshot = await prisma.portfolioDailySnapshot.upsert({
    where: {
      portfolioId_snapshotDate: { portfolioId, snapshotDate: asOf },
    },
    create: {
      portfolioId,
      snapshotDate: asOf,
      totalMarketValue: dec(totalMarketValue),
      cashValue: dec(cashValue),
      investedCapital: dec(investedMarketValue),
      netContributions: dec(netContributions),
      dailyExternalCashFlow: dec(externalCashFlow),
      dailyProfitLoss: dec(dailyProfitLoss),
      dailyReturn: dailyReturn ? dec(dailyReturn) : null,
      cumulativeProfitLoss: dec(cumulativeProfitLoss),
      cumulativeReturn: cumulativeReturn ? dec(cumulativeReturn) : null,
      twrDailyFactor: factor ? dec(factor) : null,
      twrCumulative: twrCumulative ? dec(twrCumulative) : null,
      inflationAdjustedCapital: dec(real.inflationAdjustedCapital),
      realProfitLoss: dec(real.realProfit),
      realReturn: real.realReturn ? dec(real.realReturn) : null,
      valueInUsd: usdRate && !usdRate.isZero()
        ? dec(totalMarketValue.div(usdRate))
        : null,
      valueInEur: eurRate && !eurRate.isZero()
        ? dec(totalMarketValue.div(eurRate))
        : null,
    },
    update: {
      totalMarketValue: dec(totalMarketValue),
      cashValue: dec(cashValue),
      investedCapital: dec(investedMarketValue),
      netContributions: dec(netContributions),
      dailyExternalCashFlow: dec(externalCashFlow),
      dailyProfitLoss: dec(dailyProfitLoss),
      dailyReturn: dailyReturn ? dec(dailyReturn) : null,
      cumulativeProfitLoss: dec(cumulativeProfitLoss),
      cumulativeReturn: cumulativeReturn ? dec(cumulativeReturn) : null,
      twrDailyFactor: factor ? dec(factor) : null,
      twrCumulative: twrCumulative ? dec(twrCumulative) : null,
      inflationAdjustedCapital: dec(real.inflationAdjustedCapital),
      realProfitLoss: dec(real.realProfit),
      realReturn: real.realReturn ? dec(real.realReturn) : null,
      valueInUsd: usdRate && !usdRate.isZero()
        ? dec(totalMarketValue.div(usdRate))
        : null,
      valueInEur: eurRate && !eurRate.isZero()
        ? dec(totalMarketValue.div(eurRate))
        : null,
    },
  });

  // Position snapshots — accountId null = portföy toplamı
  for (const row of positionRows) {
    const prev = prevPosMap.get(row.assetId);
    const prevValue = prev ? d(prev.marketValue.toString()) : d(0);
    const dailyPl = row.marketValue.minus(prevValue);
    const dailyRet = prevValue.isZero() ? null : dailyPl.div(prevValue);
    const contrib =
      dailyReturn && row.weight
        ? row.weight.times(dailyRet ?? 0)
        : null;

    await prisma.positionDailySnapshot.upsert({
      where: {
        portfolioId_assetId_snapshotDate_accountId: {
          portfolioId,
          assetId: row.assetId,
          snapshotDate: asOf,
          accountId: "",
        },
      },
      create: {
        portfolioId,
        assetId: row.assetId,
        accountId: "",
        snapshotDate: asOf,
        quantity: dec(row.quantity),
        averageCost: dec(row.averageCost),
        marketPrice: dec(row.marketPrice),
        marketValue: dec(row.marketValue),
        dailyProfitLoss: dec(dailyPl),
        dailyReturn: dailyRet ? dec(dailyRet) : null,
        unrealizedProfitLoss: dec(row.unrealized),
        totalReturn: row.totalReturn ? dec(row.totalReturn) : null,
        portfolioWeight: dec(row.weight),
        contributionToDailyReturn: contrib ? dec(contrib) : null,
      },
      update: {
        quantity: dec(row.quantity),
        averageCost: dec(row.averageCost),
        marketPrice: dec(row.marketPrice),
        marketValue: dec(row.marketValue),
        dailyProfitLoss: dec(dailyPl),
        dailyReturn: dailyRet ? dec(dailyRet) : null,
        unrealizedProfitLoss: dec(row.unrealized),
        totalReturn: row.totalReturn ? dec(row.totalReturn) : null,
        portfolioWeight: dec(row.weight),
        contributionToDailyReturn: contrib ? dec(contrib) : null,
      },
    });
  }

  // Eski pozisyonları temizle (artık tutulmayan varlıklar)
  const keepIds = positionRows.map((r) => r.assetId);
  await prisma.positionDailySnapshot.deleteMany({
    where: {
      portfolioId,
      snapshotDate: asOf,
      accountId: "",
      assetId: { notIn: keepIds.length ? keepIds : ["__none__"] },
    },
  });

  return { portfolioSnapshotId: portfolioSnapshot.id };
}

/**
 * Belirli bir tarihten bugüne snapshot'ları yeniden hesaplar.
 */
export async function rebuildSnapshotsFrom(
  portfolioId: string,
  fromDate: Date
): Promise<number> {
  const start = startOfDay(fromDate);
  const today = startOfDay(new Date());

  // Önce etkilenen aralığı sil (idempotent yeniden üretim)
  await prisma.positionDailySnapshot.deleteMany({
    where: { portfolioId, snapshotDate: { gte: start } },
  });
  await prisma.portfolioDailySnapshot.deleteMany({
    where: { portfolioId, snapshotDate: { gte: start } },
  });

  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= today.getTime()) {
    await createDailySnapshot(portfolioId, new Date(cursor));
    count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
