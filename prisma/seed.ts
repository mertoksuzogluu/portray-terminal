/**
 * DEMO SEED — Yatırım Portföyü
 *
 * Bu script yalnızca demo amaçlı örnek veri üretir.
 * Çalıştırmadan önce DATABASE_URL ortam değişkeninin tanımlı olduğundan emin olun.
 *
 * Demo kullanıcı: demo@yatirim.local / demo1234
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, TransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@yatirim.local";
const DEMO_PASSWORD = "demo1234";
const DEMO_MARKER = "[DEMO]";

const MONTHS_BACK = 7;
const SOURCE_DEMO = "demo-seed";

function dec(value: number | string): Decimal {
  return new Decimal(value);
}

function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function pseudoNoise(seed: number, amplitude = 0.01): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amplitude;
}

function pricePath(base: number, dayIndex: number, drift = 0.0002, vol = 0.012): number {
  const trend = base * (1 + drift * dayIndex);
  const noise = trend * pseudoNoise(dayIndex, vol);
  return Math.max(base * 0.85, trend + noise);
}

const ASSET_DEFS = [
  {
    symbol: "PBR",
    name: "Parafon Portföy Para Piyasası Fonu",
    assetType: "MUTUAL_FUND" as const,
    tefasCode: "PBR",
    exchange: "TEFAS",
    basePrice: 2.18,
    provider: "tefas",
  },
  {
    symbol: "THYAO",
    name: "Türk Hava Yolları A.Ş.",
    assetType: "STOCK" as const,
    exchange: "BIST",
    basePrice: 298,
    providerSymbol: "THYAO:IST",
    provider: "twelve-data",
  },
  {
    symbol: "TUPRS",
    name: "Tüpraş Türkiye Petrol Rafinerileri A.Ş.",
    assetType: "STOCK" as const,
    exchange: "BIST",
    basePrice: 168,
    providerSymbol: "TUPRS:IST",
    provider: "twelve-data",
  },
  {
    symbol: "USDTRY",
    name: "ABD Doları / Türk Lirası",
    assetType: "FX" as const,
    basePrice: 35.4,
    providerSymbol: "USD/TRY",
    provider: "twelve-data",
  },
  {
    symbol: "GRAMALTIN",
    name: "Gram Altın (TRY)",
    assetType: "GOLD" as const,
    basePrice: 2985,
    providerSymbol: "XAU/TRY",
    provider: "twelve-data",
  },
];

const BENCHMARK_DEFS = [
  { symbol: "XU100", name: "BIST 100", benchmarkType: "INDEX" as const, baseValue: 9800 },
  { symbol: "USDTRY", name: "USD/TRY", benchmarkType: "FX" as const, baseValue: 35.4 },
  { symbol: "EURTRY", name: "EUR/TRY", benchmarkType: "FX" as const, baseValue: 38.6 },
  { symbol: "GRAMALTIN", name: "Gram Altın", benchmarkType: "COMMODITY" as const, baseValue: 2985 },
  { symbol: "TUFE", name: "TÜFE (Yİ-ÜFE)", benchmarkType: "INFLATION" as const, baseValue: 2650 },
];

/** Aylık TÜFE endeks değerleri (2025-12 → 2026-06 demo dönemi) */
const TUFE_SERIES: Array<{ period: string; indexValue: number; monthlyRate: number }> = [
  { period: "2025-12", indexValue: 2580.45, monthlyRate: 0.0241 },
  { period: "2026-01", indexValue: 2642.18, monthlyRate: 0.0239 },
  { period: "2026-02", indexValue: 2705.92, monthlyRate: 0.0241 },
  { period: "2026-03", indexValue: 2771.34, monthlyRate: 0.0242 },
  { period: "2026-04", indexValue: 2838.77, monthlyRate: 0.0243 },
  { period: "2026-05", indexValue: 2907.55, monthlyRate: 0.0242 },
  { period: "2026-06", indexValue: 2978.12, monthlyRate: 0.0243 },
];

async function clearDemoUser(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
    console.log(`${DEMO_MARKER} Eski demo kullanıcı verisi temizlendi.`);
  }
}

