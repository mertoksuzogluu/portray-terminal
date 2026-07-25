import { jsonError, jsonOk } from "@/lib/api/response";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { generateMonthlyAiAnalystReports } from "@/lib/ai-analyst";
import { istanbulToday } from "@/lib/utils/dates";

/** Kullanıcı tetiklemeli aylık AI Analist üretimi (mevcut ay). */
export async function POST() {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const result = await generateMonthlyAiAnalystReports(istanbulToday(), {
      portfolioId,
    });
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
