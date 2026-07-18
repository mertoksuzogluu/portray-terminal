import type { Decimal } from "@/lib/calculations/decimal";

export type RiskProfileId = "CONSERVATIVE" | "BALANCED" | "GROWTH" | "AGGRESSIVE";
export type AssetClassId = "EQUITY" | "FUND" | "FX" | "GOLD" | "CASH";
export type RecommendationActionId =
  | "INCREASE"
  | "DECREASE"
  | "HOLD"
  | "SHIFT_CLASS"
  | "PARK_CASH";

export const ASSET_CLASSES: AssetClassId[] = ["EQUITY", "FUND", "FX", "GOLD", "CASH"];

export const RISK_PROFILE_LABELS: Record<RiskProfileId, string> = {
  CONSERVATIVE: "Muhafazakâr",
  BALANCED: "Dengeli",
  GROWTH: "Büyüme",
  AGGRESSIVE: "Agresif",
};

export const ASSET_CLASS_LABELS: Record<AssetClassId, string> = {
  EQUITY: "Hisse / ETF",
  FUND: "Fon",
  FX: "Döviz",
  GOLD: "Altın",
  CASH: "Nakit",
};

/** Hedef risk skoru bandı (0–100). */
export const RISK_SCORE_TARGETS: Record<
  RiskProfileId,
  { target: number; min: number; max: number }
> = {
  CONSERVATIVE: { target: 25, min: 10, max: 40 },
  BALANCED: { target: 45, min: 30, max: 60 },
  GROWTH: { target: 65, min: 50, max: 80 },
  AGGRESSIVE: { target: 80, min: 65, max: 95 },
};

export const DEFAULT_TARGET_WEIGHTS: Record<RiskProfileId, Record<AssetClassId, number>> = {
  CONSERVATIVE: { EQUITY: 0.15, FUND: 0.4, GOLD: 0.15, FX: 0.1, CASH: 0.2 },
  BALANCED: { EQUITY: 0.35, FUND: 0.3, GOLD: 0.15, FX: 0.1, CASH: 0.1 },
  GROWTH: { EQUITY: 0.5, FUND: 0.25, GOLD: 0.1, FX: 0.1, CASH: 0.05 },
  AGGRESSIVE: { EQUITY: 0.7, FUND: 0.15, GOLD: 0.05, FX: 0.05, CASH: 0.05 },
};

export const ALGORITHM_VERSION = "v1";
export const DEVIATION_THRESHOLD = 0.05; // %5
export const MAX_SINGLE_MOVE = 0.15; // tek öneride max %15 kaydırma

export interface ClassWeightInput {
  assetClass: AssetClassId;
  weight: number;
}

export interface HoldingInput {
  assetId: string;
  symbol: string;
  assetClass: AssetClassId;
  weight: number;
  marketValue: number;
  /** -1 near high (pahalı), 0 mid, +1 near low (ucuz) */
  bandSignal?: number;
  annualizedVol?: number | null;
  dataQualityPenalty?: number;
}

export interface RiskScoreInput {
  annualizedVolatility: number | null;
  maxDrawdown: number | null;
  hhi: number | null;
  cashWeight: number;
}

export interface DraftRecommendation {
  action: RecommendationActionId;
  assetClass: AssetClassId;
  assetId?: string;
  symbol?: string;
  title: string;
  message: string;
  currentWeight: Decimal;
  targetWeight: Decimal;
  suggestedDelta: Decimal;
  score: Decimal;
  rationale: Record<string, unknown>;
}

export interface EngineResult {
  riskScore: Decimal;
  targetRisk: number;
  classWeights: Record<AssetClassId, number>;
  targetWeights: Record<AssetClassId, number>;
  recommendations: DraftRecommendation[];
  clipped: boolean;
  inputSummary: Record<string, unknown>;
}
