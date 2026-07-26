import type { ContributionGrowth, GoalTargetKind, GoalType } from "./types";

type GoalRow = {
  id: string;
  type: GoalType;
  title: string;
  targetAmount: { toString(): string };
  targetKind: GoalTargetKind;
  targetDate: Date;
  monthlyContribution: { toString(): string };
  contributionGrowth: ContributionGrowth;
  expectedReturnAnnual: { toString(): string };
  isPrimary: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  freedomPrefs?: {
    monthlyLivingCost: { toString(): string };
    targetPassiveIncome: { toString(): string };
  } | null;
};

export function serializeGoal(g: GoalRow) {
  return {
    id: g.id,
    type: g.type,
    title: g.title,
    targetAmount: Number(g.targetAmount.toString()),
    targetKind: g.targetKind,
    targetDate: g.targetDate.toISOString().slice(0, 10),
    monthlyContribution: Number(g.monthlyContribution.toString()),
    contributionGrowth: g.contributionGrowth,
    expectedReturnAnnual: Number(g.expectedReturnAnnual.toString()),
    isPrimary: g.isPrimary,
    archivedAt: g.archivedAt?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    freedomPrefs: g.freedomPrefs
      ? {
          monthlyLivingCost: Number(g.freedomPrefs.monthlyLivingCost.toString()),
          targetPassiveIncome: Number(
            g.freedomPrefs.targetPassiveIncome.toString()
          ),
        }
      : null,
  };
}
