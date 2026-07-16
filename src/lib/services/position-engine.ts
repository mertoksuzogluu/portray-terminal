import { prisma } from "@/lib/db/prisma";
import {
  applyBonusIssue,
  applyBuy,
  applyRightsIssue,
  applySell,
  applySplit,
  emptyPosition,
  type PositionState,
} from "@/lib/calculations/position";
import { d, Decimal } from "@/lib/calculations/decimal";
import type { TransactionType } from "@prisma/client";

export interface PositionView {
  assetId: string;
  accountId: string;
  symbol: string;
  name: string;
  assetType: string;
  accountName: string;
  quantity: Decimal;
  averageCost: Decimal;
  totalCost: Decimal;
  realizedGain: Decimal;
  dividends: Decimal;
}

export interface PortfolioPositions {
  byAccount: PositionView[];
  byAsset: Array<Omit<PositionView, "accountId" | "accountName"> & {
    accounts: string[];
  }>;
}

type TxRow = {
  id: string;
  accountId: string;
  assetId: string | null;
  transactionType: TransactionType;
  quantity: { toString(): string };
  unitPrice: { toString(): string };
  commission: { toString(): string };
  tax: { toString(): string };
  otherCost: { toString(): string };
  fxRateToBase: { toString(): string };
  transactionDate: Date;
  asset: {
    id: string;
    symbol: string;
    name: string;
    assetType: string;
  } | null;
  account: { id: string; name: string };
};

function keyOf(accountId: string, assetId: string): string {
  return `${accountId}::${assetId}`;
}

export function computePositionsFromTransactions(
  transactions: TxRow[]
): Map<string, PositionView> {
  const map = new Map<
    string,
    {
      state: PositionState;
      realized: Decimal;
      dividends: Decimal;
      meta: Omit<PositionView, "quantity" | "averageCost" | "totalCost" | "realizedGain" | "dividends">;
    }
  >();

  const sorted = [...transactions].sort(
    (a, b) =>
      a.transactionDate.getTime() - b.transactionDate.getTime() ||
      a.id.localeCompare(b.id)
  );

  for (const tx of sorted) {
    if (!tx.assetId || !tx.asset) continue;

    const k = keyOf(tx.accountId, tx.assetId);
    let entry = map.get(k);
    if (!entry) {
      entry = {
        state: emptyPosition(),
        realized: d(0),
        dividends: d(0),
        meta: {
          assetId: tx.assetId,
          accountId: tx.accountId,
          symbol: tx.asset.symbol,
          name: tx.asset.name,
          assetType: tx.asset.assetType,
          accountName: tx.account.name,
        },
      };
      map.set(k, entry);
    }

    const qty = d(tx.quantity.toString());
    const price = d(tx.unitPrice.toString()).times(d(tx.fxRateToBase.toString()));
    const commission = d(tx.commission.toString()).times(d(tx.fxRateToBase.toString()));
    const tax = d(tx.tax.toString()).times(d(tx.fxRateToBase.toString()));
    const otherCost = d(tx.otherCost.toString()).times(d(tx.fxRateToBase.toString()));

    switch (tx.transactionType) {
      case "BUY":
      case "TRANSFER_IN":
        entry.state = applyBuy(entry.state, {
          quantity: qty,
          unitPrice: price,
          commission,
          tax,
          otherCost,
        });
        break;
      case "SELL":
      case "TRANSFER_OUT": {
        const result = applySell(entry.state, {
          quantity: qty,
          unitPrice: price,
          commission,
          tax,
          otherCost,
        });
        entry.state = result.position;
        entry.realized = entry.realized.plus(result.realizedAmount);
        break;
      }
      case "BONUS_ISSUE":
        // quantity alanı bedelsiz oran olarak yorumlanır (örn. 0.2 = %20)
        entry.state = applyBonusIssue(entry.state, qty);
        break;
      case "SPLIT":
        entry.state = applySplit(entry.state, qty.isZero() ? 1 : qty);
        break;
      case "RIGHTS_ISSUE":
        entry.state = applyRightsIssue(entry.state, qty, price, commission);
        break;
      case "DIVIDEND":
      case "FUND_DISTRIBUTION":
        entry.dividends = entry.dividends.plus(
          qty.times(price).minus(tax)
        );
        break;
      default:
        break;
    }
  }

  const result = new Map<string, PositionView>();
  for (const [k, entry] of map) {
    if (entry.state.quantity.isZero() && entry.realized.isZero()) continue;
    result.set(k, {
      ...entry.meta,
      quantity: entry.state.quantity,
      averageCost: entry.state.averageCost,
      totalCost: entry.state.totalCost,
      realizedGain: entry.realized,
      dividends: entry.dividends,
    });
  }
  return result;
}

