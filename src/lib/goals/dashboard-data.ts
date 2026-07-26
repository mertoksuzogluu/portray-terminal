import { prisma } from "@/lib/db/prisma";
import {
  getLatestPortfolioSnapshot,
  getPortfolioSnapshots,
} from "@/lib/api/portfolio-context";
import { getDefaultPortfolioId } from "@/lib/auth/session";
import { istanbulToday, toDateKey } from "@/lib/utils/dates";
import { projectGoal } from "./projection";
import { serializeGoal } from "./serialize";
import { syncAchievements } from "./achievements";
import {
  buildTemplateCoach,
  getCachedCoach,
  type CoachPayload,
} from "./coach";
import type { ContributionGrowth, GoalTargetKind, GoalType } from "./types";

/** İstanbul takvim yılında 1 Ocak (UTC date-only). */
function istanbulYearStart(now = new Date()): Date {
  const key = toDateKey(istanbulToday(now));
  const year = Number(key.slice(0, 4));
  return new Date(Date.UTC(year, 0, 1));
}

/** İki tarih arası ay (kesirli). */
function monthsBetweenDates(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(ms / (1000 * 60 * 60 * 24 * 30.4375), 1 / 30);
}

function num(v: { toString(): string } | number): number {
  return typeof v === "number" ? v : Number(v.toString());
}

export async function loadGoalsDashboard(userId: string, goalId?: string | null) {
  const goals = await prisma.goal.findMany({
    where: { userId, archivedAt: null },
    include: { freedomPrefs: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  if (goals.length === 0) {
    return { goals: [], activeGoal: null, dashboard: null };
  }

  const active =
    (goalId ? goals.find((g) => g.id === goalId) : null) ??
    goals.find((g) => g.isPrimary) ??
    goals[0];

  const portfolioId = await getDefaultPortfolioId(userId);
  let currentValue = 0;
  let previousValue: number | null = null;
  let valueAtYearStart: number | null = null;
  let investedCapital: number | null = null;
  let growth90dPct: number | null = null;
  let snapshotDate: string | null = null;
  let returnToDateAmount = 0;
  let returnToDatePct: number | null = null;
  let netContributions = 0;

  if (portfolioId) {
    const latest = await getLatestPortfolioSnapshot(portfolioId);
    if (latest) {
      currentValue = num(latest.totalMarketValue);
      snapshotDate = latest.snapshotDate.toISOString().slice(0, 10);
      investedCapital = num(latest.investedCapital);
      netContributions = num(latest.netContributions);
      // Snapshot’taki kümülatif kâr/zarar = şu zamana kadarki getiri (TL)
      returnToDateAmount = num(latest.cumulativeProfitLoss);
      if (latest.cumulativeReturn != null) {
        returnToDatePct = num(latest.cumulativeReturn);
      } else if (netContributions > 0) {
        returnToDatePct = returnToDateAmount / netContributions;
      }
    }

    const snaps = await getPortfolioSnapshots(portfolioId, 400);
    if (snaps.length >= 2) {
      previousValue = num(snaps[snaps.length - 2].totalMarketValue);
    }

    // Yıl başı = 1 Ocak’tan ÖNCEKİ son snapshot. Yoksa 0 (portföy bu yıl başladı).
    // İlk 2026 snapshot’ını yıl başı sanmak, başlangıç sermayesini “gerçekleşen”den düşüyordu.
    const yearStart = istanbulYearStart();
    const beforeYear = await prisma.portfolioDailySnapshot.findFirst({
      where: { portfolioId, snapshotDate: { lt: yearStart } },
      orderBy: { snapshotDate: "desc" },
    });
    valueAtYearStart = beforeYear ? num(beforeYear.totalMarketValue) : 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const around90 = [...snaps]
      .filter((s) => s.snapshotDate <= cutoff)
      .pop();
    if (around90 && currentValue > 0) {
      const old = num(around90.totalMarketValue);
      if (old > 0) growth90dPct = (currentValue - old) / old;
    }
  }

  const asOf = istanbulToday();
  const periodStart = (() => {
    const ys = istanbulYearStart(asOf);
    const created = active.createdAt;
    return created > ys ? created : ys;
  })();
  const ytdMonthsElapsed = monthsBetweenDates(periodStart, asOf);

  const projection = projectGoal({
    currentValue,
    targetAmount: num(active.targetAmount),
    targetKind: active.targetKind as GoalTargetKind,
    targetDate: active.targetDate,
    monthlyContribution: num(active.monthlyContribution),
    contributionGrowth: active.contributionGrowth as ContributionGrowth,
    expectedReturnAnnual: num(active.expectedReturnAnnual),
    valueAtYearStart: valueAtYearStart ?? 0,
    previousValue,
    ytdMonthsElapsed,
    asOf,
  });

  // Freedom prefs override score target
  let freedomScore = projection.financialFreedom.score;
  let freedomYears = projection.financialFreedom.estimatedYears;
  let livingCost: number | null = null;
  let targetPassive: number | null = null;

  if (active.freedomPrefs) {
    livingCost = num(active.freedomPrefs.monthlyLivingCost);
    targetPassive = num(active.freedomPrefs.targetPassiveIncome);
    if (targetPassive > 0) {
      freedomScore = Math.min(
        1,
        projection.financialFreedom.monthlyPassiveProxy / targetPassive
      );
    }
  }

  const freedomReached = freedomScore >= 1;

  const achievements = await syncAchievements(userId, currentValue, {
    investedCapital,
    freedomReached,
  });

  // Hızlı yanıt: OpenAI cache varsa onu kullan, yoksa şablon.
  // Canlı üretim istemci tarafında POST /api/goals/coach ile yapılır.
  const cached = await getCachedCoach(active.id);
  const coach: CoachPayload =
    cached ?? buildTemplateCoach(projection, growth90dPct);

  const returnComment =
    returnToDateAmount > 0
      ? "Şu ana kadar portföyün pozitif getiride."
      : returnToDateAmount < 0
        ? "Şu ana kadar portföyün negatif getiride."
        : "Henüz ölçülebilir getiri yok.";

  return {
    goals: goals.map(serializeGoal),
    activeGoal: serializeGoal(active),
    dashboard: {
      currentValue,
      snapshotDate,
      growth90dPct,
      returnToDate: {
        amount: returnToDateAmount,
        pct: returnToDatePct,
        netContributions,
        comment: returnComment,
      },
      projection: {
        ...projection,
        plannedDate: projection.plannedDate.toISOString().slice(0, 10),
        estimatedDate: projection.estimatedDate
          ? projection.estimatedDate.toISOString().slice(0, 10)
          : null,
        forecasts: projection.forecasts.map((f) => ({
          ...f,
          estimatedDate: f.estimatedDate
            ? f.estimatedDate.toISOString().slice(0, 10)
            : null,
        })),
        financialFreedom: {
          score: freedomScore,
          estimatedYears: freedomYears,
          monthlyPassiveProxy: projection.financialFreedom.monthlyPassiveProxy,
          monthlyLivingCost: livingCost,
          targetPassiveIncome: targetPassive,
        },
      },
      achievements,
      coach,
      goalMeta: {
        type: active.type as GoalType,
        title: active.title,
      },
    },
  };
}
