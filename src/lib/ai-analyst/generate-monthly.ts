import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { marketDateOnly, toDateKey } from "@/lib/utils/dates";
import { ensureBistHistory } from "./bist-history";
import { buildMonthlyAiMetrics } from "./metrics";
import { buildAiNarrative } from "./narrative";
import { fetchTopHoldingBriefing } from "./top-holding-briefing";
import type { TopHoldingInfo } from "./top-holding-briefing";
import { fetchWorldMarketBriefing } from "./world-briefing";
import {
  MONTHLY_AI_MANUAL_REPORT_TYPE,
  MONTHLY_AI_REPORT_TYPE,
  type MonthlyAiReportContent,
  type MonthlyAiTrigger,
} from "./types";

export class AiAnalystQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiAnalystQuotaError";
  }
}

async function resolveTopHolding(
  metricsAllocation: {
    key: string;
    label: string;
    weight: number;
    value: number;
  }[]
): Promise<TopHoldingInfo | null> {
  const top = metricsAllocation[0];
  if (!top) return null;

  const asset = await prisma.asset.findFirst({
    where: { symbol: top.key },
    select: { symbol: true, name: true, assetType: true },
  });

  return {
    symbol: top.key,
    name: asset?.name || top.label || top.key,
    weight: top.weight,
    value: top.value,
    assetType: asset?.assetType ?? null,
  };
}

export interface GenerateMonthlyAiResult {
  portfoliosProcessed: number;
  reportsCreated: number;
  reportsUpdated: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  source: "openai" | "template" | null;
  aiError: string | null;
  trigger: MonthlyAiTrigger;
  manualUsedThisMonth?: boolean;
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

export async function hasManualReportThisMonth(
  portfolioId: string,
  asOf: Date = new Date()
): Promise<boolean> {
  const { periodStart } = monthlyReportPeriod(asOf);
  const existing = await prisma.portfolioReport.findFirst({
    where: {
      portfolioId,
      reportType: MONTHLY_AI_MANUAL_REPORT_TYPE,
      periodStart,
    },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * Aylık AI Analist üretimi.
 * - manual: hesap başına ayda 1 (ay sonunda otomatik rapordan ayrı)
 * - scheduled: ayın 30’u cron; manuel kullanılmış olsa bile yeniden oluşur
 */
export async function generateMonthlyAiAnalystReports(
  asOf: Date = new Date(),
  options?: {
    portfolioId?: string;
    trigger?: MonthlyAiTrigger;
  }
): Promise<GenerateMonthlyAiResult> {
  const trigger: MonthlyAiTrigger = options?.trigger ?? "scheduled";
  const reportType =
    trigger === "manual"
      ? MONTHLY_AI_MANUAL_REPORT_TYPE
      : MONTHLY_AI_REPORT_TYPE;

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
  let manualUsedThisMonth = false;

  // BIST: Yahoo geçmişi (demo carry-forward ile karışmasın)
  await ensureBistHistory(periodStart, periodEnd);

  const monthName = monthTitleTr(periodLabel);
  const world = await fetchWorldMarketBriefing({
    periodLabel,
    monthName,
    periodStart: toDateKey(periodStart),
    periodEnd: toDateKey(periodEnd),
  });

  for (const portfolio of portfolios) {
    if (trigger === "manual") {
      const used = await hasManualReportThisMonth(portfolio.id, asOf);
      if (used) {
        throw new AiAnalystQuotaError(
          "Bu ay için manuel AI Analist hakkınızı zaten kullandınız. Ay sonunda (30’unda) otomatik rapor ayrıca oluşur — ayda en fazla 2 rapor (1 manuel + 1 otomatik)."
        );
      }
    }

    const metrics = await buildMonthlyAiMetrics(
      portfolio.id,
      periodStart,
      periodEnd
    );
    const topHolding = await resolveTopHolding(metrics.allocationBySymbol);
    const holdingBrief = topHolding
      ? await fetchTopHoldingBriefing({
          holding: topHolding,
          monthName,
          periodStart: toDateKey(periodStart),
          periodEnd: toDateKey(periodEnd),
        })
      : { briefing: null, error: null };

    const narrative = await buildAiNarrative(periodLabel, metrics, {
      worldBriefing: world.briefing,
      topHolding,
      topHoldingBriefing: holdingBrief.briefing,
    });
    lastSource = narrative.source;
    lastAiError = narrative.aiError ?? null;

    const content: MonthlyAiReportContent = {
      version: 1,
      kind: reportType,
      trigger,
      generatedAt: new Date().toISOString(),
      period: {
        start: toDateKey(periodStart),
        end: toDateKey(periodEnd),
        label: periodLabel,
      },
      metrics,
      narrative,
    };

    const triggerLabel = trigger === "manual" ? "Manuel" : "Otomatik";
    const title = `${portfolio.name} — AI Analist · ${monthName} (${triggerLabel})`;
    const summary = narrative.executiveSummary.slice(0, 400);

    // Aynı ay + aynı tetikleyici: periodStart ay başı ile bulunur (periodEnd günü değişse bile tek kayıt)
    const existing = await prisma.portfolioReport.findFirst({
      where: {
        portfolioId: portfolio.id,
        reportType,
        periodStart,
      },
    });

    if (trigger === "manual") {
      await prisma.portfolioReport.create({
        data: {
          portfolioId: portfolio.id,
          reportType,
          periodStart,
          periodEnd,
          title,
          summary,
          content: content as unknown as Prisma.InputJsonValue,
        },
      });
      reportsCreated += 1;
      manualUsedThisMonth = true;
    } else if (existing) {
      await prisma.portfolioReport.update({
        where: { id: existing.id },
        data: {
          periodEnd,
          title,
          summary,
          content: content as unknown as Prisma.InputJsonValue,
        },
      });
      reportsUpdated += 1;
    } else {
      await prisma.portfolioReport.create({
        data: {
          portfolioId: portfolio.id,
          reportType,
          periodStart,
          periodEnd,
          title,
          summary,
          content: content as unknown as Prisma.InputJsonValue,
        },
      });
      reportsCreated += 1;
    }
  }

  if (options?.portfolioId && trigger === "scheduled") {
    manualUsedThisMonth = await hasManualReportThisMonth(
      options.portfolioId,
      asOf
    );
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
    trigger,
    manualUsedThisMonth,
  };
}
