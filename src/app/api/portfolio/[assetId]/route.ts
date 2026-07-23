import { prisma } from "@/lib/db/prisma";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { toDateKey } from "@/lib/utils/dates";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const { assetId } = await params;

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return jsonError(new Error("Varlık bulunamadı."), 404);
    }

    const [prices, positionSnaps, transactions] = await Promise.all([
      prisma.assetPrice.findMany({
        where: { assetId },
        orderBy: { priceDate: "asc" },
        take: 365,
      }),
      prisma.positionDailySnapshot.findMany({
        where: { portfolioId, assetId },
        orderBy: { snapshotDate: "desc" },
        take: 30,
        include: { asset: true },
      }),
      prisma.transaction.findMany({
        where: { portfolioId, assetId },
        orderBy: { transactionDate: "desc" },
        take: 20,
        include: { account: true },
      }),
    ]);

    const latestPosition = positionSnaps[0];

    const priceHistory = prices.map((p) => ({
      time: toDateKey(p.priceDate),
      open: p.open ? Number(p.open.toString()) : Number(p.close.toString()),
      high: p.high ? Number(p.high.toString()) : Number(p.close.toString()),
      low: p.low ? Number(p.low.toString()) : Number(p.close.toString()),
      close: Number(p.close.toString()),
      value: Number(p.close.toString()),
    }));

    return jsonOk({
      asset: {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        currency: asset.currency,
        exchange: asset.exchange,
      },
      position: latestPosition
        ? {
            quantity: Number(latestPosition.quantity.toString()),
            averageCost: Number(latestPosition.averageCost.toString()),
            marketPrice: Number(latestPosition.marketPrice.toString()),
            marketValue: Number(latestPosition.marketValue.toString()),
            unrealizedPnl: Number(latestPosition.unrealizedProfitLoss.toString()),
            dailyPnl: Number(latestPosition.dailyProfitLoss.toString()),
            dailyReturn:
              latestPosition.dailyReturn != null
                ? Number(latestPosition.dailyReturn.toString())
                : null,
            weight: latestPosition.portfolioWeight
              ? Number(latestPosition.portfolioWeight.toString())
              : null,
            snapshotDate: toDateKey(latestPosition.snapshotDate),
          }
        : null,
      priceHistory,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.transactionType,
        date: toDateKey(t.transactionDate),
        quantity: Number(t.quantity.toString()),
        unitPrice: Number(t.unitPrice.toString()),
        grossAmount: Number(t.grossAmount.toString()),
        account: t.account.name,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