async function upsertAssets(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const asset of ASSET_DEFS) {
    const row = await prisma.asset.upsert({
      where: { symbol_assetType: { symbol: asset.symbol, assetType: asset.assetType } },
      create: {
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        exchange: asset.exchange ?? null,
        currency: "TRY",
        tefasCode: "tefasCode" in asset ? asset.tefasCode : null,
        providerSymbol: "providerSymbol" in asset ? asset.providerSymbol : null,
        provider: asset.provider,
        isActive: true,
      },
      update: {
        name: asset.name,
        tefasCode: "tefasCode" in asset ? asset.tefasCode : null,
        providerSymbol: "providerSymbol" in asset ? asset.providerSymbol : null,
        isActive: true,
      },
    });
    map[asset.symbol] = row.id;
  }
  return map;
}

async function upsertBenchmarks(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const bench of BENCHMARK_DEFS) {
    const row = await prisma.benchmark.upsert({
      where: { symbol: bench.symbol },
      create: {
        symbol: bench.symbol,
        name: bench.name,
        benchmarkType: bench.benchmarkType,
        currency: "TRY",
        provider: SOURCE_DEMO,
        isActive: true,
      },
      update: { name: bench.name, isActive: true },
    });
    map[bench.symbol] = row.id;
  }
  return map;
}

async function seedDemoUser(): Promise<{
  userId: string;
  portfolioId: string;
  accountId: string;
}> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo Yatırımcı",
      passwordHash,
      isDemo: true,
      role: "ADMIN",
      riskProfile: "BALANCED",
      baseCurrency: "TRY",
      timezone: "Europe/Istanbul",
      riskFreeRateAnnual: dec(0.45),
      portfolios: {
        create: {
          name: "Ana Portföy",
          baseCurrency: "TRY",
          isDefault: true,
          accounts: {
            create: {
              name: "Midas",
              institution: "Midas Menkul Değerler",
              accountType: "BROKERAGE",
              currency: "TRY",
            },
          },
        },
      },
    },
    include: {
      portfolios: { include: { accounts: true } },
    },
  });

  const portfolio = user.portfolios[0];
  const account = portfolio.accounts[0];
  return { userId: user.id, portfolioId: portfolio.id, accountId: account.id };
}

interface TxSeed {
  date: Date;
  type: TransactionType;
  assetSymbol?: string;
  quantity: number;
  unitPrice: number;
  commission?: number;
  notes?: string;
}

async function seedTransactions(
  portfolioId: string,
  accountId: string,
  assetIds: Record<string, string>,
  startDate: Date
): Promise<void> {
  const txs: TxSeed[] = [
    { date: addDays(startDate, 2), type: "CASH_DEPOSIT", quantity: 1, unitPrice: 150000, notes: `${DEMO_MARKER} İlk para yatırma` },
    { date: addDays(startDate, 5), type: "BUY", assetSymbol: "PBR", quantity: 8000, unitPrice: 2.12, commission: 0 },
    { date: addDays(startDate, 7), type: "BUY", assetSymbol: "THYAO", quantity: 80, unitPrice: 286.5, commission: 12.5 },
    { date: addDays(startDate, 10), type: "BUY", assetSymbol: "TUPRS", quantity: 120, unitPrice: 162.4, commission: 15 },
    { date: addDays(startDate, 35), type: "CASH_DEPOSIT", quantity: 1, unitPrice: 50000, notes: `${DEMO_MARKER} Ek sermaye` },
    { date: addDays(startDate, 38), type: "BUY", assetSymbol: "THYAO", quantity: 40, unitPrice: 302.1, commission: 8 },
    { date: addDays(startDate, 45), type: "DIVIDEND", assetSymbol: "THYAO", quantity: 120, unitPrice: 4.25, notes: `${DEMO_MARKER} Temettü` },
    { date: addDays(startDate, 70), type: "SELL", assetSymbol: "TUPRS", quantity: 40, unitPrice: 171.8, commission: 10 },
    { date: addDays(startDate, 95), type: "BUY", assetSymbol: "PBR", quantity: 5000, unitPrice: 2.24, commission: 0 },
    { date: addDays(startDate, 120), type: "BUY", assetSymbol: "TUPRS", quantity: 50, unitPrice: 175.2, commission: 6 },
    { date: addDays(startDate, 145), type: "DIVIDEND", assetSymbol: "THYAO", quantity: 120, unitPrice: 3.9 },
    { date: addDays(startDate, 160), type: "SELL", assetSymbol: "THYAO", quantity: 30, unitPrice: 315.4, commission: 9 },
    { date: addDays(startDate, 175), type: "COMMISSION", quantity: 1, unitPrice: 25, notes: `${DEMO_MARKER} Platform ücreti` },
  ];

  for (const tx of txs) {
    const assetId = tx.assetSymbol ? assetIds[tx.assetSymbol] : null;
    const gross =
      tx.type === "CASH_DEPOSIT" || tx.type === "CASH_WITHDRAWAL" || tx.type === "COMMISSION"
        ? tx.unitPrice
        : tx.quantity * tx.unitPrice;

    await prisma.transaction.create({
      data: {
        portfolioId,
        accountId,
        assetId,
        transactionType: tx.type,
        transactionDate: tx.date,
        quantity: dec(tx.quantity),
        unitPrice: dec(tx.unitPrice),
        grossAmount: dec(gross),
        commission: dec(tx.commission ?? 0),
        currency: "TRY",
        notes: tx.notes ?? null,
        importHash: `${DEMO_MARKER}-${tx.date.toISOString()}-${tx.type}-${tx.assetSymbol ?? "cash"}`,
      },
    });
  }
}

