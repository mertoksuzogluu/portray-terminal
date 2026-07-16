import { differenceInDays } from "date-fns";
import type { GeneratedInsight, InsightRule, PortfolioAnalysisContext } from "../types";
import { monthKey } from "./helpers";

const STALE_DAYS = 2;
const DELAYED_DAYS = 1;

export const dataQualityRule: InsightRule = {
  ruleId: "data-quality",

  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[] {
    if (context.assetPriceQuality.length === 0) {
      return [
        {
          category: "DATA_QUALITY",
          severity: "INFO",
          title: "Veri kalitesi",
          message: "Fiyat verisi bulunan varlık yok; veri kalitesi kontrol edilemedi.",
          fingerprint: `data-quality:${monthKey(context.asOf)}:empty`,
          periodType: "DAILY",
        },
      ];
    }

    const stale = context.assetPriceQuality.filter((a) => {
      if (!a.fetchedAt) return true;
      const age = differenceInDays(context.asOf, a.fetchedAt);
      return (
        a.dataQuality === "STALE" ||
        a.dataQuality === "ERROR" ||
        age >= STALE_DAYS
      );
    });

    const delayed = context.assetPriceQuality.filter((a) => {
      if (!a.fetchedAt) return false;
      const age = differenceInDays(context.asOf, a.fetchedAt);
      return (
        a.isDelayed ||
        a.dataQuality === "DELAYED" ||
        (age >= DELAYED_DAYS && age < STALE_DAYS)
      );
    });

    const insights: GeneratedInsight[] = [];

    if (stale.length > 0) {
      const symbols = stale.map((s) => s.symbol).slice(0, 5).join(", ");
      const extra =
        stale.length > 5 ? ` ve ${stale.length - 5} varlık daha` : "";

      insights.push({
        category: "DATA_QUALITY",
        severity: stale.length >= 3 ? "CRITICAL" : "WARNING",
        title: "Güncel olmayan fiyat verisi",
        message: `${stale.length} varlık için fiyat verisi güncel değil veya hatalı (${symbols}${extra}). Analizler bu verilere dayanmaktadır; sonuçlar yanıltıcı olabilir.`,
        fingerprint: `data-quality:stale:${monthKey(context.asOf)}`,
        periodType: "DAILY",
        metadata: {
          staleCount: stale.length,
          staleAssets: stale.map((s) => ({
            assetId: s.assetId,
            symbol: s.symbol,
            dataQuality: s.dataQuality,
          })),
        },
      });
    }

    if (delayed.length > 0 && stale.length === 0) {
      insights.push({
        category: "DATA_QUALITY",
        severity: "INFO",
        title: "Gecikmeli veri",
        message: `${delayed.length} varlık için gecikmeli fiyat verisi kullanılıyor. Gösterilen değerler anlık piyasa fiyatlarını yansıtmayabilir.`,
        fingerprint: `data-quality:delayed:${monthKey(context.asOf)}`,
        periodType: "DAILY",
        metadata: { delayedCount: delayed.length },
      });
    }

    if (context.snapshots.length === 0) {
      insights.push({
        category: "DATA_QUALITY",
        severity: "CRITICAL",
        title: "Snapshot eksik",
        message:
          "Portföy için günlük snapshot bulunamadı. Performans metrikleri hesaplanamaz.",
        fingerprint: `data-quality:no-snapshots:${monthKey(context.asOf)}`,
        periodType: "DAILY",
      });
    }

    if (insights.length === 0) {
      return [
        {
          category: "DATA_QUALITY",
          severity: "POSITIVE",
          title: "Veri kalitesi",
          message:
            "Tüm izlenen varlıklar için fiyat verisi güncel görünüyor.",
          fingerprint: `data-quality:ok:${monthKey(context.asOf)}`,
          periodType: "DAILY",
        },
      ];
    }

    return insights;
  },
};
