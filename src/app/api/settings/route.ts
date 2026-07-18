import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function GET() {
  try {
    const user = await requireUser();

    const portfolio = await prisma.portfolio.findFirst({
      where: { userId: user.id, isDefault: true },
      include: { accounts: true },
    });

    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.baseCurrency,
        timezone: user.timezone,
        riskFreeRateAnnual: Number(user.riskFreeRateAnnual),
        role: user.role,
        riskProfile: user.riskProfile,
        isDemo: user.isDemo,
      },
      portfolio: portfolio
        ? {
            id: portfolio.id,
            name: portfolio.name,
            baseCurrency: portfolio.baseCurrency,
            accounts: portfolio.accounts.map((a) => ({
              id: a.id,
              name: a.name,
              institution: a.institution,
            })),
          }
        : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.baseCurrency !== undefined) data.baseCurrency = String(body.baseCurrency);
    if (body.timezone !== undefined) data.timezone = String(body.timezone);
    if (body.riskFreeRateAnnual !== undefined) {
      data.riskFreeRateAnnual = Number(body.riskFreeRateAnnual);
    }
    if (body.riskProfile !== undefined) {
      data.riskProfile = String(body.riskProfile);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });

    return jsonOk({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        baseCurrency: updated.baseCurrency,
        timezone: updated.timezone,
        riskFreeRateAnnual: Number(updated.riskFreeRateAnnual.toString()),
        role: updated.role,
        riskProfile: updated.riskProfile,
        isDemo: updated.isDemo,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
