import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/auth/session";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { rebuildSnapshotsFrom } from "@/lib/services/snapshot-service";
import { parseDateKey, toDateKey } from "@/lib/utils/dates";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedTransaction(portfolioId: string, id: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { asset: true, account: true },
  });
  if (!tx || tx.portfolioId !== portfolioId) {
    throw new ForbiddenError("İşlem bulunamadı veya erişim yok.");
  }
  return tx;
}

function earlierDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const { id } = await context.params;
    const tx = await getOwnedTransaction(portfolioId, id);

    return jsonOk({
      transaction: {
        id: tx.id,
        type: tx.transactionType,
        date: toDateKey(tx.transactionDate),
        symbol: tx.asset?.symbol ?? null,
        assetId: tx.assetId,
        assetName: tx.asset?.name ?? null,
        accountId: tx.accountId,
        account: tx.account.name,
        quantity: Number(tx.quantity.toString()),
        unitPrice: Number(tx.unitPrice.toString()),
        grossAmount: Number(tx.grossAmount.toString()),
        commission: Number(tx.commission.toString()),
        notes: tx.notes,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const { id } = await context.params;
    const existing = await getOwnedTransaction(portfolioId, id);
    const body = await req.json();

    const accountId =
      body.accountId !== undefined ? String(body.accountId) : existing.accountId;
    const assetId =
      body.assetId !== undefined
        ? body.assetId
          ? String(body.assetId)
          : null
        : existing.assetId;
    const transactionType =
      body.transactionType !== undefined
        ? String(body.transactionType)
        : existing.transactionType;
    const transactionDate =
      body.transactionDate !== undefined
        ? parseDateKey(String(body.transactionDate))
        : existing.transactionDate;
    const quantity =
      body.quantity !== undefined
        ? Number(body.quantity)
        : Number(existing.quantity.toString());
    const unitPrice =
      body.unitPrice !== undefined
        ? Number(body.unitPrice)
        : Number(existing.unitPrice.toString());
    const commission =
      body.commission !== undefined
        ? Number(body.commission)
        : Number(existing.commission.toString());
    const notes =
      body.notes !== undefined
        ? body.notes
          ? String(body.notes)
          : null
        : existing.notes;

    if (!accountId) {
      return jsonError(new Error("Hesap seçimi gerekli."), 400);
    }

    let currency = existing.currency;
    if (assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { currency: true },
      });
      if (asset?.currency) currency = asset.currency;
    }

    const grossAmount = quantity * unitPrice;

    const tx = await prisma.transaction.update({
      where: { id },
      data: {
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

    const rebuildFrom = earlierDate(existing.transactionDate, transactionDate);
    const rebuilt = await rebuildSnapshotsFrom(portfolioId, rebuildFrom);

    return jsonOk({
      transaction: {
        id: tx.id,
        type: tx.transactionType,
        date: toDateKey(tx.transactionDate),
        symbol: tx.asset?.symbol ?? null,
        assetId: tx.assetId,
        assetName: tx.asset?.name ?? null,
        accountId: tx.accountId,
        account: tx.account.name,
        quantity: Number(tx.quantity.toString()),
        unitPrice: Number(tx.unitPrice.toString()),
        grossAmount: Number(tx.grossAmount.toString()),
        commission: Number(tx.commission.toString()),
        notes: tx.notes,
      },
      snapshotsRebuilt: rebuilt,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const { id } = await context.params;
    const existing = await getOwnedTransaction(portfolioId, id);

    await prisma.transaction.delete({ where: { id } });
    const rebuilt = await rebuildSnapshotsFrom(portfolioId, existing.transactionDate);

    return jsonOk({
      deleted: true,
      id,
      snapshotsRebuilt: rebuilt,
    });
  } catch (error) {
    return jsonError(error);
  }
}
