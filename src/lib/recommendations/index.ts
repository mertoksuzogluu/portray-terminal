export { buildRecommendations, normalizeClassWeights, resolveTargetWeights } from "./engine";
export { computePortfolioRiskScore, scoreInstrument } from "./scoring";
export { assetTypeToClass } from "./asset-class";
export {
  runRecommendationEngine,
  runRecommendationsForAllPortfolios,
  getActiveRecommendations,
  ensureDefaultTargetAllocations,
} from "./service";
export * from "./types";
