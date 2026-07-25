import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import {
  calculateRealReturn,
  findIndexAtPeriod,
} from "@/lib/calculations/inflation";
import {
  adjustPnlByHurdle,
  annualToMonthlyRate,
} from "@/lib/calculations/monthly-hurdle";
import {
  applyProratedMonthlyInflation,
  endOfPeriod,
} from "@/lib/calculations/inflation";
import {
  getPortfolioSnapshots,
  requirePortfolioContext,
} from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { periodRanges, toDateKey } from "@/lib/utils/dates";
import { buildContributionCashFlows } from "@/lib/services/snapshot-service";

type SnapshotRow = Awaited<ReturnType<typeof getPortfolioSnapshots>>[number];

type PeriodKey = "month" | "year" | "total";

interface PeriodBlock {
  key: PeriodKey;
  label: string;
  startDate: string;
  endDate: string;
  startValue: number | null;
  endValue: number | null;
  nominalPnl: number | null;
  nominalReturn: number | null;
  hurdles: {
    inflation: { rate: number | null; label: string };
    usd: { rate: number | null; label: string };
    deposit: { rate: number | null; label: string };
  };
  adjusted: {
    vsInflation: number | null;
    vsUsd: number | null;
    vsDeposit: number | null;
  };
}

type PeriodPnlMode = "vsInvested" | "intraPeriod";

/**
 * Dönem kârı.
 * - vsInvested + prior yok: güncel değer − ana para (toplam / inception).
 * - intraPeriod (aylık): ay içi ilk → son snapshot; ana para farkı düşülür.
 * - prior varsa (varsayılan): dönem başı öncesi değer → son.
 */
function computePeriodPnl(
  snapshots: SnapshotRow[],
  start: Date,
  end: Date,
  mode: PeriodPnlMode = "vsInvested"
): {
  startDate: string;
  endDate: string;
  startValue: number | null;
  endValue: number | null;
  investedAtEnd: number | null;
  nominalPnl: number | null;
  nominalReturn: number | null;
} {
  const snapsInRange = snapshots.filter((s) => {
    const t = s.snapshotDate.getTime();
    return t >= start.getTime() && t <= end.getTime();
  });

  if (snapsInRange.length === 0) {
    return {
      startDate: toDateKey(start),
      endDate: toDateKey(end),
      startValue: null,
      endValue: null,
      investedAtEnd: null,
      nominalPnl: null,
      nominalReturn: null,
    };
  }

  const first = snapsInRange[0]!;
  const last = snapsInRange[snapsInRange.length - 1]!;
  const endValue = d(last.totalMarketValue.toString());
  const endNet = d(last.netContributions.toString());

  // Aylık: her zaman ay içi ilk→son (toplam ile karışmasın)
  if (mode === "intraPeriod") {
    const startValue = d(first.totalMarketValue.toString());
    const startNet = d(first.netContributions.toString());
    const nominalPnl = endValue.minus(startValue).minus(endNet.minus(startNet));
    const denom = startValue.isZero() ? endNet : startValue;
    const nominalReturn = denom.isZero() ? null : nominalPnl.div(denom);
    return {
      startDate: toDateKey(first.snapshotDate),
      endDate: toDateKey(last.snapshotDate),
      startValue: startValue.toNumber(),
      endValue: endValue.toNumber(),
      investedAtEnd: endNet.toNumber(),
      nominalPnl: nominalPnl.toNumber(),
      nominalReturn: nominalReturn?.toNumber() ?? null,
    };
  }

  const prior = [...snapshots]
    .reverse()
    .find((s) => s.snapshotDate.getTime() < start.getTime());

  // İnception bu dönemde → ana paraya göre toplam kâr
  if (!prior) {
    const nominalPnl = endValue.minus(endNet);
    return {
      startDate: toDateKey(first.snapshotDate),
      endDate: toDateKey(last.snapshotDate),
      startValue: endNet.toNumber(), // ana para (getirisiz)
      endValue: endValue.toNumber(),
      investedAtEnd: endNet.toNumber(),
      nominalPnl: nominalPnl.toNumber(),
      nominalReturn: endNet.isZero() ? null : nominalPnl.div(endNet).toNumber(),
    };
  }

  const startValue = d(prior.totalMarketValue.toString());
  const startNet = d(prior.netContributions.toString());
  const nominalPnl = endValue.minus(startValue).minus(endNet.minus(startNet));
  const denom = startValue.isZero() ? endNet : startValue;
  const nominalReturn = denom.isZero() ? null : nominalPnl.div(denom);

  return {
    startDate: toDateKey(prior.snapshotDate),
    endDate: toDateKey(last.snapshotDate),
    startValue: startValue.toNumber(),
    endValue: endValue.toNumber(),
    investedAtEnd: endNet.toNumber(),
    nominalPnl: nominalPnl.toNumber(),
    nominalReturn: nominalReturn?.toNumber() ?? null,
  };
}

