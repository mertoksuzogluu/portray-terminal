import { NextRequest } from "next/server";
import { Prisma, type AssetClass, type RiskProfile } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  ASSET_CLASSES,
  ASSET_CLASS_LABELS,
  DEFAULT_TARGET_WEIGHTS,
  RISK_PROFILE_LABELS,
  type RiskProfileId,
} from "@/lib/recommendations/types";
import { ensureDefaultTargetAllocations } from "@/lib/recommendations/service";
import { DISCLAIMER } from "@/lib/constants/nav";

const PROFILES = Object.keys(DEFAULT_TARGET_WEIGHTS) as RiskProfileId[];

export async function GET() {
  try {
    await requireAdmin();
    await ensureDefaultTargetAllocations();

    const rows = await prisma.targetAllocation.findMany({
      orderBy: [{ riskProfile: "asc" }, { assetClass: "asc" }],
    });

    const byProfile: Record<string, Record<string, number>> = {};
    for (const p of PROFILES) {
      byProfile[p] = { ...DEFAULT_TARGET_WEIGHTS[p] };
    }
    for (const row of rows) {
      byProfile[row.riskProfile][row.assetClass] = Number(row.weight.toString());
    }

    return jsonOk({
      profiles: PROFILES.map((p) => ({
        id: p,
        label: RISK_PROFILE_LABELS[p],
        weights: byProfile[p],
      })),
      classLabels: ASSET_CLASS_LABELS,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const riskProfile = String(body.riskProfile ?? "") as RiskProfileId;
    const weights = body.weights as Record<string, number> | undefined;

    if (!PROFILES.includes(riskProfile) || !weights) {
      return jsonError(new Error("riskProfile ve weights gerekli."));
    }

    let sum = 0;
    for (const cls of ASSET_CLASSES) {
      const w = Number(weights[cls] ?? 0);
      if (w < 0 || w > 1) {
        return jsonError(new Error(`${cls} ağırlığı 0–1 arasında olmalı.`));
      }
      sum += w;
    }
    if (Math.abs(sum - 1) > 0.02) {
      return jsonError(new Error(`Ağırlıklar toplamı ≈1 olmalı (şimdi ${sum.toFixed(3)}).`));
    }

    for (const cls of ASSET_CLASSES) {
      const w = Number(weights[cls] ?? 0) / sum;
      await prisma.targetAllocation.upsert({
        where: {
          riskProfile_assetClass: {
            riskProfile: riskProfile as RiskProfile,
            assetClass: cls as AssetClass,
          },
        },
        create: {
          riskProfile: riskProfile as RiskProfile,
          assetClass: cls as AssetClass,
          weight: new Prisma.Decimal(w),
        },
        update: { weight: new Prisma.Decimal(w) },
      });
    }

    return jsonOk({ ok: true, riskProfile, disclaimer: DISCLAIMER });
  } catch (error) {
    return jsonError(error);
  }
}
