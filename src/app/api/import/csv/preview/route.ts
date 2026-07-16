import { NextRequest } from "next/server";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { previewCsvImport } from "@/lib/services/csv-import";
import type { CsvColumnMapping } from "@/lib/services/csv-import";

export async function POST(req: NextRequest) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const body = await req.json();
    const csvText = String(body.csvText ?? "");
    const accountId = String(body.accountId ?? "");
    const columnMapping = body.columnMapping as Partial<CsvColumnMapping> | undefined;

    if (!csvText.trim()) {
      return jsonError(new Error("CSV içeriği gerekli."), 400);
    }
    if (!accountId) {
      return jsonError(new Error("Hesap seçimi gerekli."), 400);
    }

    const preview = await previewCsvImport({
      portfolioId,
      accountId,
      csvText,
      columnMapping,
    });

    return jsonOk(preview);
  } catch (error) {
    return jsonError(error);
  }
}
