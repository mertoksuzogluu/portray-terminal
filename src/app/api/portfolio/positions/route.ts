import { prisma } from "@/lib/db/prisma";
import { getPortfolioPositions } from "@/lib/services/position-engine";
import {
  getLatestPositionSnapshots,
  requirePortfolioContext,
} from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function GET() {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const [positions, latestSnaps] = await Promise.all([
      getPortfolioPositions(portfolioId),
      getLatestPositionSnapshots(portfolioId),
    ]);

    const snapMap = new Map(
      latestSnaps.map((s) => [
        s.assetId,
        {
          dailyPnl: Number(s.dailyProfitLoss.toString()),
          dailyReturn:
            s.dailyReturn != null ? Number(s.dailyReturn.toString()) : null,
          weight:
            s.portfolioWeight != null
              ? Number(s.portfolioWeight.toString())
              : null,
        },
      ])
    );

    const assetIds = positions.byAsset.map((p) => p.assetId);
    const prices = await prisma.assetPrice.findMany({
      where: { assetId: { in: assetIds } },
      orderBy: [{ priceDate: "desc" }, { fetchedAt: "desc" }],
      distinct: ["assetId"],
    });
    const priceMap = new Map(prices.map((p) => [p.assetId, p]));

    const rows = positions.byAsset.map((p) => {
      const price = priceMap.get(p.assetId);
      const marketPrice = price
        ? Number(price.close.toString())
        : Number(p.averageCost.toString());
      const qty = Number(p.quantity.toString());
      const avgCost = Number(p.averageCost.toString());
      const marketValue = qty * marketPrice;
      const costBasis = qty * avgCost;
      const unrealized = marketValue - costBasis;
      const totalReturn = costBasis > 0 ? unrealized / costBasis : 0;
      const snap = snapMap.get(p.assetId);

      return {
        assetId: p.assetId,
        symbol: p.symbol,
        name: p.name,
        assetType: p.assetType,
        quantity: qty,
        averageCost: avgCost,
        marketPrice,
        marketValue,
        unrealizedPnl: unrealized,
        dailyPnl: snap?.dailyPnl ?? 0,
        dailyReturn: snap?.dailyReturn ?? null,
        totalReturn,
        realizedGain: Number(p.realizedGain.toString()),
        dividends: Number(p.dividends.toString()),
        accounts: p.accounts,
        dataQuality: price?.dataQuality ?? "MANUAL",
      };
    });

    const totalValue = rows.reduce((acc, r) => acc + r.marketValue, 0);

    return jsonOk({
      positions: rows.map((r) => ({
        ...r,
        weight: totalValue > 0 ? r.marketValue / totalValue : 0,
      })),
      totalValue,
    });
  } catch (error) {
    return jsonError(error);
  }
}
