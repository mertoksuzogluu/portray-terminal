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
  /** Elde tutulan gün (kâr penceresi ile aynı) */
  heldDays: number | null;
  inflationHurdle: number | null;
  inflationLabel: string;
  /** Enflasyon fırsat maliyeti (TL) */
  inflationOpportunityPnl: number | null;
  /** Portföy kârı − enflasyon maliyeti */
  vsInflationPnl: number | null;
  vsInflationReturn: number | null;
  /** Ayarlardaki yıllık vadeli oranı (örn. 0.45) */
  depositAnnualRate: number | null;
  /** Aylık efektif vadeli / para piyasası kıyas oranı */
  depositMonthlyRate: number | null;
  depositHurdle: number | null;
  depositLabel: string;
  /** Vadeli ile aynı sürede kazanılacak tutar (TL) */
  depositOpportunityPnl: number | null;
  /** Portföy kârı − vadeli fırsat; eksi = vadeli daha iyi */
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

/** Portföydeki en ağırlıklı ürün — sosyal medya / piyasa nabzı */
export interface TopHoldingSpotlight {
  symbol: string;
  name: string;
  weight: number;
  value: number;
  summary: string;
  whatPeopleSay: string;
  expectations: string;
  currentSituation: string;
  risksAndWatch: string;
  sourcesNote: string;
}

export interface MonthlyAiNarrative {
  executiveSummary: string;
  performanceAnalysis: string;
  riskAnalysis: string;
  benchmarkComparison: string;
  worldEvents: WorldEventItem[];
  /** En ağırlıklı ürün analizi (X/Twitter, TEFAS, haber) */
  topHoldingSpotlight: TopHoldingSpotlight | null;
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