export async function getPortfolioPositions(
  portfolioId: string,
  asOf?: Date
): Promise<PortfolioPositions> {
  const transactions = await prisma.transaction.findMany({
    where: {
      portfolioId,
      ...(asOf
        ? { transactionDate: { lte: asOf } }
        : {}),
    },
    include: {
      asset: true,
      account: true,
    },
    orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
  });

  const byAccountMap = computePositionsFromTransactions(transactions);
  const byAccount = [...byAccountMap.values()].filter((p) => p.quantity.gt(0));

  const assetMap = new Map<
    string,
    Omit<PositionView, "accountId" | "accountName"> & { accounts: string[]; totalCost: Decimal; quantity: Decimal }
  >();

  for (const pos of byAccount) {
    const existing = assetMap.get(pos.assetId);
    if (!existing) {
      assetMap.set(pos.assetId, {
        assetId: pos.assetId,
        symbol: pos.symbol,
        name: pos.name,
        assetType: pos.assetType,
        quantity: pos.quantity,
        averageCost: pos.averageCost,
        totalCost: pos.totalCost,
        realizedGain: pos.realizedGain,
        dividends: pos.dividends,
        accounts: [pos.accountName],
      });
    } else {
      const newQty = existing.quantity.plus(pos.quantity);
      const newCost = existing.totalCost.plus(pos.totalCost);
      existing.quantity = newQty;
      existing.totalCost = newCost;
      existing.averageCost = newQty.isZero() ? d(0) : newCost.div(newQty);
      existing.realizedGain = existing.realizedGain.plus(pos.realizedGain);
      existing.dividends = existing.dividends.plus(pos.dividends);
      existing.accounts.push(pos.accountName);
    }
  }

  return {
    byAccount,
    byAsset: [...assetMap.values()],
  };
}

export function computeCashBalance(transactions: Array<{
  transactionType: TransactionType;
  grossAmount: { toString(): string };
  quantity: { toString(): string };
  unitPrice: { toString(): string };
  commission: { toString(): string };
  tax: { toString(): string };
  otherCost: { toString(): string };
  fxRateToBase: { toString(): string };
  assetId: string | null;
}>): Decimal {
  let cash = d(0);

  for (const tx of transactions) {
    const fx = d(tx.fxRateToBase.toString());
    const gross = d(tx.grossAmount.toString()).times(fx);
    const qty = d(tx.quantity.toString());
    const price = d(tx.unitPrice.toString()).times(fx);
    const fees = d(tx.commission.toString())
      .plus(tx.tax.toString())
      .plus(tx.otherCost.toString())
      .times(fx);

    switch (tx.transactionType) {
      case "CASH_DEPOSIT":
      case "TRANSFER_IN":
        if (!tx.assetId) cash = cash.plus(gross.isZero() ? qty.times(price) : gross);
        break;
      case "CASH_WITHDRAWAL":
      case "TRANSFER_OUT":
        if (!tx.assetId) cash = cash.minus(gross.isZero() ? qty.times(price) : gross);
        break;
      case "BUY":
        cash = cash.minus(qty.times(price).plus(fees));
        break;
      case "SELL":
        cash = cash.plus(qty.times(price).minus(fees));
        break;
      case "DIVIDEND":
      case "FUND_DISTRIBUTION":
        cash = cash.plus(qty.times(price).minus(d(tx.tax.toString()).times(fx)));
        break;
      case "COMMISSION":
      case "TAX":
        cash = cash.minus(gross.isZero() ? fees : gross);
        break;
      default:
        break;
    }
  }

  return cash;
}
