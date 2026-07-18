import { describe, expect, it } from "vitest";
import { buildRecommendations, normalizeClassWeights, resolveTargetWeights } from "@/lib/recommendations/engine";
import {
  computePortfolioRiskScore,
  isWithinRiskBand,
  scoreInstrument,
} from "@/lib/recommendations/scoring";
import type { HoldingInput } from "@/lib/recommendations/types";

describe("recommendation scoring", () => {
  it("yüksek vol ve DD risk skorunu yükseltir", () => {
    const low = computePortfolioRiskScore({
      annualizedVolatility: 0.1,
      maxDrawdown: 0.05,
      hhi: 0.15,
      cashWeight: 0.3,
    });
    const high = computePortfolioRiskScore({
      annualizedVolatility: 0.45,
      maxDrawdown: 0.35,
      hhi: 0.6,
      cashWeight: 0.02,
    });
    expect(high.toNumber()).toBeGreaterThan(low.toNumber());
  });

  it("near-low band enstrüman skorunu artırır", () => {
    const base: HoldingInput = {
      assetId: "1",
      symbol: "THYAO",
      assetClass: "EQUITY",
      weight: 0.2,
      marketValue: 100,
      annualizedVol: 0.3,
    };
    const nearLow = scoreInstrument({ ...base, bandSignal: 1 }, "BALANCED");
    const nearHigh = scoreInstrument({ ...base, bandSignal: -1 }, "BALANCED");
    expect(nearLow.toNumber()).toBeGreaterThan(nearHigh.toNumber());
  });

  it("risk bandı kontrolü çalışır", () => {
    expect(isWithinRiskBand(computePortfolioRiskScore({
      annualizedVolatility: 0.2,
      maxDrawdown: 0.1,
      hhi: 0.2,
      cashWeight: 0.1,
    }), "BALANCED")).toBeTypeOf("boolean");
  });
});

describe("recommendation engine", () => {
  it("hedef ağırlıkları normalize eder", () => {
    const w = resolveTargetWeights("BALANCED");
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("sınıf ağırlıklarını toplar", () => {
    const holdings: HoldingInput[] = [
      { assetId: "1", symbol: "A", assetClass: "EQUITY", weight: 0.5, marketValue: 50 },
      { assetId: "2", symbol: "B", assetClass: "CASH", weight: 0.5, marketValue: 50 },
    ];
    const cw = normalizeClassWeights(holdings);
    expect(cw.EQUITY).toBeCloseTo(0.5);
    expect(cw.CASH).toBeCloseTo(0.5);
  });

  it("aşırı nakit için SHIFT veya PARK önerir", () => {
    const holdings: HoldingInput[] = [
      { assetId: "1", symbol: "THYAO", assetClass: "EQUITY", weight: 0.2, marketValue: 20, bandSignal: 1 },
      { assetId: "2", symbol: "PBR", assetClass: "FUND", weight: 0.1, marketValue: 10, bandSignal: 0 },
      { assetId: "cash", symbol: "NAKİT", assetClass: "CASH", weight: 0.7, marketValue: 70 },
    ];
    const result = buildRecommendations({
      riskProfile: "BALANCED",
      riskInput: {
        annualizedVolatility: 0.15,
        maxDrawdown: 0.08,
        hhi: 0.25,
        cashWeight: 0.7,
      },
      holdings,
    });
    expect(result.recommendations.length).toBeGreaterThan(0);
    const actions = result.recommendations.map((r) => r.action);
    expect(actions.some((a) => a === "SHIFT_CLASS" || a === "PARK_CASH" || a === "INCREASE")).toBe(
      true
    );
  });

  it("hedefe yakınsa HOLD üretir", () => {
    const holdings: HoldingInput[] = [
      { assetId: "1", symbol: "THYAO", assetClass: "EQUITY", weight: 0.35, marketValue: 35 },
      { assetId: "2", symbol: "PBR", assetClass: "FUND", weight: 0.3, marketValue: 30 },
      { assetId: "3", symbol: "ALTIN", assetClass: "GOLD", weight: 0.15, marketValue: 15 },
      { assetId: "4", symbol: "USD", assetClass: "FX", weight: 0.1, marketValue: 10 },
      { assetId: "cash", symbol: "NAKİT", assetClass: "CASH", weight: 0.1, marketValue: 10 },
    ];
    const result = buildRecommendations({
      riskProfile: "BALANCED",
      riskInput: {
        annualizedVolatility: 0.18,
        maxDrawdown: 0.1,
        hhi: 0.2,
        cashWeight: 0.1,
      },
      holdings,
    });
    expect(result.recommendations.some((r) => r.action === "HOLD")).toBe(true);
  });

  it("aşırı hisse için DECREASE üretebilir", () => {
    const holdings: HoldingInput[] = [
      { assetId: "1", symbol: "THYAO", assetClass: "EQUITY", weight: 0.85, marketValue: 85, bandSignal: -1 },
      { assetId: "cash", symbol: "NAKİT", assetClass: "CASH", weight: 0.15, marketValue: 15 },
    ];
    const result = buildRecommendations({
      riskProfile: "CONSERVATIVE",
      riskInput: {
        annualizedVolatility: 0.4,
        maxDrawdown: 0.3,
        hhi: 0.7,
        cashWeight: 0.15,
      },
      holdings,
    });
    expect(result.recommendations.some((r) => r.action === "DECREASE")).toBe(true);
  });
});
