import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import { calculateDrawdown, concentrationAnalysis } from "@/lib/calculations/risk";
import { startOfDay } from "@/lib/utils/dates";
import { computePortfolioPerformance } from "./performance-service";
import type { PortfolioPerformanceMetrics } from "./performance-service";
import type { InsightCategory, InsightSeverity } from "@prisma/client";

export interface DashboardPositionSummary {
  assetId: string;
  symbol: string;
  name: string;
  marketValue: string;
  portfolioWeight: string | null;
  dailyReturn: string | null;
  unrealizedProfitLoss: string | null;
}

export interface DashboardAlertSummary {
  id: string;
  alertRuleId: string;
  message: string;
  triggeredAt: Date;
  isRead: boolean;
  ruleName: string;
}

export interface DashboardInsightSummary {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  message: string;
  insightDate: Date;
}

export interface PortfolioDashboardSummary {
  portfolioId: string;
  portfolioName: string;
  baseCurrency: string;
  asOf: Date;
  hasSnapshots: boolean;
  totalMarketValue: string | null;
  netContributions: string | null;
  dailyProfitLoss: string | null;
  dailyReturn: string | null;
  cumulativeReturn: string | null;
  twrCumulative: string | null;
  realReturn: string | null;
  currentDrawdown: string | null;
  performance: PortfolioPerformanceMetrics | null;
  positions: DashboardPositionSummary[];
  concentration: {
    largestSymbol: string | null;
    largestWeight: string | null;
    top3Weight: string | null;
  };
  insights: DashboardInsightSummary[];
  unreadAlerts: DashboardAlertSummary[];
  unreadAlertCount: number;
}

export async function getPortfolioDashboardSummary(
  portfolioId: string,
  asOf: Date = new Date()
): Promise<PortfolioDashboardSummary | null> {
  const insightDate = startOfDay(asOf);

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: { id: true, name: true, baseCurrency: true },
  });

  if (!portfolio) return null;

  const [latestSnapshot, performance, insights, alertEvents, history] =
    await Promise.all([
      prisma.portfolioDailySnapshot.findFirst({
        where: { portfolioId, snapshotDate: { lte: insightDate } },
        orderBy: { snapshotDate: "desc" },
      }),
      computePortfolioPerformance(portfolioId, insightDate),
      prisma.analysisInsight.findMany({
        where: { portfolioId, insightDate: { lte: insightDate } },
        orderBy: [{ insightDate: "desc" }, { createdAt: "desc" }],
        take: 10,
      }),
      prisma.alertEvent.findMany({
        where: {
          isRead: false,
          alertRule: { portfolioId },
        },
        include: { alertRule: { select: { name: true } } },
        orderBy: { triggeredAt: "desc" },
        take: 20,
      }),
      prisma.portfolioDailySnapshot.findMany({
        where: { portfolioId, snapshotDate: { lte: insightDate } },
        orderBy: { snapshotDate: "asc" },
        take: 365,
      }),
    ]);

  const positions = latestSnapshot
    ? await prisma.positionDailySnapshot.findMany({
        where: {
          portfolioId,
          snapshotDate: latestSnapshot.snapshotDate,
          accountId: "",
        },
        include: { asset: { select: { symbol: true, name: true } } },
        orderBy: { marketValue: "desc" },
      })
    : [];

  const drawdown =
    history.length >= 2
      ? calculateDrawdown(
          history.map((s) => ({
            date: s.snapshotDate,
            value: d(s.totalMarketValue.toString()),
          }))
        )
      : null;

  const concentration = concentrationAnalysis(
    positions.map((p) => ({
      assetId: p.assetId,
      marketValue: d(p.marketValue.toString()),
    }))
  );

  const topWeight = concentration.weights[0];
  const topPosition = topWeight
    ? positions.find((p) => p.assetId === topWeight.assetId)
    : undefined;

  return {
    portfolioId,
    portfolioName: portfolio.name,
    baseCurrency: portfolio.baseCurrency,
    asOf: insightDate,
    hasSnapshots: history.length > 0,
    totalMarketValue: latestSnapshot
      ? d(latestSnapshot.totalMarketValue.toString()).toString()
      : null,
    netContributions: latestSnapshot
      ? d(latestSnapshot.netContributions.toString()).toString()
      : null,
    dailyProfitLoss: latestSnapshot
      ? d(latestSnapshot.dailyProfitLoss.toString()).toString()
      : null,
    dailyReturn: latestSnapshot?.dailyReturn
      ? d(latestSnapshot.dailyReturn.toString()).toString()
      : null,
    cumulativeReturn: latestSnapshot?.cumulativeReturn
      ? d(latestSnapshot.cumulativeReturn.toString()).toString()
      : null,
    twrCumulative: latestSnapshot?.twrCumulative
      ? d(latestSnapshot.twrCumulative.toString()).toString()
      : null,
    realReturn: latestSnapshot?.realReturn
      ? d(latestSnapshot.realReturn.toString()).toString()
      : null,
    currentDrawdown: drawdown?.currentDrawdown?.toString() ?? null,
    performance,
    positions: positions.map((p) => ({
      assetId: p.assetId,
      symbol: p.asset.symbol,
      name: p.asset.name,
      marketValue: d(p.marketValue.toString()).toString(),
      portfolioWeight: p.portfolioWeight
        ? d(p.portfolioWeight.toString()).toString()
        : null,
      dailyReturn: p.dailyReturn
        ? d(p.dailyReturn.toString()).toString()
        : null,
      unrealizedProfitLoss: d(p.unrealizedProfitLoss.toString()).toString(),
    })),
    concentration: {
      largestSymbol: topPosition?.asset.symbol ?? null,
      largestWeight: concentration.largestWeight?.toString() ?? null,
      top3Weight: concentration.top3Weight?.toString() ?? null,
    },
    insights: insights.map((i) => ({
      id: i.id,
      category: i.category,
      severity: i.severity,
      title: i.title,
      message: i.message,
      insightDate: i.insightDate,
    })),
    unreadAlerts: alertEvents.map((e) => ({
      id: e.id,
      alertRuleId: e.alertRuleId,
      message: e.message,
      triggeredAt: e.triggeredAt,
      isRead: e.isRead,
      ruleName: e.alertRule.name,
    })),
    unreadAlertCount: alertEvents.length,
  };
}
