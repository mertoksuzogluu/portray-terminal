import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import { computeRiskMetrics, concentrationAnalysis } from "@/lib/calculations/risk";
import { normalizeSeriesToBase } from "@/lib/calculations/returns";
import {
  getLatestPortfolioSnapshot,
  getLatestPositionSnapshots,
  getPortfolioSnapshots,
  requirePortfolioContext,
} from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { startOfDay, toDateKey } from "@/lib/utils/dates";
import { createDailySnapshot } from "@/lib/services/snapshot-service";

export async function GET() {
  try {
    const { user, portfolioId } = await requirePortfolioContext();

    // Snapshot yoksa veya güncelliğini yitirdiyse üret — özet boş kalmasın
    const existingLatest = await getLatestPortfolioSnapshot(portfolioId);
    const today = startOfDay(new Date());
    if (
      !existingLatest ||
      startOfDay(existingLatest.snapshotDate).getTime() < today.getTime()
    ) {
      try {
        await createDailySnapshot(portfolioId, today);
      } catch {
        // snapshot üretimi başarısız olsa bile mevcut veriyle devam
      }
    }

    const [latest, snapshots, positions, insights, alerts, recommendations] =
      await Promise.all([
      getLatestPortfolioSnapshot(portfolioId),
      getPortfolioSnapshots(portfolioId, 365),
      getLatestPositionSnapshots(portfolioId),
      prisma.analysisInsight.findMany({
        where: { portfolioId },
        orderBy: { insightDate: "desc" },
        take: 5,
      }),
      prisma.alertEvent.findMany({
        where: { alertRule: { portfolioId } },
        orderBy: { triggeredAt: "desc" },
        take: 5,
        include: { alertRule: true },
      }),
      prisma.recommendation.findMany({
        where: { portfolioId, status: "ACTIVE" },
        orderBy: { score: "desc" },
        take: 3,
      }),
    ]);

    const latestRecoRun = await prisma.recommendationRun.findFirst({
      where: { portfolioId },
      orderBy: { runDate: "desc" },
    });

    const chartData = snapshots.map((s) => ({
      date: toDateKey(s.snapshotDate),
      value: Number(s.totalMarketValue.toString()),
      dailyReturn: s.dailyReturn ? Number(s.dailyReturn.toString()) : null,
    }));

    const totalValue = latest
      ? Number(latest.totalMarketValue.toString())
      : positions.reduce((acc, p) => acc + Number(p.marketValue.toString()), 0);

    const allocation = positions.map((p) => ({
      name: p.asset.symbol,
      value: Number(p.marketValue.toString()),
      weight: totalValue > 0 ? Number(p.marketValue.toString()) / totalValue : 0,
    }));

    const sortedByPnl = [...positions].sort(
      (a, b) =>
        Number(b.dailyProfitLoss.toString()) - Number(a.dailyProfitLoss.toString())
    );

    const winners = sortedByPnl
      .filter((p) => Number(p.dailyProfitLoss.toString()) > 0)
      .slice(0, 3)
      .map((p) => ({
        assetId: p.assetId,
        symbol: p.asset.symbol,
        name: p.asset.name,
        pnl: Number(p.dailyProfitLoss.toString()),
        returnPct: p.dailyReturn ? Number(p.dailyReturn.toString()) * 100 : null,
      }));

    const losers = sortedByPnl
      .filter((p) => Number(p.dailyProfitLoss.toString()) < 0)
      .slice(-3)
      .reverse()
      .map((p) => ({
        assetId: p.assetId,
        symbol: p.asset.symbol,
        name: p.asset.name,
        pnl: Number(p.dailyProfitLoss.toString()),
        returnPct: p.dailyReturn ? Number(p.dailyReturn.toString()) * 100 : null,
      }));

    const dailyReturns = snapshots
      .map((s) => s.dailyReturn?.toString())
      .filter(Boolean)
      .map((r) => d(r!));

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

    const normalized = normalizeSeriesToBase(
      snapshots.map((s) => d(s.totalMarketValue.toString()))
    );

    return jsonOk({
      summary: {
        totalValue,
        cashValue: latest ? Number(latest.cashValue.toString()) : 0,
        dailyPnl: latest ? Number(latest.dailyProfitLoss.toString()) : 0,
        dailyReturn: latest?.dailyReturn ? Number(latest.dailyReturn.toString()) : null,
        cumulativeReturn: latest?.cumulativeReturn
          ? Number(latest.cumulativeReturn.toString())
          : null,
        investedCapital: latest ? Number(latest.investedCapital.toString()) : 0,
        snapshotDate: latest ? toDateKey(latest.snapshotDate) : null,
        currency: user.baseCurrency,
      },
      chartData,
      allocation,
      insights: insights.map((i) => ({
        id: i.id,
        title: i.title,
        message: i.message,
        severity: i.severity,
        category: i.category,
        date: toDateKey(i.insightDate),
      })),
      alerts: alerts.map((a) => ({
        id: a.id,
        message: a.message,
        triggeredAt: a.triggeredAt.toISOString(),
        ruleName: a.alertRule.name,
        isRead: a.isRead,
      })),
      winners,
      losers,
      risk: {
        volatility: risk.annualizedVolatility?.toNumber() ?? null,
        sharpe: risk.sharpeRatio?.toNumber() ?? null,
        maxDrawdown: risk.drawdown.maxDrawdown?.toNumber() ?? null,
        concentration: concentration.weights.slice(0, 5).map((w) => {
          const pos = positions.find((p) => p.assetId === w.assetId);
          return {
            symbol: pos?.asset.symbol ?? w.assetId,
            weight: w.weight.toNumber(),
          };
        }),
      },
      normalizedSeries: snapshots.map((s, i) => ({
        date: toDateKey(s.snapshotDate),
        value: normalized[i]?.toNumber() ?? 100,
      })),
      recommendations: {
        riskProfile: user.riskProfile,
        riskScore: latestRecoRun?.riskScore
          ? Number(latestRecoRun.riskScore.toString())
          : null,
        items: recommendations.map((r) => ({
          id: r.id,
          action: r.action,
          title: r.title,
          score: Number(r.score.toString()),
          suggestedDelta: Number(r.suggestedDelta.toString()),
        })),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
