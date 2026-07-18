import { d, type Decimal } from "@/lib/calculations/decimal";
import type { HoldingInput, RiskProfileId, RiskScoreInput } from "./types";
import { RISK_SCORE_TARGETS } from "./types";

/**
 * Portföy risk skoru 0–100.
 * Yüksek volatilite / drawdown / yoğunlaşma skoru yükseltir; nakit düşürür.
 */
export function computePortfolioRiskScore(input: RiskScoreInput): Decimal {
  const vol = input.annualizedVolatility ?? 0.2;
  // %40 yıllık vol ≈ 80 puan
  const volScore = Math.min(100, (vol / 0.5) * 100);

  const dd = Math.abs(input.maxDrawdown ?? 0);
  // %40 DD ≈ 100 puan
  const ddScore = Math.min(100, (dd / 0.4) * 100);

  const hhi = input.hhi ?? 0.2;
  // HHI 1.0 (tek varlık) = 100; 1/n iyi çeşitlilik düşük
  const hhiScore = Math.min(100, hhi * 100);

  const cash = Math.max(0, Math.min(1, input.cashWeight));
  const cashRelief = cash * 40; // nakit riski düşürür

  const raw = volScore * 0.4 + ddScore * 0.3 + hhiScore * 0.2 + (1 - cash) * 10 - cashRelief * 0.25;
  return d(Math.max(0, Math.min(100, raw)));
}

/** Sınıf içi enstrüman skoru 0–100 (yüksek = almaya daha uygun). */
export function scoreInstrument(holding: HoldingInput, riskProfile: RiskProfileId): Decimal {
  let score = 50;

  // Band: near low (+), near high (-)
  const band = holding.bandSignal ?? 0;
  score += band * 20;

  // Volatilite cezası — muhafazakârda daha ağır
  const vol = holding.annualizedVol ?? 0.25;
  const volPenaltyMult =
    riskProfile === "CONSERVATIVE" ? 40 : riskProfile === "BALANCED" ? 25 : riskProfile === "GROWTH" ? 15 : 8;
  score -= Math.min(35, vol * volPenaltyMult);

  // Veri kalitesi
  score -= (holding.dataQualityPenalty ?? 0) * 15;

  // Nakit / fon likidite primi
  if (holding.assetClass === "CASH" || holding.assetClass === "FUND") {
    score += 5;
  }

  return d(Math.max(0, Math.min(100, score)));
}

export function estimatePostTradeRiskScore(
  current: Decimal,
  netEquityDelta: number,
  netCashDelta: number
): Decimal {
  // Basit yaklaşım: hisse artırımı riski yükseltir, nakit artırımı düşürür
  const delta = netEquityDelta * 40 - netCashDelta * 25;
  return d(Math.max(0, Math.min(100, current.toNumber() + delta)));
}

export function isWithinRiskBand(score: Decimal, profile: RiskProfileId): boolean {
  const band = RISK_SCORE_TARGETS[profile];
  const v = score.toNumber();
  return v >= band.min && v <= band.max;
}
