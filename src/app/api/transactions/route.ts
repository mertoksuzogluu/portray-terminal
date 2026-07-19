import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { rebuildSnapshotsFrom } from "@/lib/services/snapshot-service";
import { toDateKey } from "@/lib/utils/dates";

export async function GET() {
  try {
    const { portfolioId } = await requirePortfolioContext();

    const transactions = await prisma.transaction.findMany({
      where: { portfolioId },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      include: { asset: true, account: true },
      take: 200,
    });

    const accounts = await prisma.account.findMany({
      where: { portfolioId },
      select: { id: true, name: true },
    });

    const assets = await prisma.asset.findMany({
      where: { isActive: true },
      orderBy: { symbol: "asc" },
      take: 500,
      select: {
        id: true,
        symbol: true,
        name: true,
        assetType: true,
        exchange: true,
        currency: true,
      },
    });

    return jsonOk({
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.transactionType,
        date: toDateKey(t.transactionDate),
        symbol: t.asset?.symbol ?? null,
        assetId: t.assetId,
        assetName: t.asset?.name ?? null,
        accountId: t.accountId,
        account: t.account.name,
        quantity: Number(t.quantity.toString()),
        unitPrice: Number(t.unitPrice.toString()),
        grossAmount: Number(t.grossAmount.toString()),
        commission: Number(t.commission.toString()),
        notes: t.notes,
      })),
      accounts,
      assets,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const body = await req.json();

    const accountId = String(body.accountId ?? "");
    const assetId = body.assetId ? String(body.assetId) : null;
    const transactionType = String(body.transactionType ?? "BUY");
    const transactionDate = new Date(String(body.transactionDate ?? new Date()));
    const quantity = Number(body.quantity ?? 0);
    const unitPrice = Number(body.unitPrice ?? 0);
    const commission = Number(body.commission ?? 0);
    const notes = body.notes ? String(body.notes) : null;

    if (!accountId) {
      return jsonError(new Error("Hesap seçimi gerekli."), 400);
    }

    const grossAmount = quantity * unitPrice;

    // İşlem para birimini varlıktan al (ör. ABD hissesi USD)
    let currency = "TRY";
    if (assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { currency: true },
      });
      if (asset?.currency) currency = asset.currency;
    }

    const tx = await prisma.transaction.create({
      data: {
        portfolioId,
        accountId,
        assetId,
        transactionType: transactionType as never,
        transactionDate,
        quantity,
        unitPrice,
        grossAmount,
        commission,
        currency,
        notes,
      },
      include: { asset: true, account: true },
    });

    const rebuilt = await rebuildSnapshotsFrom(portfolioId, transactionDate);

    return jsonOk({
      transaction: {
        id: tx.id,
        type: tx.transactionType,
        date: toDateKey(tx.transactionDate),
        symbol: tx.asset?.symbol ?? null,
        account: tx.account.name,
        quantity: Number(tx.quantity.toString()),
        unitPrice: Number(tx.unitPrice.toString()),
        grossAmount: Number(tx.grossAmount.toString()),
      },
      snapshotsRebuilt: rebuilt,
    });
  } catch (error) {
    return jsonError(error);
  }
}
