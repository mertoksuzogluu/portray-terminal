import { d, Decimal, type DecimalInput } from "./decimal";
import { contributionToReturn } from "./returns";

export interface AssetContributionInput {
  assetId: string;
  symbol: string;
  weight: DecimalInput;
  assetReturn: DecimalInput;
  marketValue?: DecimalInput;
  profitLoss?: DecimalInput;
}

export interface AssetContribution {
  assetId: string;
  symbol: string;
  weight: Decimal;
  assetReturn: Decimal;
  contributionPoints: Decimal;
  profitLoss: Decimal;
}

export interface ContributionAnalysis {
  items: AssetContribution[];
  topContributor: AssetContribution | null;
  worstContributor: AssetContribution | null;
  totalProfitLoss: Decimal;
}

export function analyzeContributions(
  assets: AssetContributionInput[]
): ContributionAnalysis {
  const items: AssetContribution[] = assets.map((a) => ({
    assetId: a.assetId,
    symbol: a.symbol,
    weight: d(a.weight),
    assetReturn: d(a.assetReturn),
    contributionPoints: contributionToReturn(a.weight, a.assetReturn),
    profitLoss: d(a.profitLoss ?? 0),
  }));

  items.sort((a, b) => b.contributionPoints.cmp(a.contributionPoints));

  const totalProfitLoss = items.reduce(
    (acc, i) => acc.plus(i.profitLoss),
    d(0)
  );

  return {
    items,
    topContributor: items[0] ?? null,
    worstContributor: items.length ? items[items.length - 1] : null,
    totalProfitLoss,
  };
}

/**
 * Örnek: ağırlık %65, getiri %8.20 → katkı ≈ 5.33 puan
 */
export function contributionPercentagePoints(
  weightRatio: DecimalInput,
  returnRatio: DecimalInput
): Decimal {
  return d(weightRatio).times(d(returnRatio)).times(100);
}

export function shareOfProfit(
  assetProfit: DecimalInput,
  totalProfit: DecimalInput
): Decimal | null {
  const total = d(totalProfit);
  if (total.isZero()) return null;
  return d(assetProfit).div(total);
}