async function seedAssetPrices(
  assetIds: Record<string, string>,
  days: Date[]
): Promise<void> {
  for (const asset of ASSET_DEFS) {
    const assetId = assetIds[asset.symbol];
    for (let i = 0; i < days.length; i++) {
      const close = pricePath(asset.basePrice, i, 0.00015, 0.008);
      const open = close * (1 + pseudoNoise(i + 1, 0.003));
      const high = Math.max(open, close) * (1 + Math.abs(pseudoNoise(i + 2, 0.004)));
      const low = Math.min(open, close) * (1 - Math.abs(pseudoNoise(i + 3, 0.004)));
      const prev = i > 0 ? pricePath(asset.basePrice, i - 1, 0.00015, 0.008) : close;

      await prisma.assetPrice.upsert({
        where: {
          assetId_priceDate_source: {
            assetId,
            priceDate: days[i],
            source: SOURCE_DEMO,
          },
        },
        create: {
          assetId,
          priceDate: days[i],
          open: dec(open.toFixed(4)),
          high: dec(high.toFixed(4)),
          low: dec(low.toFixed(4)),
          close: dec(close.toFixed(4)),
          previousClose: dec(prev.toFixed(4)),
          currency: "TRY",
          source: SOURCE_DEMO,
          dataQuality: "MANUAL",
          isDelayed: false,
        },
        update: {
          open: dec(open.toFixed(4)),
          high: dec(high.toFixed(4)),
          low: dec(low.toFixed(4)),
          close: dec(close.toFixed(4)),
          previousClose: dec(prev.toFixed(4)),
        },
      });
    }
  }
}

async function seedBenchmarkPrices(
  benchmarkIds: Record<string, string>,
  days: Date[]
): Promise<void> {
  for (const bench of BENCHMARK_DEFS) {
    if (bench.symbol === "TUFE") continue;
    const benchmarkId = benchmarkIds[bench.symbol];
    for (let i = 0; i < days.length; i++) {
      const value = pricePath(bench.baseValue, i, 0.00012, 0.006);
      await prisma.benchmarkPrice.upsert({
        where: {
          benchmarkId_priceDate_source: {
            benchmarkId,
            priceDate: days[i],
            source: SOURCE_DEMO,
          },
        },
        create: {
          benchmarkId,
          priceDate: days[i],
          value: dec(value.toFixed(4)),
          source: SOURCE_DEMO,
        },
        update: { value: dec(value.toFixed(4)) },
      });
    }
  }
}

async function seedInflation(): Promise<void> {
  for (const row of TUFE_SERIES) {
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
        indexValue: dec(row.indexValue),
        monthlyRate: dec(row.monthlyRate),
        source: SOURCE_DEMO,
      },
      update: {
        indexValue: dec(row.indexValue),
        monthlyRate: dec(row.monthlyRate),
      },
    });
  }
}

interface PositionState {
  quantity: number;
  avgCost: number;
  totalCost: number;
}

function applyTxToPosition(pos: PositionState, tx: TxSeed): PositionState {
  if (tx.type === "BUY") {
    const cost = tx.quantity * tx.unitPrice + (tx.commission ?? 0);
    const newQty = pos.quantity + tx.quantity;
    const newCost = pos.totalCost + cost;
    return { quantity: newQty, totalCost: newCost, avgCost: newQty > 0 ? newCost / newQty : 0 };
  }
  if (tx.type === "SELL") {
    const newQty = pos.quantity - tx.quantity;
    const newCost = pos.avgCost * newQty;
    return { quantity: newQty, totalCost: newCost, avgCost: newQty > 0 ? pos.avgCost : 0 };
  }
  return pos;
}

