import { d } from "@/lib/calculations/decimal";
import {
  ASSET_CLASSES,
  ASSET_CLASS_LABELS,
  DEVIATION_THRESHOLD,
  DEFAULT_TARGET_WEIGHTS,
  MAX_SINGLE_MOVE,
  RISK_SCORE_TARGETS,
  type AssetClassId,
  type DraftRecommendation,
  type EngineResult,
  type HoldingInput,
  type RiskProfileId,
  type RiskScoreInput,
} from "./types";
import {
  computePortfolioRiskScore,
  estimatePostTradeRiskScore,
  isWithinRiskBand,
  scoreInstrument,
} from "./scoring";

export function normalizeClassWeights(
  holdings: HoldingInput[]
): Record<AssetClassId, number> {
  const weights = Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Record<
    AssetClassId,
    number
  >;
  for (const h of holdings) {
    weights[h.assetClass] = (weights[h.assetClass] ?? 0) + h.weight;
  }
  const sum = ASSET_CLASSES.reduce((acc, c) => acc + weights[c], 0);
  if (sum <= 0) {
    weights.CASH = 1;
    return weights;
  }
  for (const c of ASSET_CLASSES) {
    weights[c] = weights[c] / sum;
  }
  return weights;
}

export function resolveTargetWeights(
  profile: RiskProfileId,
  overrides?: Partial<Record<AssetClassId, number>>
): Record<AssetClassId, number> {
  const base = { ...DEFAULT_TARGET_WEIGHTS[profile] };
  if (overrides) {
    for (const c of ASSET_CLASSES) {
      if (overrides[c] !== undefined) base[c] = overrides[c]!;
    }
  }
  const sum = ASSET_CLASSES.reduce((acc, c) => acc + base[c], 0);
  if (sum <= 0) return { ...DEFAULT_TARGET_WEIGHTS.BALANCED };
  for (const c of ASSET_CLASSES) {
    base[c] = base[c] / sum;
  }
  return base;
}

function pct(n: number): string {
  return `%${(n * 100).toFixed(1)}`;
}

/**
 * Saf öneri motoru — DB bağımsız, birim test edilebilir.
 */
