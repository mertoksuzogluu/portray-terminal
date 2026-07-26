import type {
  AheadBehind,
  ContributionGrowth,
  ForecastScenario,
  Milestone,
  ProjectionInput,
  ProjectionResult,
} from "./types";

const MS_PER_DAY = 86_400_000;
const MAX_MONTHS = 600;

export function effectiveTargetAmount(
  targetAmount: number,
  targetKind: ProjectionInput["targetKind"],
  expectedReturnAnnual: number
): number {
  if (targetKind !== "MONTHLY_PASSIVE") return Math.max(0, targetAmount);
  const r = Math.max(expectedReturnAnnual, 0.001);
  return (targetAmount * 12) / r;
}

function monthlyRate(annual: number): number {
  return Math.pow(1 + Math.max(annual, 0), 1 / 12) - 1;
}

function contributionForMonth(
  base: number,
  monthIndex: number,
  growth: ContributionGrowth
): number {
  if (growth === "FIXED" || growth === "UNSURE") return base;
  const years = Math.floor(monthIndex / 12);
  if (growth === "ANNUAL_INCREASE") return base * Math.pow(1.1, years);
  // SALARY_LINKED ~ inflation-ish 8%/yıl
  return base * Math.pow(1.08, years);
}

/** Hedefe ulaşma ayını simüle et; bulunamazsa null. */
export function estimateReachDate(
  currentValue: number,
  target: number,
  monthlyContribution: number,
  expectedReturnAnnual: number,
  contributionGrowth: ContributionGrowth,
  asOf: Date = new Date()
): Date | null {
  if (target <= 0) return asOf;
  if (currentValue >= target) return asOf;

  let value = currentValue;
  const r = monthlyRate(expectedReturnAnnual);

  for (let m = 1; m <= MAX_MONTHS; m++) {
    const contrib = contributionForMonth(monthlyContribution, m - 1, contributionGrowth);
    value = value * (1 + r) + contrib;
    if (value >= target) {
      const d = new Date(asOf);
      d.setMonth(d.getMonth() + m);
      return d;
    }
  }
  return null;
}

export function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  return years * 12 + months + (to.getDate() - from.getDate()) / 30;
}

