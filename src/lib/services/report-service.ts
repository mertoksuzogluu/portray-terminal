import { subDays } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { runInsightEngine } from "@/lib/insights/engine";
import { runAlertEngine } from "@/lib/alerts/engine";
import { computePortfolioPerformance } from "@/lib/services/performance-service";
import { startOfDay, toDateKey } from "@/lib/utils/dates";

export interface GenerateReportsResult {
  portfoliosProcessed: number;
  reportsCreated: number;
  reportsUpdated: number;
  insights: { created: number; updated: number; skipped: number };
  alerts: { evaluated: number; triggered: number };
}

/**
 * Günlük portföy raporları, içgörüler ve uyarıları üretir (idempotent).
 */
export async function generatePortfolioReports(
  asOf: Date = new Date()
): Promise<GenerateReportsResult> {
  const snapshotDate = startOfDay(asOf);
  const periodStart = subDays(snapshotDate, 30);
  const portfolios = await prisma.portfolio.findMany({ select: { id: true, name: true } });

  let reportsCreated = 0;
  let reportsUpdated = 0;
  let insightCreated = 0;
  let insightUpdated = 0;
  let insightSkipped = 0;
  let alertsEvaluated = 0;
  let alertsTriggered = 0;

  for (const portfolio of portfolios) {
    const insightResult = await runInsightEngine(portfolio.id, snapshotDate);
    insightCreated += insightResult.created;
    insightUpdated += insightResult.updated;
    insightSkipped += insightResult.skipped;

    const alertResult = await runAlertEngine(portfolio.id, snapshotDate);
    alertsEvaluated += alertResult.evaluated;
    alertsTriggered += alertResult.triggered;

    const performance = await computePortfolioPerformance(portfolio.id, snapshotDate);
    const latestSnapshot = await prisma.portfolioDailySnapshot.findFirst({
      where: { portfolioId: portfolio.id, snapshotDate: { lte: snapshotDate } },
      orderBy: { snapshotDate: "desc" },
    });

    const activeRecos = await prisma.recommendation.findMany({
      where: { portfolioId: portfolio.id, status: "ACTIVE" },
      orderBy: { score: "desc" },
      take: 5,
    });
    const latestRecoRun = await prisma.recommendationRun.findFirst({
      where: { portfolioId: portfolio.id },
      orderBy: { runDate: "desc" },
    });

    const recoSummary =
      activeRecos.length > 0
        ? ` Aktif öneri: ${activeRecos.length}${
            latestRecoRun?.riskScore != null
              ? ` (risk skoru ${Number(latestRecoRun.riskScore.toString()).toFixed(0)})`
              : ""
          }.`
        : "";

    const summary = latestSnapshot
      ? `Portföy değeri ${latestSnapshot.totalMarketValue.toString()} TRY. Son 30 gün TWR: ${
          performance?.periods.last30d?.twrReturn?.toFixed(4) ?? "—"
        }.${recoSummary}`
      : `Henüz snapshot verisi yok.${recoSummary}`;

    const title = `${portfolio.name} — Günlük Rapor (${toDateKey(snapshotDate)})`;
    const content = {
      asOf: toDateKey(snapshotDate),
      periodStart: toDateKey(periodStart),
      periodEnd: toDateKey(snapshotDate),
      performance: performance
        ? {
            totalMarketValue: performance.totalMarketValue?.toString() ?? null,
            netContributions: performance.netContributions?.toString() ?? null,
            cumulativeReturn: performance.cumulativeReturn?.toString() ?? null,
            twrCumulative: performance.twrCumulative?.toString() ?? null,
            xirr: performance.xirr?.toString() ?? null,
            last7d: performance.periods.last7d,
            last30d: performance.periods.last30d,
            thisMonth: performance.periods.thisMonth,
          }
        : null,
      insights: insightResult.insights.map((i) => ({
        category: i.category,
        severity: i.severity,
        title: i.title,
        message: i.message,
      })),
      alerts: alertResult.events,
      recommendations: {
        riskScore: latestRecoRun?.riskScore
          ? Number(latestRecoRun.riskScore.toString())
          : null,
        riskProfile: latestRecoRun?.riskProfile ?? null,
        items: activeRecos.map((r) => ({
          action: r.action,
          assetClass: r.assetClass,
          title: r.title,
          message: r.message,
          score: Number(r.score.toString()),
          suggestedDelta: Number(r.suggestedDelta.toString()),
        })),
      },
    };

    const existing = await prisma.portfolioReport.findUnique({
      where: {
        portfolioId_reportType_periodStart_periodEnd: {
          portfolioId: portfolio.id,
          reportType: "daily",
          periodStart,
          periodEnd: snapshotDate,
        },
      },
    });

    await prisma.portfolioReport.upsert({
      where: {
        portfolioId_reportType_periodStart_periodEnd: {
          portfolioId: portfolio.id,
          reportType: "daily",
          periodStart,
          periodEnd: snapshotDate,
        },
      },
      create: {
        portfolioId: portfolio.id,
        reportType: "daily",
        periodStart,
        periodEnd: snapshotDate,
        title,
        summary,
        content: content as Prisma.InputJsonValue,
      },
      update: {
        title,
        summary,
        content: content as Prisma.InputJsonValue,
      },
    });

    if (existing) {
      reportsUpdated += 1;
    } else {
      reportsCreated += 1;
    }
  }

  return {
    portfoliosProcessed: portfolios.length,
    reportsCreated,
    reportsUpdated,
    insights: {
      created: insightCreated,
      updated: insightUpdated,
      skipped: insightSkipped,
    },
    alerts: { evaluated: alertsEvaluated, triggered: alertsTriggered },
  };
}
