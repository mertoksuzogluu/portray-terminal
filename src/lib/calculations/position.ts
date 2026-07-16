import { d, Decimal, type DecimalInput } from "./decimal";

export interface PositionState {
  quantity: Decimal;
  totalCost: Decimal;
  averageCost: Decimal;
}

export interface BuyInput {
  quantity: DecimalInput;
  unitPrice: DecimalInput;
  commission?: DecimalInput;
  tax?: DecimalInput;
  otherCost?: DecimalInput;
}

export interface SellInput {
  quantity: DecimalInput;
  unitPrice: DecimalInput;
  commission?: DecimalInput;
  tax?: DecimalInput;
  otherCost?: DecimalInput;
}

export interface SellResult {
  position: PositionState;
  realizedAmount: Decimal;
  costBasis: Decimal;
  proceeds: Decimal;
}

export function emptyPosition(): PositionState {
  return {
    quantity: d(0),
    totalCost: d(0),
    averageCost: d(0),
  };
}

export function applyBuy(position: PositionState, input: BuyInput): PositionState {
  const qty = d(input.quantity);
  if (qty.lte(0)) {
    throw new Error("Alış miktarı sıfırdan büyük olmalıdır.");
  }

  const unitPrice = d(input.unitPrice);
  const commission = d(input.commission ?? 0);
  const tax = d(input.tax ?? 0);
  const otherCost = d(input.otherCost ?? 0);
  const tradeCost = qty.times(unitPrice).plus(commission).plus(tax).plus(otherCost);

  const newQuantity = position.quantity.plus(qty);
  const newTotalCost = position.totalCost.plus(tradeCost);
  const averageCost = newQuantity.isZero()
    ? d(0)
    : newTotalCost.div(newQuantity);

  return {
    quantity: newQuantity,
    totalCost: newTotalCost,
    averageCost,
  };
}

export function applySell(position: PositionState, input: SellInput): SellResult {
  const qty = d(input.quantity);
  if (qty.lte(0)) {
    throw new Error("Satış miktarı sıfırdan büyük olmalıdır.");
  }
  if (qty.gt(position.quantity)) {
    throw new Error("Negatif pozisyona izin verilmez. Satış miktarı eldeki adetten fazla.");
  }

  const unitPrice = d(input.unitPrice);
  const commission = d(input.commission ?? 0);
  const tax = d(input.tax ?? 0);
  const otherCost = d(input.otherCost ?? 0);

  const costBasis = position.averageCost.times(qty);
  const proceeds = qty.times(unitPrice).minus(commission).minus(tax).minus(otherCost);
  const realizedAmount = proceeds.minus(costBasis);

  const remainingQty = position.quantity.minus(qty);
  const remainingCost = remainingQty.isZero()
    ? d(0)
    : position.averageCost.times(remainingQty);

  return {
    position: {
      quantity: remainingQty,
      totalCost: remainingCost,
      averageCost: remainingQty.isZero() ? d(0) : position.averageCost,
    },
    realizedAmount,
    costBasis,
    proceeds,
  };
}

export function applyBonusIssue(
  position: PositionState,
  bonusRatio: DecimalInput
): PositionState {
  const ratio = d(bonusRatio);
  if (ratio.lte(0)) return position;
  const bonusQty = position.quantity.times(ratio);
  const newQty = position.quantity.plus(bonusQty);
  return {
    quantity: newQty,
    totalCost: position.totalCost,
    averageCost: newQty.isZero() ? d(0) : position.totalCost.div(newQty),
  };
}

export function applySplit(
  position: PositionState,
  splitRatio: DecimalInput
): PositionState {
  const ratio = d(splitRatio);
  if (ratio.lte(0)) {
    throw new Error("Bölünme oranı sıfırdan büyük olmalıdır.");
  }
  const newQty = position.quantity.times(ratio);
  return {
    quantity: newQty,
    totalCost: position.totalCost,
    averageCost: newQty.isZero() ? d(0) : position.totalCost.div(newQty),
  };
}

export function applyRightsIssue(
  position: PositionState,
  rightsQuantity: DecimalInput,
  rightsPrice: DecimalInput,
  commission: DecimalInput = 0
): PositionState {
  return applyBuy(position, {
    quantity: rightsQuantity,
    unitPrice: rightsPrice,
    commission,
  });
}

export function unrealizedPnL(
  position: PositionState,
  marketPrice: DecimalInput
): Decimal {
  const marketValue = position.quantity.times(d(marketPrice));
  return marketValue.minus(position.totalCost);
}

export function marketValue(
  quantity: DecimalInput,
  marketPrice: DecimalInput
): Decimal {
  return d(quantity).times(d(marketPrice));
}

export function totalReturnRatio(
  position: PositionState,
  marketPrice: DecimalInput,
  realizedAmount: DecimalInput = 0
): Decimal | null {
  if (position.totalCost.isZero() && d(realizedAmount).isZero()) {
    return null;
  }
  const cost = position.totalCost.isZero()
    ? d(realizedAmount).abs()
    : position.totalCost;
  if (cost.isZero()) return null;
  const totalPnL = unrealizedPnL(position, marketPrice).plus(d(realizedAmount));
  return totalPnL.div(cost);
}

export type LedgerTxType =
  | "BUY"
  | "SELL"
  | "BONUS_ISSUE"
  | "RIGHTS_ISSUE"
  | "SPLIT"
  | "DIVIDEND"
  | "OTHER";

export interface LedgerTransaction {
  type: LedgerTxType;
  quantity: DecimalInput;
  unitPrice: DecimalInput;
  commission?: DecimalInput;
  tax?: DecimalInput;
  otherCost?: DecimalInput;
  /** SPLIT/BONUS için oran; RIGHTS için ek adet */
  ratio?: DecimalInput;
}

export interface LedgerResult {
  position: PositionState;
  realizedGains: Decimal;
  dividends: Decimal;
}

export function replayTransactions(transactions: LedgerTransaction[]): LedgerResult {
  let position = emptyPosition();
  let realizedGains = d(0);
  let dividends = d(0);

  for (const tx of transactions) {
    switch (tx.type) {
      case "BUY":
      case "RIGHTS_ISSUE":
        position = applyBuy(position, tx);
        break;
      case "SELL": {
        const result = applySell(position, tx);
        position = result.position;
        realizedGains = realizedGains.plus(result.realizedAmount);
        break;
      }
      case "BONUS_ISSUE":
        position = applyBonusIssue(position, tx.ratio ?? tx.quantity);
        break;
      case "SPLIT":
        position = applySplit(position, tx.ratio ?? tx.quantity);
        break;
      case "DIVIDEND":
        dividends = dividends.plus(
          d(tx.quantity).times(d(tx.unitPrice)).minus(d(tx.tax ?? 0))
        );
        break;
      default:
        break;
    }
  }

  return { position, realizedGains, dividends };
}
