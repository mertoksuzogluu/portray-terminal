import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { serializeGoal } from "@/lib/goals/serialize";

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  targetAmount: z.number().positive().optional(),
  targetKind: z.enum(["LUMP_SUM", "MONTHLY_PASSIVE"]).optional(),
  targetDate: z.string().min(8).optional(),
  monthlyContribution: z.number().min(0).optional(),
  contributionGrowth: z
    .enum(["FIXED", "ANNUAL_INCREASE", "SALARY_LINKED", "UNSURE"])
    .optional(),
  expectedReturnAnnual: z.number().min(0).max(2).optional(),
  isPrimary: z.boolean().optional(),
  archive: z.boolean().optional(),
  freedomPrefs: z
    .object({
      monthlyLivingCost: z.number().min(0),
      targetPassiveIncome: z.number().min(0),
    })
    .optional()
    .nullable(),
});

async function getOwnedGoal(userId: string, id: string) {
  return prisma.goal.findFirst({
    where: { id, userId },
    include: { freedomPrefs: true },
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const goal = await getOwnedGoal(user.id, id);
    if (!goal || goal.archivedAt) {
      return jsonError(new Error("Hedef bulunamadı."), 404);
    }
    return jsonOk({ goal: serializeGoal(goal) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await getOwnedGoal(user.id, id);
    if (!existing) {
      return jsonError(new Error("Hedef bulunamadı."), 404);
    }

    const body = patchSchema.parse(await req.json());

    if (body.isPrimary) {
      await prisma.goal.updateMany({
        where: { userId: user.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    if (body.freedomPrefs === null) {
      await prisma.goalFreedomPrefs.deleteMany({ where: { goalId: id } });
    } else if (body.freedomPrefs) {
      await prisma.goalFreedomPrefs.upsert({
        where: { goalId: id },
        create: {
          goalId: id,
          monthlyLivingCost: body.freedomPrefs.monthlyLivingCost,
          targetPassiveIncome: body.freedomPrefs.targetPassiveIncome,
        },
        update: {
          monthlyLivingCost: body.freedomPrefs.monthlyLivingCost,
          targetPassiveIncome: body.freedomPrefs.targetPassiveIncome,
        },
      });
    }

    const goal = await prisma.goal.update({
      where: { id },
      data: {
        title: body.title,
        targetAmount: body.targetAmount,
        targetKind: body.targetKind,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
        monthlyContribution: body.monthlyContribution,
        contributionGrowth: body.contributionGrowth,
        expectedReturnAnnual: body.expectedReturnAnnual,
        isPrimary: body.isPrimary,
        archivedAt: body.archive ? new Date() : undefined,
      },
      include: { freedomPrefs: true },
    });

    return jsonOk({ goal: serializeGoal(goal) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await getOwnedGoal(user.id, id);
    if (!existing) {
      return jsonError(new Error("Hedef bulunamadı."), 404);
    }

    await prisma.goal.update({
      where: { id },
      data: { archivedAt: new Date(), isPrimary: false },
    });

    if (existing.isPrimary) {
      const next = await prisma.goal.findFirst({
        where: { userId: user.id, archivedAt: null, id: { not: id } },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        await prisma.goal.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
