import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { marketDateOnly, toDateKey } from "@/lib/utils/dates";
import { buildMonthlyAiMetrics } from "./metrics";
import { buildAiNarrative } from "./narrative";
import {
  MONTHLY_AI_REPORT_TYPE,
  type MonthlyAiReportContent,
} from "./types";

export interface GenerateMonthlyAiResult {
  portfoliosProcessed: number;
  reportsCreated: number;
  reportsUpdated: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  source: "openai" | "template" | null;
  aiError: string | null;
}

/** Rapor dönemi: asOf ayının 1’i → asOf (genelde ayın 30’u). */
export function monthlyReportPeriod(asOf: Date = new Date()): {
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
} {
  const end = marketDateOnly(asOf);
  const periodStart = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)
  );
  const periodLabel = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}`;
  return { periodStart, periodEnd: end, periodLabel };
}

function monthTitleTr(periodLabel: string): string {
  const [y, m] = periodLabel.split("-");
  const names = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  const mi = Number(m) - 1;
  return `${names[mi] ?? m} ${y}`;
}

export async function generateMonthlyAiAnalystReports(
  asOf: Date = new Date(),
  options?: { portfolioId?: string }
): Promise<GenerateMonthlyAiResult> {
  const { periodStart, periodEnd, periodLabel } = monthlyReportPeriod(asOf);
  const portfolios = options?.portfolioId
    ? await prisma.portfolio.findMany({
        where: { id: options.portfolioId },
        select: { id: true, name: true },
      })
    : await prisma.portfolio.findMany({ select: { id: true, name: true } });

  let reportsCreated = 0;
  let reportsUpdated = 0;
  let lastSource: "openai" | "template" | null = null;
  let lastAiError: string | null = null;

  for (const portfolio of portfolios) {
    const metrics = await buildMonthlyAiMetrics(
      portfolio.id,
      periodStart,
      periodEnd
    );
    const narrative = await buildAiNarrative(periodLabel, metrics);
    lastSource = narrative.source;
    lastAiError = narrative.aiError ?? null;

    const content: MonthlyAiReportContent = {
      version: 1,
      kind: MONTHLY_AI_REPORT_TYPE,
      generatedAt: new Date().toISOString(),
      period: {
        start: toDateKey(periodStart),
        end: toDateKey(periodEnd),
        label: periodLabel,
      },
      metrics,
      narrative,
    };

    const monthName = monthTitleTr(periodLabel);
    const title = `${portfolio.name} — AI Analist · ${monthName}`;
    const summary = narrative.executiveSummary.slice(0, 400);

    const existing = await prisma.portfolioReport.findUnique({
      where: {
        portfolioId_reportType_periodStart_periodEnd: {
          portfolioId: portfolio.id,
          reportType: MONTHLY_AI_REPORT_TYPE,
          periodStart,
          periodEnd,
        },
      },
    });

    await prisma.portfolioReport.upsert({
      where: {
        portfolioId_reportType_periodStart_periodEnd: {
          portfolioId: portfolio.id,
          reportType: MONTHLY_AI_REPORT_TYPE,
          periodStart,
          periodEnd,
        },
      },
      create: {
        portfolioId: portfolio.id,
        reportType: MONTHLY_AI_REPORT_TYPE,
        periodStart,
        periodEnd,
        title,
        summary,
        content: content as unknown as Prisma.InputJsonValue,
      },
      update: {
        title,
        summary,
        content: content as unknown as Prisma.InputJsonValue,
      },
    });

    if (existing) reportsUpdated += 1;
    else reportsCreated += 1;
  }

  return {
    portfoliosProcessed: portfolios.length,
    reportsCreated,
    reportsUpdated,
    periodLabel,
    periodStart: toDateKey(periodStart),
    periodEnd: toDateKey(periodEnd),
    source: lastSource,
    aiError: lastAiError,
  };
}
