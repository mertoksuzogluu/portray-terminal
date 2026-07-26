export type GoalType =
  | "PORTFOLIO_SIZE"
  | "FINANCIAL_FREEDOM"
  | "PASSIVE_INCOME"
  | "HOME"
  | "CAR"
  | "WORLD_TOUR"
  | "CUSTOM";

export type GoalTargetKind = "LUMP_SUM" | "MONTHLY_PASSIVE";

export type ContributionGrowth =
  | "FIXED"
  | "ANNUAL_INCREASE"
  | "SALARY_LINKED"
  | "UNSURE";

export interface ProjectionInput {
  currentValue: number;
  targetAmount: number;
  targetKind: GoalTargetKind;
  /** Hedef pasif gelir için: yıllık getiri ile gereken sermaye = amount * 12 / return */
  targetDate: Date;
  monthlyContribution: number;
  contributionGrowth: ContributionGrowth;
  expectedReturnAnnual: number;
  /** Yıl başındaki portföy değeri (YTD) */
  valueAtYearStart?: number | null;
  /** Dünkü / önceki snapshot (bugünkü ilerleme) */
  previousValue?: number | null;
  asOf?: Date;
}

export interface AheadBehind {
  months: number;
  label: string;
  status: "ahead" | "behind" | "on_track";
}

export interface ForecastScenario {
  id: "conservative" | "expected" | "optimistic";
  label: string;
  emoji: string;
  returnAnnual: number;
  estimatedDate: Date | null;
  year: number | null;
}

export interface Milestone {
  amount: number;
  label: string;
  reached: boolean;
}

export interface ProjectionResult {
  currentValue: number;
  targetAmount: number;
  /** LUMP_SUM için targetAmount; MONTHLY_PASSIVE için implied capital */
  effectiveTarget: number;
  progressPct: number;
  remaining: number;
  plannedDate: Date;
  estimatedDate: Date | null;
  aheadBehind: AheadBehind;
  forecasts: ForecastScenario[];
  ytd: {
    planned: number;
    actual: number;
    comment: string;
  };
  todayDelta: number;
  todayProgressPct: number;
  milestones: Milestone[];
  financialFreedom: {
    score: number;
    estimatedYears: number | null;
    monthlyPassiveProxy: number;
  };
}

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  PORTFOLIO_SIZE: "Belirli portföy büyüklüğü",
  FINANCIAL_FREEDOM: "Finansal özgürlük",
  PASSIVE_INCOME: "Aylık pasif gelir",
  HOME: "Ev almak",
  CAR: "Araç almak",
  WORLD_TOUR: "Dünya turu",
  CUSTOM: "Kendi hedefim",
};

export const CONTRIBUTION_GROWTH_LABELS: Record<ContributionGrowth, string> = {
  FIXED: "Sabit kalacak",
  ANNUAL_INCREASE: "Her yıl artıracağım",
  SALARY_LINKED: "Maaşıma göre artırırım",
  UNSURE: "Emin değilim",
};

export const ACHIEVEMENT_DEFS = [
  { code: "FIRST_1M", label: "İlk 1 M", threshold: 1_000_000 },
  { code: "FIRST_5M", label: "İlk 5 M", threshold: 5_000_000 },
  { code: "FIRST_100_RETURN", label: "İlk %100 Getiri", threshold: null },
  { code: "FIRST_10M", label: "İlk 10 M", threshold: 10_000_000 },
  { code: "REACH_25M", label: "25 M", threshold: 25_000_000 },
  { code: "FINANCIAL_FREEDOM", label: "Finansal Özgürlük", threshold: null },
] as const;
