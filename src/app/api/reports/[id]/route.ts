import { prisma } from "@/lib/db/prisma";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { toDateKey } from "@/lib/utils/dates";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const { id } = await ctx.params;

    const report = await prisma.portfolioReport.findFirst({
      where: { id, portfolioId },
    });

    if (!report) {
      return jsonError(new Error("Rapor bulunamadı."), 404);
    }

    return jsonOk({
      report: {
        id: report.id,
        title: report.title,
        reportType: report.reportType,
        periodStart: toDateKey(report.periodStart),
        periodEnd: toDateKey(report.periodEnd),
        summary: report.summary,
        createdAt: report.createdAt.toISOString(),
        content: report.content,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