async function seedSnapshots(
  portfolioId: string,
  assetIds: Record<string, string>,
  days: Date[],
  txs: TxSeed[]
): Promise<void> {
  const positions: Record<string, PositionState> = {};
  for (const sym of ["PBR", "THYAO", "TUPRS"]) {
    positions[sym] = { quantity: 0, avgCost: 0, totalCost: 0 };
  }

  let cash = 0;
  let netContributions = 0;
  let prevTotal = 0;
  let twrCumulative = 0;
  let txIndex = 0;

  const priceCache: Record<string, number[]> = {};
  for (const asset of ASSET_DEFS) {
    priceCache[asset.symbol] = days.map((_, i) =>
      pricePath(asset.basePrice, i, 0.00015, 0.008)
    );
  }

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const day = days[dayIdx];
    let externalCashFlow = 0;

    while (txIndex < txs.length && txs[txIndex].date.getTime() <= day.getTime()) {
      const tx = txs[txIndex];
      if (tx.type === "CASH_DEPOSIT") {
        cash += tx.unitPrice;
        netContributions += tx.unitPrice;
        externalCashFlow += tx.unitPrice;
      } else if (tx.type === "CASH_WITHDRAWAL") {
        cash -= tx.unitPrice;
        netContributions -= tx.unitPrice;
        externalCashFlow -= tx.unitPrice;
      } else if (tx.type === "COMMISSION") {
        cash -= tx.unitPrice;
      } else if (tx.type === "DIVIDEND" && tx.assetSymbol) {
        cash += tx.quantity * tx.unitPrice;
      } else if (tx.type === "BUY" && tx.assetSymbol) {
        const cost = tx.quantity * tx.unitPrice + (tx.commission ?? 0);
        cash -= cost;
        positions[tx.assetSymbol] = applyTxToPosition(positions[tx.assetSymbol], tx);
      } else if (tx.type === "SELL" && tx.assetSymbol) {
        const proceeds = tx.quantity * tx.unitPrice - (tx.commission ?? 0);
        cash += proceeds;
        positions[tx.assetSymbol] = applyTxToPosition(positions[tx.assetSymbol], tx);
      }
      txIndex += 1;
    }

    let investedValue = 0;
    const positionRows: Array<{
      symbol: string;
      quantity: number;
      avgCost: number;
      marketPrice: number;
      marketValue: number;
    }> = [];

    for (const sym of ["PBR", "THYAO", "TUPRS"]) {
      const pos = positions[sym];
      const marketPrice = priceCache[sym][dayIdx];
      const marketValue = pos.quantity * marketPrice;
      investedValue += marketValue;
      if (pos.quantity > 0) {
        positionRows.push({
          symbol: sym,
          quantity: pos.quantity,
          avgCost: pos.avgCost,
          marketPrice,
          marketValue,
        });
      }
    }

    const totalMarketValue = investedValue + cash;
    const beginValue = prevTotal;
    const denominator = beginValue + externalCashFlow;
    const twrFactor = denominator > 0 ? totalMarketValue / denominator : null;
    const dailyReturn = twrFactor !== null ? twrFactor - 1 : null;
    if (twrFactor !== null) {
      twrCumulative = (1 + twrCumulative) * twrFactor - 1;
    }

    const dailyPl = beginValue > 0 ? totalMarketValue - beginValue - externalCashFlow : 0;
    const cumulativePl = totalMarketValue - netContributions;
    const cumulativeReturn = netContributions > 0 ? cumulativePl / netContributions : null;

    const inflationFactor =
      TUFE_SERIES[TUFE_SERIES.length - 1].indexValue / TUFE_SERIES[0].indexValue;
    const inflationAdjustedCapital = netContributions * inflationFactor;
    const realProfit = totalMarketValue - inflationAdjustedCapital;
    const realReturn = inflationAdjustedCapital > 0 ? realProfit / inflationAdjustedCapital : null;

    await prisma.portfolioDailySnapshot.upsert({
      where: {
        portfolioId_snapshotDate: { portfolioId, snapshotDate: day },
      },
      create: {
        portfolioId,
        snapshotDate: day,
        totalMarketValue: dec(totalMarketValue.toFixed(2)),
        cashValue: dec(cash.toFixed(2)),
        investedCapital: dec(investedValue.toFixed(2)),
        netContributions: dec(netContributions.toFixed(2)),
        dailyExternalCashFlow: dec(externalCashFlow.toFixed(2)),
        dailyProfitLoss: dec(dailyPl.toFixed(2)),
        dailyReturn: dailyReturn !== null ? dec(dailyReturn.toFixed(8)) : null,
        cumulativeProfitLoss: dec(cumulativePl.toFixed(2)),
        cumulativeReturn: cumulativeReturn !== null ? dec(cumulativeReturn.toFixed(8)) : null,
        twrDailyFactor: twrFactor !== null ? dec(twrFactor.toFixed(8)) : null,
        twrCumulative: dec(twrCumulative.toFixed(8)),
        inflationAdjustedCapital: dec(inflationAdjustedCapital.toFixed(2)),
        realProfitLoss: dec(realProfit.toFixed(2)),
        realReturn: realReturn !== null ? dec(realReturn.toFixed(8)) : null,
      },
      update: {
        totalMarketValue: dec(totalMarketValue.toFixed(2)),
        cashValue: dec(cash.toFixed(2)),
        investedCapital: dec(investedValue.toFixed(2)),
        netContributions: dec(netContributions.toFixed(2)),
        dailyExternalCashFlow: dec(externalCashFlow.toFixed(2)),
        dailyProfitLoss: dec(dailyPl.toFixed(2)),
        dailyReturn: dailyReturn !== null ? dec(dailyReturn.toFixed(8)) : null,
        cumulativeProfitLoss: dec(cumulativePl.toFixed(2)),
        cumulativeReturn: cumulativeReturn !== null ? dec(cumulativeReturn.toFixed(8)) : null,
        twrDailyFactor: twrFactor !== null ? dec(twrFactor.toFixed(8)) : null,
        twrCumulative: dec(twrCumulative.toFixed(8)),
        inflationAdjustedCapital: dec(inflationAdjustedCapital.toFixed(2)),
        realProfitLoss: dec(realProfit.toFixed(2)),
        realReturn: realReturn !== null ? dec(realReturn.toFixed(8)) : null,
      },
    });

    for (const row of positionRows) {
      const assetId = assetIds[row.symbol];
      const weight = totalMarketValue > 0 ? row.marketValue / totalMarketValue : 0;
      const unrealized = row.marketValue - row.quantity * row.avgCost;
      const totalReturn = row.quantity * row.avgCost > 0 ? unrealized / (row.quantity * row.avgCost) : null;

      await prisma.positionDailySnapshot.upsert({
        where: {
          portfolioId_assetId_snapshotDate_accountId: {
            portfolioId,
            assetId,
            snapshotDate: day,
            accountId: "",
          },
        },
        create: {
          portfolioId,
          assetId,
          accountId: "",
          snapshotDate: day,
          quantity: dec(row.quantity),
          averageCost: dec(row.avgCost.toFixed(4)),
          marketPrice: dec(row.marketPrice.toFixed(4)),
          marketValue: dec(row.marketValue.toFixed(2)),
          dailyProfitLoss: dec(0),
          dailyReturn: null,
          unrealizedProfitLoss: dec(unrealized.toFixed(2)),
          totalReturn: totalReturn !== null ? dec(totalReturn.toFixed(8)) : null,
          portfolioWeight: dec(weight.toFixed(8)),
          contributionToDailyReturn:
            dailyReturn !== null ? dec((weight * dailyReturn).toFixed(8)) : null,
        },
        update: {
          quantity: dec(row.quantity),
          averageCost: dec(row.avgCost.toFixed(4)),
          marketPrice: dec(row.marketPrice.toFixed(4)),
          marketValue: dec(row.marketValue.toFixed(2)),
          unrealizedProfitLoss: dec(unrealized.toFixed(2)),
          totalReturn: totalReturn !== null ? dec(totalReturn.toFixed(8)) : null,
          portfolioWeight: dec(weight.toFixed(8)),
          contributionToDailyReturn:
            dailyReturn !== null ? dec((weight * dailyReturn).toFixed(8)) : null,
        },
      });
    }

    prevTotal = totalMarketValue;
  }
}

