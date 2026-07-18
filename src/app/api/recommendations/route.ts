import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  getActiveRecommendations,
  runRecommendationEngine,
} from "@/lib/recommendations/service";
import {
  ASSET_CLASS_LABELS,
  RISK_PROFILE_LABELS,
  RISK_SCORE_TARGETS,
} from "@/lib/recommendations/types";
import { DISCLAIMER } from "@/lib/constants/nav";

export async function GET() {
  try {
    const { user, portfolioId } = await requirePortfolioContext();
    const data = await getActiveRecommendations(portfolioId);

    const notes = await prisma.marketNote.findMany({
      where: { isActive: true },
      orderBy: { publishedAt: "desc" },
      take: 5,
      include: { author: { select: { name: true, email: true } } },
    });

    return jsonOk({
      ...data,
      riskProfileLabel: data.riskProfile
        ? RISK_PROFILE_LABELS[data.riskProfile as keyof typeof RISK_PROFILE_LABELS]
        : RISK_PROFILE_LABELS[user.riskProfile],
      riskBand: RISK_SCORE_TARGETS[user.riskProfile],
      userRiskProfile: user.riskProfile,
      classLabels: ASSET_CLASS_LABELS,
      marketNotes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        publishedAt: n.publishedAt.toISOString(),
        author: n.author.name ?? n.author.email,
      })),
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const body = await req.json().catch(() => ({}));
    const refresh = body?.refresh === true;

    if (refresh) {
      const result = await runRecommendationEngine(portfolioId);
      const data = await getActiveRecommendations(portfolioId);
      return jsonOk({ refreshed: true, run: result, ...data, disclaimer: DISCLAIMER });
    }

    return jsonError(new Error("Geçersiz istek. { refresh: true } beklenir."));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const body = await req.json();
    const id = String(body.id ?? "");
    const status = body.status as "APPLIED" | "DISMISSED";

    if (!id || (status !== "APPLIED" && status !== "DISMISSED")) {
      return jsonError(new Error("id ve status (APPLIED|DISMISSED) gerekli."));
    }

    const existing = await prisma.recommendation.findFirst({
      where: { id, portfolioId },
    });
    if (!existing) {
      return jsonError(Object.assign(new Error("Öneri bulunamadı."), { status: 404 }));
    }

    const updated = await prisma.recommendation.update({
      where: { id },
      data: { status },
    });

    return jsonOk({
      id: updated.id,
      status: updated.status,
    });
  } catch (error) {
    return jsonError(error);
  }
}
