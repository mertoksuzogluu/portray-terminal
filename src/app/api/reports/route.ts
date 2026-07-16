import { prisma } from "@/lib/db/prisma";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { toDateKey } from "@/lib/utils/dates";

export async function GET() {
  try {
    const { portfolioId } = await requirePortfolioContext();

    const reports = await prisma.portfolioReport.findMany({
      where: { portfolioId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return jsonOk({
      reports: reports.map((r) => ({
        id: r.id,
        title: r.title,
        reportType: r.reportType,
        periodStart: toDateKey(r.periodStart),
        periodEnd: toDateKey(r.periodEnd),
        summary: r.summary,
        createdAt: r.createdAt.toISOString(),
        content: r.content,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
