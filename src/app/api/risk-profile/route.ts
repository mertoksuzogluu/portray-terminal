import { NextRequest } from "next/server";
import type { RiskProfile } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  DEFAULT_TARGET_WEIGHTS,
  RISK_PROFILE_LABELS,
  RISK_SCORE_TARGETS,
  type RiskProfileId,
} from "@/lib/recommendations/types";
import { ensureDefaultTargetAllocations } from "@/lib/recommendations/service";
import { DISCLAIMER } from "@/lib/constants/nav";

const PROFILES: RiskProfileId[] = ["CONSERVATIVE", "BALANCED", "GROWTH", "AGGRESSIVE"];

export async function GET() {
  try {
    const user = await requireUser();
    await ensureDefaultTargetAllocations();

    const rows = await prisma.targetAllocation.findMany({
      where: { riskProfile: user.riskProfile },
    });

    const targets: Record<string, number> = {};
    for (const row of rows) {
      targets[row.assetClass] = Number(row.weight.toString());
    }
    if (Object.keys(targets).length === 0) {
      Object.assign(targets, DEFAULT_TARGET_WEIGHTS[user.riskProfile]);
    }

    return jsonOk({
      riskProfile: user.riskProfile,
      label: RISK_PROFILE_LABELS[user.riskProfile],
      band: RISK_SCORE_TARGETS[user.riskProfile],
      targets,
      profiles: PROFILES.map((p) => ({
        id: p,
        label: RISK_PROFILE_LABELS[p],
        band: RISK_SCORE_TARGETS[p],
        targets: DEFAULT_TARGET_WEIGHTS[p],
      })),
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const riskProfile = String(body.riskProfile ?? "") as RiskProfileId;

    if (!PROFILES.includes(riskProfile)) {
      return jsonError(new Error("Geçersiz risk profili."));
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { riskProfile: riskProfile as RiskProfile },
    });

    return jsonOk({
      riskProfile: updated.riskProfile,
      label: RISK_PROFILE_LABELS[updated.riskProfile as RiskProfileId],
      band: RISK_SCORE_TARGETS[updated.riskProfile as RiskProfileId],
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    return jsonError(error);
  }
}
