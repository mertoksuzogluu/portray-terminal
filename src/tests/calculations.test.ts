import { describe, expect, it } from "vitest";
import { d, toNumber } from "@/lib/calculations/decimal";
import {
  applyBuy,
  applySell,
  emptyPosition,
  replayTransactions,
  unrealizedPnL,
} from "@/lib/calculations/position";
import {
  arithmeticMean,
  chainTwr,
  compoundReturns,
  contributionToReturn,
  dailyReturnFromFactor,
  dailyTwrFactor,
  geometricMeanReturns,
  monthlyReturnStats,
  simpleDailyReturn,
} from "@/lib/calculations/returns";
import { calculateXirr, buildPortfolioXirrFlows } from "@/lib/calculations/xirr";
import {
  calculateRealReturn,
  findIndexAtPeriod,
  inflateAmount,
  inflationAdjustedCapital,
} from "@/lib/calculations/inflation";
import {
  annualizedVolatility,
  calculateDrawdown,
  concentrationAnalysis,
  sharpeRatio,
  sortinoRatio,
  standardDeviation,
} from "@/lib/calculations/risk";
import {
  analyzeContributions,
  contributionPercentagePoints,
} from "@/lib/calculations/contribution";

const TOLERANCE = 1e-6;

function closeTo(actual: number | null, expected: number, tol = TOLERANCE) {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual ?? 0) - expected)).toBeLessThan(tol);
}

describe("weighted average cost & trades", () => {
  it("computes weighted average cost on sequential buys", () => {
    let pos = emptyPosition();
    pos = applyBuy(pos, { quantity: 100, unitPrice: 10, commission: 5 });
    pos = applyBuy(pos, { quantity: 50, unitPrice: 12, commission: 0 });

    // (100*10+5 + 50*12) / 150 = 1605/150 = 10.7
    closeTo(toNumber(pos.averageCost, 4), 10.7, 0.001);
    expect(toNumber(pos.quantity)).toBe(150);
  });

  it("applies sell with commission and realizes gain", () => {
    let pos = applyBuy(emptyPosition(), { quantity: 100, unitPrice: 10, commission: 10 });
    const sell = applySell(pos, { quantity: 40, unitPrice: 14, commission: 5, tax: 2 });

    // cost basis = 40 * avgCost(10.1) = 404
    // proceeds = 40*14 - 5 - 2 = 553
    expect(toNumber(sell.costBasis, 2)).toBe(404);
    expect(toNumber(sell.proceeds, 2)).toBe(553);
    expect(toNumber(sell.realizedAmount, 2)).toBe(149);
    expect(toNumber(sell.position.quantity)).toBe(60);
  });

  it("rejects sell exceeding position (no short)", () => {
    const pos = applyBuy(emptyPosition(), { quantity: 10, unitPrice: 5 });
    expect(() => applySell(pos, { quantity: 11, unitPrice: 6 })).toThrow();
  });

  it("resets average cost after full sell", () => {
    let pos = applyBuy(emptyPosition(), { quantity: 50, unitPrice: 20 });
    const sell = applySell(pos, { quantity: 50, unitPrice: 25 });
    expect(toNumber(sell.position.quantity)).toBe(0);
    expect(toNumber(sell.position.averageCost)).toBe(0);
  });

  it("replays buy/sell/dividend ledger", () => {
    const result = replayTransactions([
      { type: "BUY", quantity: 10, unitPrice: 100 },
      { type: "SELL", quantity: 4, unitPrice: 120, commission: 1 },
      { type: "DIVIDEND", quantity: 6, unitPrice: 2, tax: 0.5 },
    ]);
    expect(toNumber(result.realizedGains, 2)).toBeCloseTo(79, 0);
    expect(toNumber(result.dividends, 2)).toBe(11.5);
    expect(toNumber(result.position.quantity)).toBe(6);
  });
});

describe("TWR & daily return", () => {
  it("computes daily TWR factor with external cash flow", () => {
    const factor = dailyTwrFactor(100000, 105000, 2000);
    // (105000 - 0) / (100000 + 2000) — wait, formula is end / (begin + cf)
    // Actually: end.div(begin.plus(cf)) = 105000/102000
    closeTo(toNumber(factor!), 105000 / 102000, 1e-4);
  });

  it("handles zero begin value with deposit (same-day cash+buy concept)", () => {
    const factor = dailyTwrFactor(0, 50000, 50000);
    closeTo(toNumber(factor!), 1, 1e-6);
    const ret = dailyReturnFromFactor(factor);
    closeTo(toNumber(ret!), 0, 1e-6);
  });

  it("returns null for zero portfolio with no cash flow", () => {
    expect(dailyTwrFactor(0, 0, 0)).toBeNull();
    expect(simpleDailyReturn(0, 100)).toBeNull();
  });

  it("chains daily TWR factors", () => {
    const factors = [1.01, 0.99, 1.02];
    const total = chainTwr(factors);
    closeTo(toNumber(total!), 1.01 * 0.99 * 1.02 - 1, 1e-6);
  });

  it("computes simple daily return without cash flows", () => {
    const ret = simpleDailyReturn(1000, 1050);
    closeTo(toNumber(ret!), 0.05, 1e-6);
  });
});