async function seedAlertRules(
  portfolioId: string,
  assetIds: Record<string, string>
): Promise<void> {
  const rules = [
    {
      name: `${DEMO_MARKER} THYAO günlük düşüş`,
      alertType: "ASSET_DAILY_RETURN" as const,
      assetId: assetIds.THYAO,
      comparisonOperator: "LESS_THAN" as const,
      threshold: dec(-0.03),
      lookbackDays: 1,
    },
    {
      name: `${DEMO_MARKER} Portföy drawdown`,
      alertType: "PORTFOLIO_DRAWDOWN" as const,
      assetId: null,
      comparisonOperator: "GREATER_THAN" as const,
      threshold: dec(0.08),
      lookbackDays: 30,
    },
    {
      name: `${DEMO_MARKER} THYAO ağırlık`,
      alertType: "ASSET_WEIGHT" as const,
      assetId: assetIds.THYAO,
      comparisonOperator: "GREATER_THAN" as const,
      threshold: dec(0.45),
      lookbackDays: null,
    },
    {
      name: `${DEMO_MARKER} Negatif reel aylık getiri`,
      alertType: "MONTHLY_REAL_RETURN_NEGATIVE" as const,
      assetId: null,
      comparisonOperator: "LESS_THAN" as const,
      threshold: dec(0),
      lookbackDays: 30,
    },
  ];

  for (const rule of rules) {
    await prisma.alertRule.create({ data: { portfolioId, ...rule } });
  }
}