export function formatAheadBehind(monthsDiff: number): AheadBehind {
  const abs = Math.abs(monthsDiff);
  if (abs < 0.75) {
    return { months: 0, label: "Planla uyumlusun.", status: "on_track" };
  }
  const wholeMonths = Math.round(abs);
  const years = Math.floor(wholeMonths / 12);
  const months = wholeMonths % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yıl`);
  if (months > 0) parts.push(`${months} ay`);
  const span = parts.join(" ") || "1 ay";

  if (monthsDiff > 0) {
    return {
      months: wholeMonths,
      label: `${span} öndesin.`,
      status: "ahead",
    };
  }
  return {
    months: -wholeMonths,
    label: `${span} geridesin.`,
    status: "behind",
  };
}

export function buildMilestones(
  currentValue: number,
  effectiveTarget: number
): Milestone[] {
  const bases = [
    1_000_000, 2_500_000, 5_000_000, 10_000_000, 15_000_000, 20_000_000,
    25_000_000, 50_000_000, 100_000_000,
  ];
  const amounts = bases.filter((a) => a <= effectiveTarget * 1.05);
  if (
    effectiveTarget > 0 &&
    !amounts.some((a) => Math.abs(a - effectiveTarget) / effectiveTarget < 0.02)
  ) {
    amounts.push(Math.round(effectiveTarget));
  }
  amounts.sort((a, b) => a - b);

  return amounts.map((amount) => ({
    amount,
    label: formatMilestoneLabel(amount),
    reached: currentValue >= amount,
  }));
}

function formatMilestoneLabel(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return Number.isInteger(m) ? `${m} M` : `${m.toFixed(1)} M`;
  }
  return new Intl.NumberFormat("tr-TR").format(amount);
}

function ytdComment(planned: number, actual: number): string {
  if (planned <= 0 && actual <= 0) return "Bu yıl için henüz yeterli veri yok.";
  if (actual >= planned * 1.05) return "Planının önündesin.";
  if (actual >= planned * 0.95) return "Planla uyumlusun.";
  return "Bu yıl planın biraz gerisinde.";
}

/**
 * Pure projection — asla portföy / transaction yazmaz.
 */
export function projectGoal(input: ProjectionInput): ProjectionResult {
  const asOf = input.asOf ?? new Date();
  const effectiveTarget = effectiveTargetAmount(
    input.targetAmount,
    input.targetKind,
    input.expectedReturnAnnual
  );
  const currentValue = Math.max(0, input.currentValue);
  const progressPct =
    effectiveTarget > 0
      ? Math.min(100, (currentValue / effectiveTarget) * 100)
      : 0;
  const remaining = Math.max(0, effectiveTarget - currentValue);
  const plannedDate = new Date(input.targetDate);

  const estimatedDate = estimateReachDate(
    currentValue,
    effectiveTarget,
    input.monthlyContribution,
    input.expectedReturnAnnual,
    input.contributionGrowth,
    asOf
  );

  let aheadBehind: AheadBehind;
  if (!estimatedDate) {
    aheadBehind = {
      months: -999,
      label: "Mevcut planla hedefe 50 yıl içinde ulaşılamıyor.",
      status: "behind",
    };
  } else {
    const diff = monthsBetween(estimatedDate, plannedDate);
    aheadBehind = formatAheadBehind(diff);
  }

  const forecasts: ForecastScenario[] = (
    [
      {
        id: "conservative" as const,
        label: "Temkinli",
        emoji: "🐢",
        mult: 0.7,
      },
      {
        id: "expected" as const,
        label: "Beklenen",
        emoji: "⚖️",
        mult: 1,
      },
      {
        id: "optimistic" as const,
        label: "İyimser",
        emoji: "🚀",
        mult: 1.3,
      },
    ] as const
  ).map((s) => {
    const ret = input.expectedReturnAnnual * s.mult;
    const date = estimateReachDate(
      currentValue,
      effectiveTarget,
      input.monthlyContribution,
      ret,
      input.contributionGrowth,
      asOf
    );
    return {
      id: s.id,
      label: s.label,
      emoji: s.emoji,
      returnAnnual: ret,
      estimatedDate: date,
      year: date ? date.getFullYear() : null,
    };
  });

  // null/undefined → veri yok; 0 → yıl başında portföy yoktu (doğru)
  const yearStart =
    input.valueAtYearStart === undefined || input.valueAtYearStart === null
      ? currentValue
      : Math.max(0, input.valueAtYearStart);
  const actualYtd = currentValue - yearStart;

  const calendarMonth = asOf.getUTCMonth() + 1;
  const monthsElapsed = Math.max(
    1 / 30,
    input.ytdMonthsElapsed != null && input.ytdMonthsElapsed > 0
      ? input.ytdMonthsElapsed
      : calendarMonth
  );
  const monthlyR = monthlyRate(input.expectedReturnAnnual);
  // Planlanan YTD: aylık katkı * ay + yıl başı sermaye üzerinden getiri
  const plannedContrib = input.monthlyContribution * monthsElapsed;
  const plannedGrowth = yearStart * (Math.pow(1 + monthlyR, monthsElapsed) - 1);
  const plannedYtd = plannedContrib + plannedGrowth;

  const todayDelta =
    input.previousValue != null ? currentValue - input.previousValue : 0;
  const todayProgressPct =
    effectiveTarget > 0 ? (todayDelta / effectiveTarget) * 100 : 0;

  const monthlyPassiveProxy =
    (currentValue * Math.max(input.expectedReturnAnnual, 0)) / 12;
  const freedomTargetMonthly =
    input.targetKind === "MONTHLY_PASSIVE"
      ? input.targetAmount
      : (effectiveTarget * Math.max(input.expectedReturnAnnual, 0.001)) / 12;
  const score =
    freedomTargetMonthly > 0
      ? Math.min(1, monthlyPassiveProxy / freedomTargetMonthly)
      : 0;

  let estimatedYears: number | null = null;
  if (estimatedDate) {
    estimatedYears = Math.max(
      0,
      monthsBetween(asOf, estimatedDate) / 12
    );
  }

  return {
    currentValue,
    targetAmount: input.targetAmount,
    effectiveTarget,
    progressPct,
    remaining,
    plannedDate,
    estimatedDate,
    aheadBehind,
    forecasts,
    ytd: {
      planned: plannedYtd,
      actual: actualYtd,
      comment: ytdComment(plannedYtd, actualYtd),
    },
    todayDelta,
    todayProgressPct,
    milestones: buildMilestones(currentValue, effectiveTarget),
    financialFreedom: {
      score,
      estimatedYears,
      monthlyPassiveProxy,
    },
  };
}

/** Simülasyon: katkı / getiri override — DB yazmaz. */
export function simulateGoalShift(
  base: ProjectionInput,
  overrides: {
    monthlyContribution?: number;
    expectedReturnAnnual?: number;
  }
): {
  baseDate: Date | null;
  simDate: Date | null;
  monthsShift: number;
  label: string;
} {
  const baseResult = projectGoal(base);
  const sim = projectGoal({
    ...base,
    monthlyContribution:
      overrides.monthlyContribution ?? base.monthlyContribution,
    expectedReturnAnnual:
      overrides.expectedReturnAnnual ?? base.expectedReturnAnnual,
  });

  const baseDate = baseResult.estimatedDate;
  const simDate = sim.estimatedDate;

  if (!baseDate && !simDate) {
    return {
      baseDate: null,
      simDate: null,
      monthsShift: 0,
      label: "Mevcut varsayımlarla hedefe ulaşılamıyor.",
    };
  }
  if (!baseDate && simDate) {
    return {
      baseDate: null,
      simDate,
      monthsShift: -999,
      label: "Bu planla hedefe ulaşmak mümkün hale geliyor.",
    };
  }
  if (baseDate && !simDate) {
    return {
      baseDate,
      simDate: null,
      monthsShift: 999,
      label: "Bu varsayımlarla hedefe ulaşmak zorlaşıyor.",
    };
  }

  // Pozitif = simülasyon tarihi daha erken (öne çekildi)
  const monthsShift = monthsBetween(simDate!, baseDate!);
  const abs = Math.abs(monthsShift);
  const whole = Math.round(abs);
  const years = Math.floor(whole / 12);
  const months = whole % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yıl`);
  if (months > 0) parts.push(`${months} ay`);
  const span = parts.join(" ") || "1 aydan az";

  let label: string;
  if (abs < 0.5) label = "Hedef tarihi neredeyse aynı kalıyor.";
  else if (monthsShift > 0) label = `Hedef tarihi ${span} öne geliyor.`;
  else label = `${span} gecikiyor.`;

  return { baseDate, simDate, monthsShift, label };
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}
