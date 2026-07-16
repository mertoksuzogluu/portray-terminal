import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import { analyzeContributions } from "@/lib/calculations/contribution";
import { computeRiskMetrics, concentrationAnalysis } from "@/lib/calculations/risk";
import { normalizeSeriesToBase, compoundReturns } from "@/lib/calculations/returns";
import {
  getLatestPositionSnapshots,
  getPortfolioSnapshots,
  requirePortfolioContext,
} from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { toDateKey } from "@/lib/utils/dates";

export async function GET() {
  try {
    const { user, portfolioId } = await requirePortfolioContext();
    const [snapshots, positions] = await Promise.all([
      getPortfolioSnapshots(portfolioId, 730),
      getLatestPositionSnapshots(portfolioId),
    ]);

    const dailyReturns = snapshots
      .map((s) => s.dailyReturn?.toString())
      .filter(Boolean)
      .map((r) => d(r!));

    const portfolioReturn = compoundReturns(dailyReturns)?.toNumber() ?? null;

    const totalValue = positions.reduce(
      (acc, p) => acc + Number(p.marketValue.toString()),
      0
    );

    const contributionInputs = positions.map((p) => ({
      assetId: p.assetId,
      symbol: p.asset.symbol,
      weight: totalValue > 0 ? d(p.marketValue.toString()).div(totalValue) : d(0),
      assetReturn: p.dailyReturn ? d(p.dailyReturn.toString()) : d(0),
      profitLoss: d(p.dailyProfitLoss.toString()),
    }));

    const contribution = analyzeContributions(contributionInputs);

    const risk = computeRiskMetrics({
      dailyReturns,
      values: snapshots.map((s) => ({
        date: s.snapshotDate,
        value: d(s.totalMarketValue.toString()),
      })),
      annualRiskFreeRate: d(user.riskFreeRateAnnual),
    });

    const weights = positions.map((p) => ({
      assetId: p.assetId,
      marketValue: d(p.marketValue.toString()),
    }));
    const concentration = concentrationAnalysis(weights);

    const normalizedValues = normalizeSeriesToBase(
      snapshots.map((s) => d(s.totalMarketValue.toString()))
    );
    const normalized = snapshots.map((s, i) => ({
      date: s.snapshotDate,
      value: normalizedValues[i] ?? d(100),
    }));

    const drawdownSeries = normalized.map((p, i, arr) => {
        const peak = arr.slice(0, i + 1).reduce(
          (max, x) => (x.value.gt(max) ? x.value : max),
          d(0)
        );
        const dd = peak.isZero() ? d(0) : p.value.minus(peak).div(peak);
        return { date: toDateKey(p.date), drawdown: dd.toNumber() };
      });

    const monthlyMap = new Map<string, number[]>();
    for (const s of snapshots) {
      const key = `${s.snapshotDate.getFullYear()}-${String(s.snapshotDate.getMonth() + 1).padStart(2, "0")}`;
      const ret = s.dailyReturn ? Number(s.dailyReturn.toString()) : 0;
      if (!monthlyMap.has(key)) monthlyMap.set(key, []);
      monthlyMap.get(key)!.push(ret);
    }

    const monthlyHeatmap = [...monthlyMap.entries()].map(([month, returns]) => ({
      month,
      return: returns.reduce((a, b) => a + b, 0),
    }));

    const rollingWindow = 30;
    const rolling = snapshots.slice(-180).map((s, idx, arr) => {
      const window = arr
        .slice(Math.max(0, idx - rollingWindow + 1), idx + 1)
        .map((x) => x.dailyReturn?.toString())
        .filter(Boolean)
        .map((r) => d(r!));
      const ret = compoundReturns(window)?.toNumber() ?? null;
      return { date: toDateKey(s.snapshotDate), return: ret };
    });

    return jsonOk({
      performance: {
        cumulativeReturn: portfolioReturn,
        twrCumulative: snapshots.at(-1)?.twrCumulative
          ? Number(snapshots.at(-1)!.twrCumulative!.toString())
          : null,
        series: normalized.map((p) => ({
          date: toDateKey(p.date),
          value: p.value.toNumber(),
        })),
      },
      contribution: {
        total: contribution.totalProfitLoss.toNumber(),
        assets: contribution.items.map((c) => ({
          symbol: c.symbol,
          contribution: c.contributionPoints.toNumber(),
          weight: c.weight.toNumber(),
          dailyReturn: c.assetReturn.toNumber(),
        })),
      },
      risk: {
        volatility: risk.annualizedVolatility?.toNumber() ?? null,
        sharpe: risk.sharpeRatio?.toNumber() ?? null,
        sortino: risk.sortinoRatio?.toNumber() ?? null,
        bestDay: risk.bestDay?.toNumber() ?? null,
        worstDay: risk.worstDay?.toNumber() ?? null,
        positiveDayRatio: risk.positiveDayRatio?.toNumber() ?? null,
        maxDrawdown: risk.drawdown.maxDrawdown?.toNumber() ?? null,
        currentDrawdown: risk.drawdown.currentDrawdown?.toNumber() ?? null,
        observationCount: risk.observationCount,
        insufficientData: risk.insufficientData,
      },
      concentration: {
        hhi: concentration.herfindahlHirschmanIndex?.toNumber() ?? 0,
        topHoldings: concentration.weights.slice(0, 10).map((w) => {
          const pos = positions.find((p) => p.assetId === w.assetId);
          return {
            symbol: pos?.asset.symbol ?? w.assetId,
            weight: w.weight.toNumber(),
          };
        }),
      },
      drawdown: drawdownSeries,
      monthlyHeatmap,
      rolling,
    });
  } catch (error) {
    return jsonError(error);
  }
}
