import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { serializeGoal } from "@/lib/goals/serialize";

const createSchema = z.object({
  type: z.enum([
    "PORTFOLIO_SIZE",
    "FINANCIAL_FREEDOM",
    "PASSIVE_INCOME",
    "HOME",
    "CAR",
    "WORLD_TOUR",
    "CUSTOM",
  ]),
  title: z.string().min(1).max(120).optional(),
  targetAmount: z.number().positive(),
  targetKind: z.enum(["LUMP_SUM", "MONTHLY_PASSIVE"]).default("LUMP_SUM"),
  targetDate: z.string().min(8),
  monthlyContribution: z.number().min(0),
  contributionGrowth: z
    .enum(["FIXED", "ANNUAL_INCREASE", "SALARY_LINKED", "UNSURE"])
    .default("FIXED"),
  expectedReturnAnnual: z.number().min(0).max(2),
  isPrimary: z.boolean().optional(),
  freedomPrefs: z
    .object({
      monthlyLivingCost: z.number().min(0),
      targetPassiveIncome: z.number().min(0),
    })
    .optional(),
});

const DEFAULT_TITLES: Record<string, string> = {
  PORTFOLIO_SIZE: "Portföy büyüklüğü",
  FINANCIAL_FREEDOM: "Finansal özgürlük",
  PASSIVE_INCOME: "Aylık pasif gelir",
  HOME: "Ev almak",
  CAR: "Araç almak",
  WORLD_TOUR: "Dünya turu",
  CUSTOM: "Özel hedef",
};

export async function GET() {
  try {
    const user = await requireUser();
    const goals = await prisma.goal.findMany({
      where: { userId: user.id, archivedAt: null },
      include: { freedomPrefs: true },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    return jsonOk({ goals: goals.map(serializeGoal) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await req.json());

    const existingCount = await prisma.goal.count({
      where: { userId: user.id, archivedAt: null },
    });
    const makePrimary = body.isPrimary ?? existingCount === 0;

    if (makePrimary) {
      await prisma.goal.updateMany({
        where: { userId: user.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        type: body.type,
        title: body.title?.trim() || DEFAULT_TITLES[body.type] || "Hedef",
        targetAmount: body.targetAmount,
        targetKind: body.targetKind,
        targetDate: new Date(body.targetDate),
        monthlyContribution: body.monthlyContribution,
        contributionGrowth: body.contributionGrowth,
        expectedReturnAnnual: body.expectedReturnAnnual,
        isPrimary: makePrimary,
        freedomPrefs: body.freedomPrefs
          ? {
              create: {
                monthlyLivingCost: body.freedomPrefs.monthlyLivingCost,
                targetPassiveIncome: body.freedomPrefs.targetPassiveIncome,
              },
            }
          : undefined,
      },
      include: { freedomPrefs: true },
    });

    return jsonOk({ goal: serializeGoal(goal) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
