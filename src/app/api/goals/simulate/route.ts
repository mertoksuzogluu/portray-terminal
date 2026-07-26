import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolioId } from "@/lib/auth/session";
import { getLatestPortfolioSnapshot } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { simulateGoalShift } from "@/lib/goals/projection";
import type { ContributionGrowth, GoalTargetKind } from "@/lib/goals/types";

const schema = z.object({
  goalId: z.string().min(1),
  monthlyContribution: z.number().min(0).optional(),
  expectedReturnAnnual: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());

    const goal = await prisma.goal.findFirst({
      where: { id: body.goalId, userId: user.id, archivedAt: null },
    });
    if (!goal) {
      return jsonError(new Error("Hedef bulunamadı."), 404);
    }

    let currentValue = 0;
    const portfolioId = await getDefaultPortfolioId(user.id);
    if (portfolioId) {
      const snap = await getLatestPortfolioSnapshot(portfolioId);
      if (snap) currentValue = Number(snap.totalMarketValue.toString());
    }

    const base = {
      currentValue,
      targetAmount: Number(goal.targetAmount.toString()),
      targetKind: goal.targetKind as GoalTargetKind,
      targetDate: goal.targetDate,
      monthlyContribution: Number(goal.monthlyContribution.toString()),
      contributionGrowth: goal.contributionGrowth as ContributionGrowth,
      expectedReturnAnnual: Number(goal.expectedReturnAnnual.toString()),
    };

    const result = simulateGoalShift(base, {
      monthlyContribution: body.monthlyContribution,
      expectedReturnAnnual: body.expectedReturnAnnual,
    });

    // Bilinçli: hiçbir Goal / Transaction / Snapshot yazılmaz.
    return jsonOk({
      label: result.label,
      monthsShift: result.monthsShift,
      baseDate: result.baseDate?.toISOString().slice(0, 10) ?? null,
      simDate: result.simDate?.toISOString().slice(0, 10) ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
