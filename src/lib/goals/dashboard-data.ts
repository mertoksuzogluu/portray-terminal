import { prisma } from "@/lib/db/prisma";
import {
  getLatestPortfolioSnapshot,
  getPortfolioSnapshots,
} from "@/lib/api/portfolio-context";
import { getDefaultPortfolioId } from "@/lib/auth/session";
import { projectGoal } from "./projection";
import { serializeGoal } from "./serialize";
import { syncAchievements } from "./achievements";
import { getOrCreateCoach } from "./coach";
import type { ContributionGrowth, GoalTargetKind, GoalType } from "./types";

function num(v: { toString(): string } | number): number {
  return typeof v === "number" ? v : Number(v.toString());
}

export async function loadGoalsDashboard(userId: string, goalId?: string | null) {
  const goals = await prisma.goal.findMany({
    where: { userId, archivedAt: null },
    include: { freedomPrefs: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  if (goals.length === 0) {
    return { goals: [], activeGoal: null, dashboard: null };
  }

  const active =
    (goalId ? goals.find((g) => g.id === goalId) : null) ??
    goals.find((g) => g.isPrimary) ??
    goals[0];

  const portfolioId = await getDefaultPortfolioId(userId);
  let currentValue = 0;
  let previousValue: number | null = null;
  let valueAtYearStart: number | null = null;
  let investedCapital: number | null = null;
  let growth90dPct: number | null = null;
  let snapshotDate: string | null = null;

  if (portfolioId) {
    const latest = await getLatestPortfolioSnapshot(portfolioId);
    if (latest) {
      currentValue = num(latest.totalMarketValue);
      snapshotDate = latest.snapshotDate.toISOString().slice(0, 10);
      investedCapital = num(latest.investedCapital);
    }

    const snaps = await getPortfolioSnapshots(portfolioId, 400);
    if (snaps.length >= 2) {
      previousValue = num(snaps[snaps.length - 2].totalMarketValue);
    }
    const year = new Date().getFullYear();
    const earliestYear = snaps.find((s) => s.snapshotDate.getFullYear() === year);
    valueAtYearStart = earliestYear
      ? num(earliestYear.totalMarketValue)
      : snaps[0]
        ? num(snaps[0].totalMarketValue)
        : currentValue;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const around90 = [...snaps]
      .filter((s) => s.snapshotDate <= cutoff)
      .pop();
    if (around90 && currentValue > 0) {
      const old = num(around90.totalMarketValue);
      if (old > 0) growth90dPct = (currentValue - old) / old;
    }
  }

  const projection = projectGoal({
    currentValue,
    targetAmount: num(active.targetAmount),
    targetKind: active.targetKind as GoalTargetKind,
    targetDate: active.targetDate,
    monthlyContribution: num(active.monthlyContribution),
    contributionGrowth: active.contributionGrowth as ContributionGrowth,
    expectedReturnAnnual: num(active.expectedReturnAnnual),
    valueAtYearStart,
    previousValue,
  });

  // Freedom prefs override score target
  let freedomScore = projection.financialFreedom.score;
  let freedomYears = projection.financialFreedom.estimatedYears;
  let livingCost: number | null = null;
  let targetPassive: number | null = null;

  if (active.freedomPrefs) {
    livingCost = num(active.freedomPrefs.monthlyLivingCost);
    targetPassive = num(active.freedomPrefs.targetPassiveIncome);
    if (targetPassive > 0) {
      freedomScore = Math.min(
        1,
        projection.financialFreedom.monthlyPassiveProxy / targetPassive
      );
    }
  }

  const freedomReached = freedomScore >= 1;

  const achievements = await syncAchievements(userId, currentValue, {
    investedCapital,
    freedomReached,
  });

  const coach = await getOrCreateCoach(
    active.id,
    active.title,
    projection,
    growth90dPct
  );

  return {
    goals: goals.map(serializeGoal),
    activeGoal: serializeGoal(active),
    dashboard: {
      currentValue,
      snapshotDate,
      growth90dPct,
      projection: {
        ...projection,
        plannedDate: projection.plannedDate.toISOString().slice(0, 10),
        estimatedDate: projection.estimatedDate
          ? projection.estimatedDate.toISOString().slice(0, 10)
          : null,
        forecasts: projection.forecasts.map((f) => ({
          ...f,
          estimatedDate: f.estimatedDate
            ? f.estimatedDate.toISOString().slice(0, 10)
            : null,
        })),
        financialFreedom: {
          score: freedomScore,
          estimatedYears: freedomYears,
          monthlyPassiveProxy: projection.financialFreedom.monthlyPassiveProxy,
          monthlyLivingCost: livingCost,
          targetPassiveIncome: targetPassive,
        },
      },
      achievements,
      coach,
      goalMeta: {
        type: active.type as GoalType,
        title: active.title,
      },
    },
  };
}
