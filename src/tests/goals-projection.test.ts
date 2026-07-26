import { describe, expect, it } from "vitest";
import {
  estimateReachDate,
  formatAheadBehind,
  projectGoal,
  simulateGoalShift,
} from "@/lib/goals/projection";

describe("goals projection", () => {
  it("computes progress and remaining", () => {
    const r = projectGoal({
      currentValue: 10_450_000,
      targetAmount: 25_000_000,
      targetKind: "LUMP_SUM",
      targetDate: new Date("2032-12-31"),
      monthlyContribution: 100_000,
      contributionGrowth: "FIXED",
      expectedReturnAnnual: 0.2,
      asOf: new Date("2026-07-01"),
    });
    expect(r.progressPct).toBeCloseTo(41.8, 1);
    expect(r.remaining).toBeCloseTo(14_550_000, 0);
    expect(r.effectiveTarget).toBe(25_000_000);
  });

  it("estimates a reachable date with contributions", () => {
    const date = estimateReachDate(
      1_000_000,
      5_000_000,
      50_000,
      0.15,
      "FIXED",
      new Date("2026-01-01")
    );
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBeGreaterThanOrEqual(2026);
    expect(date!.getFullYear()).toBeLessThan(2040);
  });

  it("marks ahead when estimate is before plan", () => {
    const ab = formatAheadBehind(18);
    expect(ab.status).toBe("ahead");
    expect(ab.label).toContain("öndesin");
  });

  it("marks behind when estimate is after plan", () => {
    const ab = formatAheadBehind(-8);
    expect(ab.status).toBe("behind");
    expect(ab.label).toContain("geridesin");
  });

  it("what-if higher contribution pulls date forward", () => {
    const base = {
      currentValue: 5_000_000,
      targetAmount: 25_000_000,
      targetKind: "LUMP_SUM" as const,
      targetDate: new Date("2035-12-31"),
      monthlyContribution: 100_000,
      contributionGrowth: "FIXED" as const,
      expectedReturnAnnual: 0.18,
      asOf: new Date("2026-07-01"),
    };
    const shift = simulateGoalShift(base, { monthlyContribution: 200_000 });
    expect(shift.monthsShift).toBeGreaterThan(0);
    expect(shift.label).toMatch(/öne|aynı/);
  });

  it("monthly passive implies capital target", () => {
    const r = projectGoal({
      currentValue: 10_000_000,
      targetAmount: 200_000,
      targetKind: "MONTHLY_PASSIVE",
      targetDate: new Date("2032-12-31"),
      monthlyContribution: 50_000,
      contributionGrowth: "FIXED",
      expectedReturnAnnual: 0.2,
      asOf: new Date("2026-07-01"),
    });
    // 200k * 12 / 0.2 = 12M
    expect(r.effectiveTarget).toBeCloseTo(12_000_000, 0);
  });

  it("YTD actual uses 0 year-start when portfolio began this year", () => {
    const r = projectGoal({
      currentValue: 4_800_000,
      targetAmount: 25_000_000,
      targetKind: "LUMP_SUM",
      targetDate: new Date("2032-12-31"),
      monthlyContribution: 100_000,
      contributionGrowth: "FIXED",
      expectedReturnAnnual: 0.2,
      valueAtYearStart: 0,
      ytdMonthsElapsed: 0.3,
      asOf: new Date(Date.UTC(2026, 6, 26)),
    });
    expect(r.ytd.actual).toBeCloseTo(4_800_000, 0);
  });

  it("YTD actual subtracts prior-year closing value", () => {
    const r = projectGoal({
      currentValue: 12_000_000,
      targetAmount: 25_000_000,
      targetKind: "LUMP_SUM",
      targetDate: new Date("2032-12-31"),
      monthlyContribution: 100_000,
      contributionGrowth: "FIXED",
      expectedReturnAnnual: 0.2,
      valueAtYearStart: 10_000_000,
      ytdMonthsElapsed: 7,
      asOf: new Date(Date.UTC(2026, 6, 26)),
    });
    expect(r.ytd.actual).toBeCloseTo(2_000_000, 0);
  });
});