/** Elde tutulan süreye göre yıllık oranı ölçekle: (1+r)^t − 1 */
function scaleAnnualRate(annualRate: number, years: number): number {
  if (years <= 0) return 0;
  return d(1).plus(annualRate).pow(years).minus(1).toNumber();
}

function daysHeld(start: Date, end: Date): number {
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 86_400_000)
  );
}

/** Kaynak önceliği — demo-seed / eski asset-sync (~39) ile twelve_data (~47) karışmasın. */
const FX_SOURCE_PRIORITY = [
  "twelve_data_fx",
  "twelve_data",
  "tcmb_evds_fx",
  "tcmb_evds",
  "carry-forward",
  "asset-sync",
] as const;

function fxSourceRank(source: string): number {
  const idx = (FX_SOURCE_PRIORITY as readonly string[]).indexOf(source);
  if (source === "demo-seed") return 999;
  return idx === -1 ? 100 : idx;
}

async function usdChange(
  rangeStart: Date,
  rangeEnd: Date
): Promise<{ rate: number | null; start: number | null; end: number | null }> {
  const benchmark = await prisma.benchmark.findUnique({
    where: { symbol: "USDTRY" },
    select: { id: true },
  });
  if (!benchmark) return { rate: null, start: null, end: null };

  const rows = await prisma.benchmarkPrice.findMany({
    where: {
      benchmarkId: benchmark.id,
      priceDate: { gte: rangeStart, lte: rangeEnd },
      NOT: { source: "demo-seed" },
    },
    orderBy: [{ priceDate: "asc" }, { fetchedAt: "desc" }],
  });

  if (rows.length === 0) return { rate: null, start: null, end: null };

  // Tercih edilen kaynak ailesi: twelve_data varsa yalnızca onu kullan
  const hasTwelve = rows.some(
    (r) =>
      r.source === "twelve_data_fx" ||
      r.source === "twelve_data" ||
      r.source === "carry-forward"
  );
  const usable = hasTwelve
    ? rows.filter(
        (r) =>
          r.source === "twelve_data_fx" ||
          r.source === "twelve_data" ||
          r.source === "carry-forward"
      )
    : rows;

  // Her gün için en iyi kaynağı seç
  const byDate = new Map<string, { value: number; rank: number }>();
  for (const row of usable) {
    const key = toDateKey(row.priceDate);
    const value = Number(row.value.toString());
    const rank = fxSourceRank(row.source);
    const prev = byDate.get(key);
    if (!prev || rank < prev.rank) {
      byDate.set(key, { value, rank });
    }
  }

  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) return { rate: null, start: null, end: null };

  const start = byDate.get(dates[0]!)!.value;
  const end = byDate.get(dates[dates.length - 1]!)!.value;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) {
    return { rate: null, start, end };
  }

  return { rate: end / start - 1, start, end };
}

function holdingYears(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (365.25 * 86_400_000));
}

function buildAdjusted(
  nominalPnl: number | null,
  inflationRate: number | null,
  usdRate: number | null,
  depositRate: number | null
) {
  return {
    vsInflation:
      nominalPnl != null && inflationRate != null
        ? adjustPnlByHurdle(nominalPnl, inflationRate).toNumber()
        : null,
    vsUsd:
      nominalPnl != null && usdRate != null
        ? adjustPnlByHurdle(nominalPnl, usdRate).toNumber()
        : null,
    vsDeposit:
      nominalPnl != null && depositRate != null
        ? adjustPnlByHurdle(nominalPnl, depositRate).toNumber()
        : null,
  };
}

