export { monthlyPerformanceRule } from "./monthly-performance-rule";
export { rollingAverageRule } from "./rolling-average-rule";
export { benchmarkOutperformanceRule } from "./benchmark-outperformance-rule";
export { inflationRule } from "./inflation-rule";
export { concentrationRule } from "./concentration-rule";
export { drawdownRule } from "./drawdown-rule";
export { contributionRule } from "./contribution-rule";
export { volatilityTrendRule } from "./volatility-trend-rule";
export { dataQualityRule } from "./data-quality-rule";

import { monthlyPerformanceRule } from "./monthly-performance-rule";
import { rollingAverageRule } from "./rolling-average-rule";
import { benchmarkOutperformanceRule } from "./benchmark-outperformance-rule";
import { inflationRule } from "./inflation-rule";
import { concentrationRule } from "./concentration-rule";
import { drawdownRule } from "./drawdown-rule";
import { contributionRule } from "./contribution-rule";
import { volatilityTrendRule } from "./volatility-trend-rule";
import { dataQualityRule } from "./data-quality-rule";
import type { InsightRule } from "../types";

export const ALL_INSIGHT_RULES: InsightRule[] = [
  monthlyPerformanceRule,
  rollingAverageRule,
  benchmarkOutperformanceRule,
  inflationRule,
  concentrationRule,
  drawdownRule,
  contributionRule,
  volatilityTrendRule,
  dataQualityRule,
];