async function seedInsights(portfolioId: string, asOf: Date): Promise<void> {
  const insights = [
    {
      category: "PERFORMANCE" as const,
      severity: "POSITIVE" as const,
      title: `${DEMO_MARKER} THYAO güçlü katkı`,
      message:
        "THYAO pozisyonu son 30 günde portföy getirisine anlamlı pozitif katkı sağladı.",
      fingerprint: "demo-thyao-contribution",
    },
    {
      category: "CONCENTRATION" as const,
      severity: "WARNING" as const,
      title: `${DEMO_MARKER} Yoğunlaşma uyarısı`,
      message: "THYAO ağırlığı %40 eşiğini aştı; çeşitlendirme gözden geçirilebilir.",
      fingerprint: "demo-concentration-thyao",
    },
    {
      category: "INFLATION" as const,
      severity: "INFO" as const,
      title: `${DEMO_MARKER} Enflasyon etkisi`,
      message:
        "Nominal getiri pozitif olsa da TÜFE düzeltmesi sonrası reel getiri daha düşük seyrediyor.",
      fingerprint: "demo-inflation-impact",
    },
    {
      category: "BENCHMARK" as const,
      severity: "POSITIVE" as const,
      title: `${DEMO_MARKER} BIST100 üzeri performans`,
      message: "Portföy son dönemde BIST 100 endeksini hafif aşıyor.",
      fingerprint: "demo-benchmark-outperform",
    },
    {
      category: "RISK" as const,
      severity: "INFO" as const,
      title: `${DEMO_MARKER} Volatilite normal`,
      message: "30 günlük volatilite tarihsel ortalamanın altında.",
      fingerprint: "demo-volatility-normal",
    },
  ];

  for (const insight of insights) {
    await prisma.analysisInsight.upsert({
      where: {
        portfolioId_fingerprint_insightDate: {
          portfolioId,
          fingerprint: insight.fingerprint,
          insightDate: asOf,
        },
      },
      create: {
        portfolioId,
        insightDate: asOf,
        periodType: "DAILY",
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        message: insight.message,
        fingerprint: insight.fingerprint,
        metadata: { demo: true, marker: DEMO_MARKER },
      },
      update: {
        title: insight.title,
        message: insight.message,
        severity: insight.severity,
      },
    });
  }
}

const DEFAULT_TARGETS: Record<string, Record<string, number>> = {
  CONSERVATIVE: { EQUITY: 0.15, FUND: 0.4, GOLD: 0.15, FX: 0.1, CASH: 0.2 },
  BALANCED: { EQUITY: 0.35, FUND: 0.3, GOLD: 0.15, FX: 0.1, CASH: 0.1 },
  GROWTH: { EQUITY: 0.5, FUND: 0.25, GOLD: 0.1, FX: 0.1, CASH: 0.05 },
  AGGRESSIVE: { EQUITY: 0.7, FUND: 0.15, GOLD: 0.05, FX: 0.05, CASH: 0.05 },
};