export async function GET() {
  try {
    const { user, portfolioId } = await requirePortfolioContext();
    const [snapshots, inflation, transactions] = await Promise.all([
      getPortfolioSnapshots(portfolioId, 730),
      prisma.inflationIndex.findMany({
        where: { countryCode: "TR", indexType: "TUFE" },
        orderBy: { period: "asc" },
      }),
      prisma.transaction.findMany({
        where: { portfolioId },
        orderBy: { transactionDate: "asc" },
      }),
    ]);

    const inflationPoints = inflation.map((i) => ({
      period: i.period,
      indexValue: d(i.indexValue.toString()),
      monthlyRate: i.monthlyRate ? d(i.monthlyRate.toString()) : null,
    }));

    const cashFlowsAll = buildContributionCashFlows(transactions);

    // Grafik: her snapshot için canlı nominal + TÜFE reel (eski snapshot realReturn'ü kullanma)
    const series = snapshots.map((s) => {
      const value = d(s.totalMarketValue.toString());
      const net = d(s.netContributions.toString());
      const nominalPnl = value.minus(net);
      const nominalReturn = net.isZero() ? null : nominalPnl.div(net);

      const flowsToDate = cashFlowsAll.filter(
        (f) => f.date.getTime() <= s.snapshotDate.getTime()
      );
      const real =
        inflationPoints.length > 0 && flowsToDate.length > 0
          ? calculateRealReturn({
              currentValue: value,
              cashFlows: flowsToDate,
              inflationSeries: inflationPoints,
              asOf: s.snapshotDate,
            })
          : null;

      return {
        date: toDateKey(s.snapshotDate),
        nominalValue: value.toNumber(),
        investedCapital: net.toNumber(),
        nominalPnl: nominalPnl.toNumber(),
        nominalReturn: nominalReturn?.toNumber() ?? null,
        realReturn: real?.realReturn?.toNumber() ?? null,
        realPnl: real?.realProfit.toNumber() ?? null,
        inflationAdjustedCapital:
          real?.inflationAdjustedCapital.toNumber() ?? null,
      };
    });

    const latest = snapshots.at(-1);
    const latestSeries = series.at(-1);
    const computedReal = {
      realReturn: latestSeries?.realReturn ?? null,
      inflationAdjustedCapital: latestSeries?.inflationAdjustedCapital ?? null,
      isEstimated:
        latest && inflationPoints.length > 0
          ? (() => {
              const latestPeriod = inflation.at(-1)?.period;
              if (!latestPeriod || !latest) return false;
              const asOfPeriod = `${latest.snapshotDate.getUTCFullYear()}-${String(latest.snapshotDate.getUTCMonth() + 1).padStart(2, "0")}`;
              return latestPeriod < asOfPeriod;
            })()
          : false,
    };

    const latestInf = inflation.at(-1);
    const asOf = latest?.snapshotDate ?? new Date();
    const ranges = periodRanges(asOf);

    const firstSnap = snapshots[0] ?? null;
    const inception = firstSnap?.snapshotDate ?? ranges.thisMonth.start;
    const totalEnd = asOf;

    const monthPnl = computePeriodPnl(
      snapshots,
      ranges.thisMonth.start,
      ranges.thisMonth.end,
      "intraPeriod"
    );
    const yearPnl = computePeriodPnl(
      snapshots,
      ranges.last1y.start,
      ranges.last1y.end
    );
    const totalPnl = computePeriodPnl(snapshots, inception, totalEnd);

    // Aylık pencere: takvim ayı başı değil, max(ay başı, inception)
    const monthWindowStart =
      inception.getTime() > ranges.thisMonth.start.getTime()
        ? inception
        : ranges.thisMonth.start;
    const daysInMonth = new Date(
      Date.UTC(totalEnd.getUTCFullYear(), totalEnd.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const daysHeldMonth = Math.max(1, daysHeld(monthWindowStart, totalEnd));
    const monthFraction = Math.min(1, daysHeldMonth / daysInMonth);

    const inflationMonthlyRaw =
      latestInf?.monthlyRate != null
        ? Number(latestInf.monthlyRate.toString())
        : null;
    // Kısa ay içi elde tutmada tam aylık TÜFE uygulanmaz
    const inflationMonthly =
      inflationMonthlyRaw != null
        ? inflationMonthlyRaw * monthFraction
        : null;
    const inflationAnnual =
      latestInf?.annualRate != null
        ? Number(latestInf.annualRate.toString())
        : null;

    /**
     * Elde tutma süresi enflasyon oranı: endeks oranı + son aydan sonraki prorata.
     * Kısa süreli portföyde tam YoY (%32) uygulanmaz.
     */
    function holdingInflationRate(fromDate: Date, toDate: Date): number | null {
      if (inflationPoints.length === 0) return null;
      const fromPeriod = `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const latestPeriod = latestInf?.period ?? fromPeriod;
      const fromIdx = findIndexAtPeriod(inflationPoints, fromPeriod);
      const toIdx = findIndexAtPeriod(inflationPoints, latestPeriod);
      if (!fromIdx || !toIdx || fromIdx.isZero()) return null;

      let factor = toIdx.div(fromIdx);
      const monthlyRate = latestInf?.monthlyRate
        ? Number(latestInf.monthlyRate.toString())
        : null;
      if (monthlyRate != null && latestPeriod) {
        const periodEnd = endOfPeriod(latestPeriod);
        if (toDate.getTime() > periodEnd.getTime()) {
          const prorataStart =
            fromDate.getTime() > periodEnd.getTime() ? fromDate : periodEnd;
          const inflated = applyProratedMonthlyInflation(
            1,
            monthlyRate,
            prorataStart,
            toDate
          );
          factor = factor.times(inflated);
        }
      }
      return factor.minus(1).toNumber();
    }

    const yearsTotal = holdingYears(inception, totalEnd);
    const yearsInYearWindow = holdingYears(
      inception.getTime() > ranges.last1y.start.getTime()
        ? inception
        : ranges.last1y.start,
      totalEnd
    );
    const heldDaysTotal = daysHeld(inception, totalEnd);

    // Yıllık sekme: 1 yıldan kısa elde tutmada tam yıllık hurdle yerine süreye ölçekle
    const yearWindowStart =
      inception.getTime() > ranges.last1y.start.getTime()
        ? inception
        : ranges.last1y.start;
    const inflationYear =
      yearsInYearWindow >= 0.99 && inflationAnnual != null
        ? inflationAnnual
        : holdingInflationRate(yearWindowStart, totalEnd);
    const inflationTotal = holdingInflationRate(inception, totalEnd);

    const [usdMonth, usdYear, usdTotal] = await Promise.all([
      usdChange(monthWindowStart, totalEnd),
      usdChange(yearWindowStart, totalEnd),
      usdChange(inception, totalEnd),
    ]);

    const annualDeposit = Number(user.riskFreeRateAnnual);
    const depositMonthlyFull = annualToMonthlyRate(annualDeposit).toNumber();
    const depositMonthly = depositMonthlyFull * monthFraction;
    const depositYear = scaleAnnualRate(
      annualDeposit,
      Math.min(1, yearsInYearWindow)
    );
    const depositTotal = scaleAnnualRate(annualDeposit, yearsTotal);

    const periods: Record<PeriodKey, PeriodBlock> = {
      month: {
        key: "month",
        label: "Aylık",
        startDate: monthPnl.startDate,
        endDate: monthPnl.endDate,
        startValue: monthPnl.startValue,
        endValue: monthPnl.endValue,
        nominalPnl: monthPnl.nominalPnl,
        nominalReturn: monthPnl.nominalReturn,
        hurdles: {
          inflation: {
            rate: inflationMonthly,
            label: latestInf
              ? monthFraction < 0.999
                ? `Aylık TÜFE ${latestInf.period} · ${daysHeldMonth}/${daysInMonth} gün`
                : `Aylık TÜFE ${latestInf.period}`
              : "Aylık TÜFE",
          },
          usd: {
            rate: usdMonth.rate,
            label:
              monthFraction < 0.999
                ? "USD/TRY (ay içi elde tutma)"
                : "USD/TRY bu ay",
          },
          deposit: {
            rate: depositMonthly,
            label:
              monthFraction < 0.999
                ? `Vadeli (${daysHeldMonth}/${daysInMonth} gün)`
                : "Vadeli (aylık efektif)",
          },
        },
        adjusted: buildAdjusted(
          monthPnl.nominalPnl,
          inflationMonthly,
          usdMonth.rate,
          depositMonthly
        ),
      },
      year: {
        key: "year",
        label: "Yıllık",
        startDate: yearPnl.startDate,
        endDate: yearPnl.endDate,
        startValue: yearPnl.startValue,
        endValue: yearPnl.endValue,
        nominalPnl: yearPnl.nominalPnl,
        nominalReturn: yearPnl.nominalReturn,
        hurdles: {
          inflation: {
            rate: inflationYear,
            label:
              yearsInYearWindow >= 0.99
                ? latestInf
                  ? `Yıllık TÜFE YoY ${latestInf.period}`
                  : "Yıllık TÜFE YoY"
                : `TÜFE (${heldDaysTotal} gün, ölçekli)`,
          },
          usd: {
            rate: usdYear.rate,
            label:
              yearsInYearWindow >= 0.99
                ? "USD/TRY son 12 ay"
                : "USD/TRY (elde tutma)",
          },
          deposit: {
            rate: depositYear,
            label:
              yearsInYearWindow >= 0.99
                ? "Vadeli (yıllık)"
                : `Vadeli (${yearsInYearWindow.toFixed(2)} yıl)`,
          },
        },
        adjusted: buildAdjusted(
          yearPnl.nominalPnl,
          inflationYear,
          usdYear.rate,
          depositYear
        ),
      },
      total: {
        key: "total",
        label: "Toplam",
        startDate: totalPnl.startDate,
        endDate: totalPnl.endDate,
        startValue: totalPnl.startValue,
        endValue: totalPnl.endValue,
        nominalPnl: totalPnl.nominalPnl,
        nominalReturn: totalPnl.nominalReturn,
        hurdles: {
          inflation: {
            rate: inflationTotal,
            label: `TÜFE (başlangıç→bugün, ${heldDaysTotal} gün)`,
          },
          usd: {
            rate: usdTotal.rate,
            label: "USD/TRY (başlangıç→bugün)",
          },
          deposit: {
            rate: depositTotal,
            label: `Vadeli (${yearsTotal.toFixed(2)} yıl bileşik)`,
          },
        },
        adjusted: buildAdjusted(
          totalPnl.nominalPnl,
          inflationTotal,
          usdTotal.rate,
          depositTotal
        ),
      },
    };

    // Geriye uyum: eski alanlar = aylık görünüm
    const month = {
      startDate: periods.month.startDate,
      endDate: periods.month.endDate,
      startValue: periods.month.startValue,
      endValue: periods.month.endValue,
      nominalPnl: periods.month.nominalPnl,
      nominalReturn: periods.month.nominalReturn,
    };

    const nominalReturn = latest?.cumulativeReturn
      ? Number(latest.cumulativeReturn.toString())
      : null;
    const investedCapital = latest
      ? Number(latest.netContributions.toString())
      : null;
    const currentValue = latest
      ? Number(latest.totalMarketValue.toString())
      : null;

    return jsonOk({
      summary: {
        nominalReturn,
        investedCapital,
        currentValue,
        realReturn:
          computedReal.realReturn ??
          (latest?.realReturn ? Number(latest.realReturn.toString()) : null),
        inflationAdjustedCapital:
          computedReal.inflationAdjustedCapital ??
          (latest?.inflationAdjustedCapital
            ? Number(latest.inflationAdjustedCapital.toString())
            : null),
        realReturnIsEstimated: computedReal.isEstimated,
        latestInflationRate: inflationAnnual,
        latestMonthlyInflation: inflationMonthlyRaw,
        latestPeriod: latestInf?.period ?? null,
        month,
        periods,
        hurdles: {
          inflation: {
            period: latestInf?.period ?? null,
            rate: inflationMonthlyRaw,
            annualRate: inflationAnnual,
          },
          usd: {
            rate: usdMonth.rate,
            start: usdMonth.start,
            end: usdMonth.end,
          },
          deposit: {
            annualRate: annualDeposit,
            monthlyRate: depositMonthlyFull,
          },
        },
        adjusted: periods.month.adjusted,
      },
      series,
      inflation: inflation
        .slice(-18)
        .reverse()
        .map((i) => ({
          period: i.period,
          indexValue: Number(i.indexValue.toString()),
          monthlyRate: i.monthlyRate ? Number(i.monthlyRate.toString()) : null,
          annualRate: i.annualRate ? Number(i.annualRate.toString()) : null,
          source: i.source,
        })),
      inflationAvailable: inflation.length > 0,
    });
  } catch (error) {
    return jsonError(error);
  }
}
