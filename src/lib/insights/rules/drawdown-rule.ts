import { calculateDrawdown } from "@/lib/calculations/risk";
import { formatPercentPlain } from "@/lib/format/tr";
import type { GeneratedInsight, InsightRule, PortfolioAnalysisContext } from "../types";
import { appendDisclaimer, monthKey } from "./helpers";

const WARNING_DRAWDOWN = 0.1;
const CRITICAL_DRAWDOWN = 0.2;

export const drawdownRule: InsightRule = {
  ruleId: "drawdown",

  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[] {
    if (context.snapshots.length < 5) {
      return [
        {
          category: "DRAWDOWN",
          severity: "INFO",
          title: "Drawdown",
          message:
            "Drawdown analizi için yeterli günlük veri yok (en az 5 gün gerekli).",
          fingerprint: `drawdown:${monthKey(context.asOf)}:insufficient`,
          periodType: "DAILY",
          metadata: { observationCount: context.snapshots.length },
        },
      ];
    }

    const values = context.snapshots.map((s) => ({
      date: s.snapshotDate,
      value: s.totalMarketValue,
    }));

    const dd = calculateDrawdown(values);
    const current = dd.currentDrawdown;
    const max = dd.maxDrawdown;

    if (current === null && max === null) {
      return [
        {
          category: "DRAWDOWN",
          severity: "INFO",
          title: "Drawdown",
          message: "Drawdown hesaplanamadı.",
          fingerprint: `drawdown:${monthKey(context.asOf)}:null`,
          periodType: "DAILY",
        },
      ];
    }

    const insights: GeneratedInsight[] = [];

    if (current !== null && current.gt(0)) {
      let severity: GeneratedInsight["severity"] = "INFO";
      if (current.gte(CRITICAL_DRAWDOWN)) severity = "CRITICAL";
      else if (current.gte(WARNING_DRAWDOWN)) severity = "WARNING";

      insights.push({
        category: "DRAWDOWN",
        severity,
        title: "Güncel drawdown",
        message: appendDisclaimer(
          `Portföyünüz zirve değerinden ${formatPercentPlain(current)} geride. ${severity === "CRITICAL" ? "Belirgin bir düşüş gözlemleniyor." : severity === "WARNING" ? "Orta düzeyde bir geri çekilme var." : "Hafif bir geri çekilme söz konusu."}`
        ),
        fingerprint: `drawdown:current:${monthKey(context.asOf)}`,
        periodType: "DAILY",
        metadata: {
          currentDrawdown: current.toString(),
          peakDate: dd.peakDate?.toISOString() ?? null,
        },
      });
    }

    if (max !== null && max.gt(0)) {
      const stillInDrawdown = dd.recoveryDate === null && max.gt(WARNING_DRAWDOWN);
      insights.push({
        category: "DRAWDOWN",
        severity: max.gte(CRITICAL_DRAWDOWN) ? "WARNING" : "INFO",
        title: "Maksimum drawdown",
        message: appendDisclaimer(
          `Gözlemlenen dönemde maksimum drawdown ${formatPercentPlain(max)}.${dd.maxDrawdownTroughDate ? ` Dip tarihi: ${dd.maxDrawdownTroughDate.toISOString().slice(0, 10)}.` : ""}${dd.recoveryDate ? " Zirve seviyesine dönüş gerçekleşmiş." : stillInDrawdown ? " Henüz tam toparlanma görünmüyor." : ""}`
        ),
        fingerprint: `drawdown:max:${monthKey(context.asOf)}`,
        periodType: "CUSTOM",
        metadata: {
          maxDrawdown: max.toString(),
          startDate: dd.maxDrawdownStartDate?.toISOString() ?? null,
          troughDate: dd.maxDrawdownTroughDate?.toISOString() ?? null,
          recoveryDate: dd.recoveryDate?.toISOString() ?? null,
        },
      });
    }

    if (insights.length === 0) {
      return [
        {
          category: "DRAWDOWN",
          severity: "POSITIVE",
          title: "Drawdown",
          message: appendDisclaimer(
            "Portföyünüz gözlemlenen dönemde belirgin bir geri çekilme göstermiyor."
          ),
          fingerprint: `drawdown:none:${monthKey(context.asOf)}`,
          periodType: "DAILY",
        },
      ];
    }

    return insights;
  },
};