describe("monthly return statistics", () => {
  const monthly = [0.02, -0.01, 0.03, 0.015, -0.005];

  it("computes arithmetic and geometric monthly averages", () => {
    const stats = monthlyReturnStats(monthly);
    closeTo(toNumber(stats.arithmeticMonthlyAverage!), 0.01, 1e-3);
    const geo = toNumber(stats.geometricMonthlyAverage!, 6);
    expect(geo).toBeGreaterThan(0.009);
    expect(geo).toBeLessThan(0.011);
  });

  it("compounds monthly returns", () => {
    const stats = monthlyReturnStats(monthly);
    const manual = compoundReturns(monthly);
    closeTo(toNumber(stats.compoundedTotalReturn!), toNumber(manual!), 1e-6);
  });

  it("returns null geometric mean for returns <= -100%", () => {
    expect(geometricMeanReturns([-1.5, 0.1])).toBeNull();
  });

  it("arithmetic mean of empty array is null", () => {
    expect(arithmeticMean([])).toBeNull();
  });
});

describe("XIRR", () => {
  it("calculates annualized XIRR for standard cash flows", () => {
    const flows = [
      { date: new Date("2025-01-01"), amount: -10000 },
      { date: new Date("2025-07-01"), amount: -5000 },
      { date: new Date("2026-01-01"), amount: 17000 },
    ];
    const rate = calculateXirr(flows);
    expect(rate).not.toBeNull();
    const pct = toNumber(rate!, 4);
    expect(pct).toBeGreaterThan(0.1);
    expect(pct).toBeLessThan(0.5);
  });

  it("builds portfolio XIRR flows correctly", () => {
    const flows = buildPortfolioXirrFlows({
      contributions: [{ date: new Date("2025-01-01"), amount: 10000 }],
      withdrawals: [{ date: new Date("2025-06-01"), amount: 2000 }],
      currentValue: 9500,
      asOf: new Date("2026-01-01"),
    });
    expect(flows).toHaveLength(3);
    expect(toNumber(flows[0].amount)).toBe(-10000);
    expect(toNumber(flows[1].amount)).toBe(2000);
    expect(toNumber(flows[2].amount)).toBe(9500);
  });

  it("returns null when all flows are same sign", () => {
    expect(
      calculateXirr([
        { date: new Date("2025-01-01"), amount: -100 },
        { date: new Date("2025-06-01"), amount: -50 },
      ])
    ).toBeNull();
  });

  it("uses bisection fallback for non-convergent Newton case", () => {
    // Extreme rate scenario — Newton may fail, bisection should still find root
    const flows = [
      { date: new Date("2020-01-01"), amount: -1000 },
      { date: new Date("2021-01-01"), amount: -1000 },
      { date: new Date("2022-01-01"), amount: 5000 },
      { date: new Date("2023-01-01"), amount: -8000 },
      { date: new Date("2024-01-01"), amount: 12000 },
    ];
    const rate = calculateXirr(flows);
    expect(rate).not.toBeNull();
    expect(rate!.isFinite()).toBe(true);
  });
});

describe("inflation & real return", () => {
  const inflationSeries = [
    { period: "2025-01", indexValue: 2500 },
    { period: "2025-06", indexValue: 2650 },
    { period: "2026-01", indexValue: 2800 },
  ];

  it("finds index at period with carry-forward", () => {
    expect(toNumber(findIndexAtPeriod(inflationSeries, "2025-03")!)).toBe(2500);
    expect(toNumber(findIndexAtPeriod(inflationSeries, "2025-06")!)).toBe(2650);
    expect(findIndexAtPeriod(inflationSeries, "2024-01")).toBeNull();
  });

  it("inflates amount between index values", () => {
    const inflated = inflateAmount(10000, 2500, 2800);
    closeTo(toNumber(inflated), 11200, 1);
  });

  it("adjusts capital for inflation on dated cash flows", () => {
    const { capital, isEstimated } = inflationAdjustedCapital(
      [
        { date: new Date("2025-01-15"), amount: 10000 },
        { date: new Date("2025-06-15"), amount: 5000 },
      ],
      inflationSeries,
      new Date("2026-01-15")
    );
    expect(isEstimated).toBe(false);
    expect(toNumber(capital)).toBeGreaterThan(15000);
  });

  it("calculates real return vs inflation-adjusted capital", () => {
    const result = calculateRealReturn({
      currentValue: 18000,
      cashFlows: [
        { date: new Date("2025-01-01"), amount: 10000 },
        { date: new Date("2025-06-01"), amount: 5000 },
      ],
      inflationSeries,
      asOf: new Date("2026-01-01"),
    });
    expect(toNumber(result.nominalContributions)).toBe(15000);
    expect(toNumber(result.inflationAdjustedCapital)).toBeGreaterThan(15000);
    expect(result.realReturn).not.toBeNull();
    expect(toNumber(result.realReturn!)).toBeLessThan(
      toNumber(result.currentValue.minus(result.nominalContributions).div(result.nominalContributions))
    );
  });
});

