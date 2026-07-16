import { NextRequest } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/db/prisma";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { createHash } from "crypto";

interface CsvRow {
  tarih?: string;
  date?: string;
  sembol?: string;
  symbol?: string;
  tip?: string;
  type?: string;
  miktar?: string;
  quantity?: string;
  fiyat?: string;
  price?: string;
  komisyon?: string;
  commission?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const formData = await req.formData();
    const file = formData.get("file");
    const accountId = String(formData.get("accountId") ?? "");

    if (!(file instanceof File)) {
      return jsonError(new Error("CSV dosyası gerekli."), 400);
    }
    if (!accountId) {
      return jsonError(new Error("Hesap seçimi gerekli."), 400);
    }

    const text = await file.text();
    const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });

    let imported = 0;
    let skipped = 0;

    for (const row of parsed.data) {
      const symbol = (row.sembol ?? row.symbol ?? "").trim().toUpperCase();
      const dateStr = row.tarih ?? row.date;
      const typeRaw = (row.tip ?? row.type ?? "BUY").trim().toUpperCase();
      const qty = Number(row.miktar ?? row.quantity ?? 0);
      const price = Number(row.fiyat ?? row.price ?? 0);
      const commission = Number(row.komisyon ?? row.commission ?? 0);

      if (!symbol || !dateStr || !qty) {
        skipped++;
        continue;
      }

      const asset = await prisma.asset.findFirst({
        where: { symbol, isActive: true },
      });
      if (!asset) {
        skipped++;
        continue;
      }

      const hash = createHash("sha256")
        .update(`${portfolioId}:${symbol}:${dateStr}:${qty}:${price}`)
        .digest("hex");

      const existing = await prisma.transaction.findFirst({
        where: { portfolioId, importHash: hash },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const txType =
        typeRaw === "SELL" || typeRaw === "SAT"
          ? "SELL"
          : typeRaw === "DIVIDEND" || typeRaw === "TEMETTÜ"
            ? "DIVIDEND"
            : "BUY";

      await prisma.transaction.create({
        data: {
          portfolioId,
          accountId,
          assetId: asset.id,
          transactionType: txType,
          transactionDate: new Date(dateStr),
          quantity: qty,
          unitPrice: price,
          grossAmount: qty * price,
          commission,
          currency: "TRY",
          importHash: hash,
        },
      });
      imported++;
    }

    return jsonOk({ imported, skipped, total: parsed.data.length });
  } catch (error) {
    return jsonError(error);
  }
}
