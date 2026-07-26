import { prisma } from "@/lib/db/prisma";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  MONTHLY_AI_REPORT_TYPES,
  hasManualReportThisMonth,
} from "@/lib/ai-analyst";
import { istanbulToday, toDateKey } from "@/lib/utils/dates";

export async function GET(req: Request) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // monthly_ai | all

    const reports = await prisma.portfolioReport.findMany({
      where: {
        portfolioId,
        ...(type === "all"
          ? {}
          : { reportType: { in: [...MONTHLY_AI_REPORT_TYPES] } }),
      },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      take: 36,
    });

    const manualUsedThisMonth = await hasManualReportThisMonth(
      portfolioId,
      istanbulToday()
    );

    return jsonOk({
      reports: reports.map((r) => ({
        id: r.id,
        title: r.title,
        reportType: r.reportType,
        periodStart: toDateKey(r.periodStart),
        periodEnd: toDateKey(r.periodEnd),
        summary: r.summary,
        createdAt: r.createdAt.toISOString(),
      })),
      quota: {
        manualUsedThisMonth,
        manualRemaining: manualUsedThisMonth ? 0 : 1,
        maxManualPerMonth: 1,
        maxReportsPerMonth: 2,
        autoAtMonthEnd: true,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