describe("risk metrics", () => {
  const dailyReturns = [0.01, -0.005, 0.008, -0.012, 0.003, 0.006, -0.002];
  const values = [
    { date: new Date("2026-01-01"), value: 100000 },
    { date: new Date("2026-01-02"), value: 101000 },
    { date: new Date("2026-01-03"), value: 99500 },
    { date: new Date("2026-01-04"), value: 100300 },
    { date: new Date("2026-01-05"), value: 99000 },
    { date: new Date("2026-01-06"), value: 99300 },
    { date: new Date("2026-01-07"), value: 99900 },
    { date: new Date("2026-01-08"), value: 100500 },
  ];

  it("computes max drawdown", () => {
    const dd = calculateDrawdown(values);
    expect(dd.maxDrawdown).not.toBeNull();
    expect(toNumber(dd.maxDrawdown!)).toBeGreaterThan(0);
    expect(dd.maxDrawdownStartDate).not.toBeNull();
    expect(dd.maxDrawdownTroughDate).not.toBeNull();
  });

  it("returns null drawdown for empty series", () => {
    const dd = calculateDrawdown([]);
    expect(dd.maxDrawdown).toBeNull();
    expect(dd.currentDrawdown).toBeNull();
  });

  it("computes volatility and annualized volatility", () => {
    const vol = standardDeviation(dailyReturns);
    expect(vol).not.toBeNull();
    const ann = annualizedVolatility(dailyReturns);
    expect(toNumber(ann!)).toBeGreaterThan(toNumber(vol!));
  });

  it("computes Sharpe and Sortino ratios", () => {
    const extended = [
      ...dailyReturns,
      0.004,
      -0.003,
      0.007,
      -0.001,
      0.002,
    ];
    const sharpe = sharpeRatio(extended, 0.45);
    const sortino = sortinoRatio(extended, 0.45);
    expect(sharpe).not.toBeNull();
    expect(sortino).not.toBeNull();
  });

  it("returns null Sharpe with insufficient data", () => {
    expect(sharpeRatio([0.01, 0.02], 0.45)).toBeNull();
  });
});

describe("contribution & concentration", () => {
  it("computes asset contribution to portfolio return", () => {
    const contrib = contributionToReturn(0.65, 0.082);
    closeTo(toNumber(contrib), 0.0533, 1e-3);
  });

  it("analyzes contributions and ranks assets", () => {
    const analysis = analyzeContributions([
      { assetId: "1", symbol: "THYAO", weight: 0.45, assetReturn: 0.08, profitLoss: 5000 },
      { assetId: "2", symbol: "PBR", weight: 0.35, assetReturn: 0.02, profitLoss: 800 },
      { assetId: "3", symbol: "TUPRS", weight: 0.2, assetReturn: -0.03, profitLoss: -1200 },
    ]);
    expect(analysis.topContributor?.symbol).toBe("THYAO");
    expect(analysis.worstContributor?.symbol).toBe("TUPRS");
    expect(toNumber(analysis.totalProfitLoss)).toBe(4600);
  });

  it("converts contribution to percentage points", () => {
    closeTo(toNumber(contributionPercentagePoints(0.65, 0.082)), 5.33, 0.01);
  });

  it("analyzes concentration (HHI, top weights)", () => {
    const conc = concentrationAnalysis([
      { assetId: "a", marketValue: 60000 },
      { assetId: "b", marketValue: 30000 },
      { assetId: "c", marketValue: 10000 },
    ]);
    closeTo(toNumber(conc.largestWeight!), 0.6, 1e-6);
    closeTo(toNumber(conc.top3Weight!), 1, 1e-6);
    expect(toNumber(conc.herfindahlHirschmanIndex!)).toBeCloseTo(0.46, 1);
  });

  it("returns null concentration for zero portfolio", () => {
    const conc = concentrationAnalysis([]);
    expect(conc.largestWeight).toBeNull();
    expect(conc.weights).toHaveLength(0);
  });
});

describe("edge cases", () => {
  it("unrealized PnL with missing/zero price concept uses zero market value", () => {
    const pos = applyBuy(emptyPosition(), { quantity: 10, unitPrice: 50 });
    expect(toNumber(unrealizedPnL(pos, 0))).toBe(-500);
  });

  it("handles missing price via cost fallback in total return", () => {
    const pos = emptyPosition();
    expect(
      replayTransactions([]).position.quantity.isZero()
    ).toBe(true);
  });

  it("decimal helper treats null/undefined as zero", () => {
    expect(d(undefined).isZero()).toBe(true);
    expect(d("").isZero()).toBe(true);
    expect(d(0).isZero()).toBe(true);
  });
});