async function seedTargetAllocations(): Promise<void> {
  for (const [profile, weights] of Object.entries(DEFAULT_TARGETS)) {
    for (const [assetClass, weight] of Object.entries(weights)) {
      await prisma.targetAllocation.upsert({
        where: {
          riskProfile_assetClass: {
            riskProfile: profile as "BALANCED",
            assetClass: assetClass as "EQUITY",
          },
        },
        create: {
          riskProfile: profile as "BALANCED",
          assetClass: assetClass as "EQUITY",
          weight: dec(weight),
        },
        update: { weight: dec(weight) },
      });
    }
  }
}

async function main(): Promise<void> {
  console.log(`${DEMO_MARKER} Demo seed başlıyor...`);

  const today = dateOnly(2026, 7, 15);
  const startDate = addDays(today, -(MONTHS_BACK * 30));
  const days = eachDay(startDate, today);

  await clearDemoUser();
  await seedTargetAllocations();
  const assetIds = await upsertAssets();
  const benchmarkIds = await upsertBenchmarks();
  const { portfolioId, accountId } = await seedDemoUser();

  const txSeeds: TxSeed[] = [
    { date: addDays(startDate, 2), type: "CASH_DEPOSIT", quantity: 1, unitPrice: 150000 },
    { date: addDays(startDate, 5), type: "BUY", assetSymbol: "PBR", quantity: 8000, unitPrice: 2.12 },
    { date: addDays(startDate, 7), type: "BUY", assetSymbol: "THYAO", quantity: 80, unitPrice: 286.5, commission: 12.5 },
    { date: addDays(startDate, 10), type: "BUY", assetSymbol: "TUPRS", quantity: 120, unitPrice: 162.4, commission: 15 },
    { date: addDays(startDate, 35), type: "CASH_DEPOSIT", quantity: 1, unitPrice: 50000 },
    { date: addDays(startDate, 38), type: "BUY", assetSymbol: "THYAO", quantity: 40, unitPrice: 302.1, commission: 8 },
    { date: addDays(startDate, 45), type: "DIVIDEND", assetSymbol: "THYAO", quantity: 120, unitPrice: 4.25 },
    { date: addDays(startDate, 70), type: "SELL", assetSymbol: "TUPRS", quantity: 40, unitPrice: 171.8, commission: 10 },
    { date: addDays(startDate, 95), type: "BUY", assetSymbol: "PBR", quantity: 5000, unitPrice: 2.24 },
    { date: addDays(startDate, 120), type: "BUY", assetSymbol: "TUPRS", quantity: 50, unitPrice: 175.2, commission: 6 },
    { date: addDays(startDate, 145), type: "DIVIDEND", assetSymbol: "THYAO", quantity: 120, unitPrice: 3.9 },
    { date: addDays(startDate, 160), type: "SELL", assetSymbol: "THYAO", quantity: 30, unitPrice: 315.4, commission: 9 },
    { date: addDays(startDate, 175), type: "COMMISSION", quantity: 1, unitPrice: 25 },
  ];

  await seedTransactions(portfolioId, accountId, assetIds, startDate);
  await seedAssetPrices(assetIds, days);
  await seedBenchmarkPrices(benchmarkIds, days);
  await seedInflation();
  await seedSnapshots(portfolioId, assetIds, days, txSeeds);
  await seedAlertRules(portfolioId, assetIds);
  await seedInsights(portfolioId, today);

  // Öneri motoru demo çıktısı (dinamik import — prisma client generate sonrası)
  try {
    const { runRecommendationEngine } = await import("../src/lib/recommendations/service");
    const reco = await runRecommendationEngine(portfolioId, today);
    console.log(`${DEMO_MARKER} Öneri motoru: ${reco.created} öneri (risk skoru ${reco.riskScore.toFixed(1)})`);
  } catch (err) {
    console.warn(`${DEMO_MARKER} Öneri motoru seed atlandı:`, err);
  }

  console.log(`${DEMO_MARKER} Demo seed tamamlandı.`);
  console.log(`  E-posta : ${DEMO_EMAIL}`);
  console.log(`  Şifre   : ${DEMO_PASSWORD}`);
  console.log(`  Gün     : ${days.length} günlük fiyat & snapshot`);
  console.log(`  İşlem   : ${txSeeds.length} adet`);
}

main()
  .catch((err: unknown) => {
    console.error("Seed hatası:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
