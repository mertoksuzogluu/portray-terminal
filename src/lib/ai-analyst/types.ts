export const MONTHLY_AI_REPORT_TYPE = "monthly_ai" as const;

export interface AllocationSlice {
  key: string;
  label: string;
  value: number;
  weight: number;
}

export interface WorldEventItem {
  title: string;
  impact: string;
  implication: string;
}

export interface PositionRecommendationItem {
  action: "INCREASE" | "DECREASE" | "HOLD" | "SHIFT_CLASS" | "PARK_CASH";
  assetClass: string;
  symbol?: string | null;
  title: string;
  rationale: string;
  priority: number;
}

export interface MonthlyAiMetrics {
  startValue: number | null;
  endValue: number | null;
  investedCapital: number | null;
  nominalPnl: number | null;
  nominalReturn: number | null;
  maxDrawdown: number | null;
  maxDrawdownStart: string | null;
  maxDrawdownTrough: string | null;
  maxRise: number | null;
  maxRiseStart: string | null;
  maxRisePeak: string | null;
  volatilityAnnual: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  bestDay: number | null;
  worstDay: number | null;
  positiveDayRatio: number | null;
  observationCount: number;
  inflationHurdle: number | null;
  inflationLabel: string;
  vsInflationPnl: number | null;
  vsInflationReturn: number | null;
  depositHurdle: number | null;
  depositLabel: string;
  vsDepositPnl: number | null;
  vsDepositReturn: number | null;
  allocationByClass: AllocationSlice[];
  allocationBySymbol: AllocationSlice[];
  largestWeight: number | null;
  top3Weight: number | null;
  hhi: number | null;
  bist100Return: number | null;
  bist100Start: number | null;
  bist100End: number | null;
  alphaVsBist: number | null;
  betaVsBist: number | null;
  correlationVsBist: number | null;
}

export interface MonthlyAiNarrative {
  executiveSummary: string;
  performanceAnalysis: string;
  riskAnalysis: string;
  benchmarkComparison: string;
  worldEvents: WorldEventItem[];
  positionRecommendations: PositionRecommendationItem[];
  outlook: string;
  disclaimer: string;
  source: "openai" | "template";
  /** Şablona düşüldüyse neden (anahtar yok / kota / API hatası) */
  aiError?: string | null;
}

export interface MonthlyAiReportContent {
  version: 1;
  kind: typeof MONTHLY_AI_REPORT_TYPE;
  generatedAt: string;
  period: { start: string; end: string; label: string };
  metrics: MonthlyAiMetrics;
  narrative: MonthlyAiNarrative;
}
