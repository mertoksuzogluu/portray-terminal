import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { loadGoalsDashboard } from "@/lib/goals/dashboard-data";
import { getOrCreateCoach } from "@/lib/goals/coach";
import { projectGoal } from "@/lib/goals/projection";
import type { ContributionGrowth, GoalTargetKind } from "@/lib/goals/types";
import { prisma } from "@/lib/db/prisma";
import { getDefaultPortfolioId } from "@/lib/auth/session";
import {
  getLatestPortfolioSnapshot,
  getPortfolioSnapshots,
} from "@/lib/api/portfolio-context";

const postSchema = z.object({
  goalId: z.string().min(1),
  force: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const goalId = req.nextUrl.searchParams.get("goalId");
    const data = await loadGoalsDashboard(user.id, goalId);
    if (!data.dashboard) {
      return jsonError(new Error("Hedef yok."), 404);
    }
    return jsonOk({ coach: data.dashboard.coach });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = postSchema.parse(await req.json());

    const goal = await prisma.goal.findFirst({
      where: { id: body.goalId, userId: user.id, archivedAt: null },
    });
    if (!goal) return jsonError(new Error("Hedef bulunamadı."), 404);

    let currentValue = 0;
    let growth90dPct: number | null = null;
    const portfolioId = await getDefaultPortfolioId(user.id);
    if (portfolioId) {
      const snap = await getLatestPortfolioSnapshot(portfolioId);
      if (snap) currentValue = Number(snap.totalMarketValue.toString());
      const snaps = await getPortfolioSnapshots(portfolioId, 120);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const around90 = [...snaps]
        .filter((s) => s.snapshotDate <= cutoff)
        .pop();
      if (around90 && currentValue > 0) {
        const old = Number(around90.totalMarketValue.toString());
        if (old > 0) growth90dPct = (currentValue - old) / old;
      }
    }

    const projection = projectGoal({
      currentValue,
      targetAmount: Number(goal.targetAmount.toString()),
      targetKind: goal.targetKind as GoalTargetKind,
      targetDate: goal.targetDate,
      monthlyContribution: Number(goal.monthlyContribution.toString()),
      contributionGrowth: goal.contributionGrowth as ContributionGrowth,
      expectedReturnAnnual: Number(goal.expectedReturnAnnual.toString()),
    });

    const coach = await getOrCreateCoach(
      goal.id,
      goal.title,
      projection,
      growth90dPct,
      body.force
    );

    return jsonOk({ coach });
  } catch (error) {
    return jsonError(error);
  }
}