export function buildRecommendations(params: {
  riskProfile: RiskProfileId;
  riskInput: RiskScoreInput;
  holdings: HoldingInput[];
  targetOverrides?: Partial<Record<AssetClassId, number>>;
}): EngineResult {
  const { riskProfile, riskInput, holdings } = params;
  const riskScore = computePortfolioRiskScore(riskInput);
  const targetRisk = RISK_SCORE_TARGETS[riskProfile].target;
  const classWeights = normalizeClassWeights(holdings);
  const targetWeights = resolveTargetWeights(riskProfile, params.targetOverrides);

  const drafts: DraftRecommendation[] = [];

  // Sınıf sapmaları
  const overweight: AssetClassId[] = [];
  const underweight: AssetClassId[] = [];
  for (const cls of ASSET_CLASSES) {
    const cur = classWeights[cls];
    const tgt = targetWeights[cls];
    const delta = cur - tgt;
    if (Math.abs(delta) < DEVIATION_THRESHOLD) continue;
    if (delta > 0) overweight.push(cls);
    else underweight.push(cls);
  }

  // Nakit aşırıysa PARK_CASH / dağıtım
  if (classWeights.CASH - targetWeights.CASH >= DEVIATION_THRESHOLD) {
    const excess = Math.min(MAX_SINGLE_MOVE, classWeights.CASH - targetWeights.CASH);
    const destinations: AssetClassId[] = underweight.filter((c) => c !== "CASH");
    const fundCandidates = holdings
      .filter((h) => h.assetClass === "FUND" || destinations.includes(h.assetClass))
      .map((h) => ({ h, score: scoreInstrument(h, riskProfile) }))
      .sort((a, b) => b.score.cmp(a.score));

    if (destinations.length === 0) {
      drafts.push({
        action: "PARK_CASH",
        assetClass: "FUND",
        title: "Fazla nakiti para piyasası / fon bandına kaydır",
        message: `Nakit ${pct(classWeights.CASH)} iken hedef ${pct(targetWeights.CASH)}. Enflasyona karşı kısa vadeli fon parkı düşünülebilir.`,
        currentWeight: d(classWeights.CASH),
        targetWeight: d(targetWeights.CASH),
        suggestedDelta: d(-excess),
        score: d(70),
        rationale: { reason: "excess_cash", excess },
      });
    } else {
      const share = excess / destinations.length;
      for (const cls of destinations.slice(0, 3)) {
        const top = fundCandidates.find((c) => c.h.assetClass === cls);
        drafts.push({
          action: "SHIFT_CLASS",
          assetClass: cls,
          assetId: top?.h.assetId,
          symbol: top?.h.symbol,
          title: `Nakit → ${ASSET_CLASS_LABELS[cls]} kaydır`,
          message: `Hedef ${ASSET_CLASS_LABELS[cls]} ${pct(targetWeights[cls])}, mevcut ${pct(classWeights[cls])}. Yaklaşık ${pct(share)} nakit bu sınıfa kademeli aktarılabilir${
            top ? ` (aday: ${top.h.symbol})` : ""
          }.`,
          currentWeight: d(classWeights[cls]),
          targetWeight: d(targetWeights[cls]),
          suggestedDelta: d(share),
          score: top?.score ?? d(60),
          rationale: {
            reason: "rebalance_from_cash",
            from: "CASH",
            instrumentScore: top?.score.toNumber() ?? null,
          },
        });
      }
    }
  }

  // Aşırı sınıfları azalt
  for (const cls of overweight) {
    if (cls === "CASH" && drafts.some((x) => x.action === "SHIFT_CLASS" || x.action === "PARK_CASH")) {
      continue;
    }
    const cut = Math.min(MAX_SINGLE_MOVE, classWeights[cls] - targetWeights[cls]);
    const heavy = holdings
      .filter((h) => h.assetClass === cls)
      .map((h) => ({ h, score: scoreInstrument(h, riskProfile) }))
      .sort((a, b) => a.score.cmp(b.score)); // düşük skor önce azaltılır
    const victim = heavy[0];
    drafts.push({
      action: "DECREASE",
      assetClass: cls,
      assetId: victim?.h.assetId,
      symbol: victim?.h.symbol,
      title: `${ASSET_CLASS_LABELS[cls]} ağırlığını azalt`,
      message: `${ASSET_CLASS_LABELS[cls]} ${pct(classWeights[cls])} → hedef ${pct(targetWeights[cls])}. Yaklaşık ${pct(cut)} azaltma önerilir${
        victim ? ` (öncelik: ${victim.h.symbol})` : ""
      }.`,
      currentWeight: d(classWeights[cls]),
      targetWeight: d(targetWeights[cls]),
      suggestedDelta: d(-cut),
      score: victim ? d(100).minus(victim.score) : d(55),
      rationale: { reason: "overweight_class", cut },
    });
  }

  // Eksik sınıfları artır (nakit kaydırma yoksa)
  for (const cls of underweight) {
    if (cls === "CASH") continue;
    if (drafts.some((x) => x.assetClass === cls && (x.action === "INCREASE" || x.action === "SHIFT_CLASS"))) {
      continue;
    }
    const add = Math.min(MAX_SINGLE_MOVE, targetWeights[cls] - classWeights[cls]);
    const candidates = holdings
      .filter((h) => h.assetClass === cls)
      .map((h) => ({ h, score: scoreInstrument(h, riskProfile) }))
      .sort((a, b) => b.score.cmp(a.score));
    const pick = candidates[0];
    drafts.push({
      action: "INCREASE",
      assetClass: cls,
      assetId: pick?.h.assetId,
      symbol: pick?.h.symbol,
      title: `${ASSET_CLASS_LABELS[cls]} ağırlığını artır`,
      message: `${ASSET_CLASS_LABELS[cls]} ${pct(classWeights[cls])} → hedef ${pct(targetWeights[cls])}. Yaklaşık ${pct(add)} artış düşünülebilir${
        pick ? ` (aday: ${pick.h.symbol}, skor ${pick.score.toFixed(0)})` : " (sınıf içinde yeni pozisyon)"
      }.`,
      currentWeight: d(classWeights[cls]),
      targetWeight: d(targetWeights[cls]),
      suggestedDelta: d(add),
      score: pick?.score ?? d(58),
      rationale: {
        reason: "underweight_class",
        add,
        instrumentScore: pick?.score.toNumber() ?? null,
      },
    });
  }

  // Risk bandı kırpma
  let clipped = false;
  let netEquity = 0;
  let netCash = 0;
  for (const rec of drafts) {
    const delta = rec.suggestedDelta.toNumber();
    if (rec.assetClass === "EQUITY") netEquity += delta;
    if (rec.assetClass === "CASH") netCash += delta;
    if (rec.action === "SHIFT_CLASS" && rec.assetClass === "EQUITY") netEquity += delta;
    if (rec.action === "SHIFT_CLASS" || rec.action === "PARK_CASH") netCash -= Math.abs(delta);
  }

  let projected = estimatePostTradeRiskScore(riskScore, netEquity, netCash);
  if (!isWithinRiskBand(projected, riskProfile) && drafts.length > 0) {
    clipped = true;
    // En agresif INCREASE/SHIFT equity önerilerini yarıya indir
    for (const rec of drafts) {
      if (
        (rec.action === "INCREASE" || rec.action === "SHIFT_CLASS") &&
        rec.assetClass === "EQUITY" &&
        rec.suggestedDelta.gt(0)
      ) {
        rec.suggestedDelta = rec.suggestedDelta.div(2);
        rec.score = rec.score.times(0.9);
        rec.message += " (Risk bandı için öneri büyüklüğü yarıya indirildi.)";
        rec.rationale = { ...rec.rationale, clipped: true };
      }
    }
    projected = estimatePostTradeRiskScore(
      riskScore,
      netEquity / 2,
      netCash / 2
    );
  }

  // Sapma yoksa HOLD bilgilendirme
  if (drafts.length === 0) {
    drafts.push({
      action: "HOLD",
      assetClass: "CASH",
      title: "Dağılım hedefe yakın — tut",
      message: `Mevcut sınıf ağırlıkları ${riskProfile} profil hedefinin ±${pct(DEVIATION_THRESHOLD)} bandında. Büyük değişiklik önerilmiyor.`,
      currentWeight: d(classWeights.CASH),
      targetWeight: d(targetWeights.CASH),
      suggestedDelta: d(0),
      score: d(50),
      rationale: { reason: "on_target", riskScore: riskScore.toNumber() },
    });
  }

  // Skora göre sırala (HOLD en sonda)
  drafts.sort((a, b) => {
    if (a.action === "HOLD") return 1;
    if (b.action === "HOLD") return -1;
    return b.score.cmp(a.score);
  });

  return {
    riskScore,
    targetRisk,
    classWeights,
    targetWeights,
    recommendations: drafts.slice(0, 8),
    clipped,
    inputSummary: {
      riskProfile,
      riskScore: riskScore.toNumber(),
      targetRisk,
      projectedRisk: projected.toNumber(),
      classWeights,
      targetWeights,
      holdingsCount: holdings.length,
      clipped,
    },
  };
}
