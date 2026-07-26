import { jsonError, jsonOk } from "@/lib/api/response";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import {
  AiAnalystQuotaError,
  generateMonthlyAiAnalystReports,
  hasManualReportThisMonth,
} from "@/lib/ai-analyst";
import { istanbulToday } from "@/lib/utils/dates";

/** Kullanıcı tetiklemeli aylık AI Analist — ayda 1 kez. */
export async function POST() {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const today = istanbulToday();
    const result = await generateMonthlyAiAnalystReports(today, {
      portfolioId,
      trigger: "manual",
    });
    return jsonOk({
      ok: true,
      ...result,
      manualRemaining: 0,
    });
  } catch (error) {
    if (error instanceof AiAnalystQuotaError) {
      return jsonError(error, 409);
    }
    return jsonError(error);
  }
}

/** Kota durumu */
export async function GET() {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const used = await hasManualReportThisMonth(portfolioId, istanbulToday());
    return jsonOk({
      manualUsedThisMonth: used,
      manualRemaining: used ? 0 : 1,
      maxManualPerMonth: 1,
      autoAtMonthEnd: true,
      maxReportsPerMonth: 2,
    });
  } catch (error) {
    return jsonError(error);
  }
}
