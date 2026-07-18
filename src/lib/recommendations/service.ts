import { addDays } from "date-fns";
import {
  Prisma,
  type AssetClass,
  type RecommendationAction,
  type RiskProfile,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { computeRiskMetrics, concentrationAnalysis } from "@/lib/calculations/risk";
import { startOfDay, toDateKey } from "@/lib/utils/dates";
import { assetTypeToClass } from "./asset-class";
import { buildRecommendations } from "./engine";
import {
  ALGORITHM_VERSION,
  ASSET_CLASSES,
  DEFAULT_TARGET_WEIGHTS,
  type AssetClassId,
  type HoldingInput,
  type RiskProfileId,
} from "./types";

export interface RunRecommendationsResult {
  portfolioId: string;
  runId: string;
  created: number;
  expired: number;
  riskScore: number;
  recommendations: Array<{
    id: string;
    action: string;
    assetClass: string;
    title: string;
    score: number;
  }>;
}

async function loadTargetOverrides(
  profile: RiskProfile
): Promise<Partial<Record<AssetClassId, number>> | undefined> {
  const rows = await prisma.targetAllocation.findMany({ where: { riskProfile: profile } });
  if (rows.length === 0) return undefined;
  const out: Partial<Record<AssetClassId, number>> = {};
  for (const row of rows) {
    out[row.assetClass as AssetClassId] = Number(row.weight.toString());
  }
  return out;
}

export async function ensureDefaultTargetAllocations(): Promise<number> {
  let upserted = 0;
  for (const profile of Object.keys(DEFAULT_TARGET_WEIGHTS) as RiskProfileId[]) {
    for (const assetClass of ASSET_CLASSES) {
      await prisma.targetAllocation.upsert({
        where: {
          riskProfile_assetClass: {
            riskProfile: profile as RiskProfile,
            assetClass: assetClass as AssetClass,
          },
        },
        create: {
          riskProfile: profile as RiskProfile,
          assetClass: assetClass as AssetClass,
          weight: new Prisma.Decimal(DEFAULT_TARGET_WEIGHTS[profile][assetClass]),
        },
        update: {
          weight: new Prisma.Decimal(DEFAULT_TARGET_WEIGHTS[profile][assetClass]),
        },
      });
      upserted += 1;
    }
  }
  return upserted;
}

export async function runRecommendationEngine(
  portfolioId: string,
  asOf: Date = new Date()
): Promise<RunRecommendationsResult> {
  const runDate = startOfDay(asOf);
  const validUntil = startOfDay(addDays(runDate, 7));

  const portfolio = await prisma.portfolio.findUniqueOrThrow({
    where: { id: portfolioId },
    include: { user: true },
  });

  const riskProfile = portfolio.user.riskProfile as RiskProfileId;

  const snapshots = await prisma.portfolioDailySnapshot.findMany({
    where: { portfolioId, snapshotDate: { lte: runDate } },
    orderBy: { snapshotDate: "asc" },
    take: 180,
  });

  const latestSnap = snapshots[snapshots.length - 1] ?? null;
  const dailyReturns = snapshots
    .map((s) => (s.dailyReturn != null ? Number(s.dailyReturn.toString()) : null))
    .filter((v): v is number => v !== null);

  const values = snapshots.map((s) => ({
    date: s.snapshotDate,
    value: s.totalMarketValue.toString(),
  }));

  const riskMetrics = computeRiskMetrics({
    dailyReturns,
    values,
    annualRiskFreeRate: portfolio.user.riskFreeRateAnnual.toString(),
  });

  const positionDate = latestSnap?.snapshotDate ?? runDate;
  const positions = await prisma.positionDailySnapshot.findMany({
    where: { portfolioId, snapshotDate: positionDate },
    include: { asset: true },
  });

  const totalMv = positions.reduce((acc, p) => acc + Number(p.marketValue.toString()), 0);
  const cashValue = latestSnap ? Number(latestSnap.cashValue.toString()) : 0;
  const portfolioTotal = Math.max(totalMv + cashValue, totalMv, 1);

  const concentration = concentrationAnalysis(
    positions.map((p) => ({
      assetId: p.assetId,
      marketValue: p.marketValue.toString(),
    }))
  );

  const holdings: HoldingInput[] = positions.map((p) => {
    const w = Number(p.marketValue.toString()) / portfolioTotal;
    return {
      assetId: p.assetId,
      symbol: p.asset.symbol,
      assetClass: assetTypeToClass(p.asset.assetType),
      weight: w,
      marketValue: Number(p.marketValue.toString()),
      bandSignal: 0,
      annualizedVol: riskMetrics.annualizedVolatility
        ? Number(riskMetrics.annualizedVolatility.toString())
        : null,
      dataQualityPenalty: 0,
    };
  });

  if (cashValue > 0) {
    holdings.push({
      assetId: "cash",
      symbol: "NAKİT",
      assetClass: "CASH",
      weight: cashValue / portfolioTotal,
      marketValue: cashValue,
      bandSignal: 0,
      annualizedVol: 0.02,
      dataQualityPenalty: 0,
    });
  }

  const cashWeight =
    holdings.filter((h) => h.assetClass === "CASH").reduce((a, h) => a + h.weight, 0) ||
    cashValue / portfolioTotal;

  const targetOverrides = await loadTargetOverrides(portfolio.user.riskProfile);

  const engine = buildRecommendations({
    riskProfile,
    riskInput: {
      annualizedVolatility: riskMetrics.annualizedVolatility
        ? Number(riskMetrics.annualizedVolatility.toString())
        : null,
      maxDrawdown: riskMetrics.drawdown.maxDrawdown
        ? Number(riskMetrics.drawdown.maxDrawdown.toString())
        : null,
      hhi: concentration.herfindahlHirschmanIndex
        ? Number(concentration.herfindahlHirschmanIndex.toString())
        : null,
      cashWeight,
    },
    holdings,
    targetOverrides,
  });

  // Eski aktif önerileri expire et
  const expired = await prisma.recommendation.updateMany({
    where: { portfolioId, status: "ACTIVE" },
    data: { status: "EXPIRED" },
  });

  const run = await prisma.recommendationRun.upsert({
    where: {
      portfolioId_runDate_algorithmVersion: {
        portfolioId,
        runDate,
        algorithmVersion: ALGORITHM_VERSION,
      },
    },
    create: {
      portfolioId,
      runDate,
      algorithmVersion: ALGORITHM_VERSION,
      riskProfile: riskProfile as RiskProfile,
      riskScore: new Prisma.Decimal(engine.riskScore.toFixed(4)),
      inputSummary: engine.inputSummary as Prisma.InputJsonValue,
    },
    update: {
      riskProfile: riskProfile as RiskProfile,
      riskScore: new Prisma.Decimal(engine.riskScore.toFixed(4)),
      inputSummary: engine.inputSummary as Prisma.InputJsonValue,
    },
  });

  // Aynı run için önceki satırları temizle (idempotent yeniden koşu)
  await prisma.recommendation.deleteMany({ where: { runId: run.id } });

  const createdRows = await Promise.all(
    engine.recommendations.map((rec) =>
      prisma.recommendation.create({
        data: {
          portfolioId,
          runId: run.id,
          action: rec.action as RecommendationAction,
          assetClass: rec.assetClass as AssetClass,
          assetId: rec.assetId && rec.assetId !== "cash" ? rec.assetId : null,
          symbol: rec.symbol ?? null,
          title: rec.title,
          message: rec.message,
          currentWeight: new Prisma.Decimal(rec.currentWeight.toFixed(8)),
          targetWeight: new Prisma.Decimal(rec.targetWeight.toFixed(8)),
          suggestedDelta: new Prisma.Decimal(rec.suggestedDelta.toFixed(8)),
          score: new Prisma.Decimal(rec.score.toFixed(4)),
          rationale: rec.rationale as Prisma.InputJsonValue,
          status: "ACTIVE",
          validUntil,
        },
      })
    )
  );

  return {
    portfolioId,
    runId: run.id,
    created: createdRows.length,
    expired: expired.count,
    riskScore: engine.riskScore.toNumber(),
    recommendations: createdRows.map((r) => ({
      id: r.id,
      action: r.action,
      assetClass: r.assetClass,
      title: r.title,
      score: Number(r.score.toString()),
    })),
  };
}

export async function runRecommendationsForAllPortfolios(
  asOf: Date = new Date()
): Promise<{ portfolios: number; recommendations: number }> {
  await ensureDefaultTargetAllocations();
  const portfolios = await prisma.portfolio.findMany({ select: { id: true } });
  let recommendations = 0;
  for (const p of portfolios) {
    const result = await runRecommendationEngine(p.id, asOf);
    recommendations += result.created;
  }
  return { portfolios: portfolios.length, recommendations };
}

export async function getActiveRecommendations(portfolioId: string) {
  const today = startOfDay(new Date());
  await prisma.recommendation.updateMany({
    where: { portfolioId, status: "ACTIVE", validUntil: { lt: today } },
    data: { status: "EXPIRED" },
  });

  const items = await prisma.recommendation.findMany({
    where: { portfolioId, status: "ACTIVE" },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });

  const latestRun = await prisma.recommendationRun.findFirst({
    where: { portfolioId },
    orderBy: { runDate: "desc" },
  });

  return {
    asOf: latestRun ? toDateKey(latestRun.runDate) : null,
    riskProfile: latestRun?.riskProfile ?? null,
    riskScore: latestRun?.riskScore ? Number(latestRun.riskScore.toString()) : null,
    algorithmVersion: latestRun?.algorithmVersion ?? ALGORITHM_VERSION,
    inputSummary: latestRun?.inputSummary ?? null,
    items: items.map((i) => ({
      id: i.id,
      action: i.action,
      assetClass: i.assetClass,
      assetId: i.assetId,
      symbol: i.symbol,
      title: i.title,
      message: i.message,
      currentWeight: Number(i.currentWeight.toString()),
      targetWeight: Number(i.targetWeight.toString()),
      suggestedDelta: Number(i.suggestedDelta.toString()),
      score: Number(i.score.toString()),
      rationale: i.rationale,
      status: i.status,
      validUntil: toDateKey(i.validUntil),
      createdAt: i.createdAt.toISOString(),
    })),
  };
}
