import { formatMoney, formatPercentPlain } from "@/lib/format/tr";
import type {
  MonthlyAiMetrics,
  MonthlyAiNarrative,
  PositionRecommendationItem,
  WorldEventItem,
} from "./types";

const DISCLAIMER =
  "Bu rapor yatırım tavsiyesi değildir. AI Analist çıktıları bilgilendirme amaçlıdır; kararlarınızı kendi araştırmanız ve risk toleransınız doğrultusunda verin.";

function pct(v: number | null): string {
  if (v == null) return "—";
  return formatPercentPlain(v * 100, 2, false);
}

function money(v: number | null): string {
  if (v == null) return "—";
  return formatMoney(v);
}

function buildTemplateWorldEvents(
  periodLabel: string,
  m: MonthlyAiMetrics
): WorldEventItem[] {
  const events: WorldEventItem[] = [
    {
      title: `${periodLabel}: küresel faiz ve risk iştahı`,
      impact:
        "Gelişmiş ülke merkez bankası beklentileri riskli varlık fiyatlarını ve Türkiye varlıklarına sermaye akışını etkiler.",
      implication:
        m.volatilityAnnual != null && m.volatilityAnnual > 0.25
          ? "Portföy volatilitesi yüksek; nakit/altın tamponu ve kademeli alım düşünülebilir."
          : "Volatilite ılımlı; hedef dağılıma yakın kalın, ani kaldıraçtan kaçının.",
    },
    {
      title: "Türkiye enflasyonu ve reel getiri baskısı",
      impact: `${m.inflationLabel} hurdle ${pct(m.inflationHurdle)}; mevduat hurdle ${pct(m.depositHurdle)}.`,
      implication:
        m.vsInflationReturn != null && m.vsInflationReturn < 0
          ? "Nominal getiri enflasyonu karşılamakta zorlanıyor; reel koruma (altın/döviz/kısa vadeli fon) ağırlığı gözden geçirilmeli."
          : "Enflasyona göre dönem getirisi göreli olumlu; kârı kilitlemek için aşırı tek varlık yoğunluğunu sınırlayın.",
    },
    {
      title: "BIST 100 ve yurt içi hisse piyasası",
      impact: `Dönem BIST 100 getirisi ${pct(m.bist100Return)}; portföy alpha ${pct(m.alphaVsBist)}.`,
      implication:
        m.alphaVsBist != null && m.alphaVsBist < 0
          ? "Endeksin gerisinde kalındı; beta/yoğunluk ve fon seçimini gözden geçirin."
          : "Endekse göre göreli performans olumlu; momentum peşinde aşırı konsantrasyondan kaçının.",
    },
  ];

  if (m.largestWeight != null && m.largestWeight > 0.4) {
    events.push({
      title: "Yoğunlaşma riski",
      impact: `Tek pozisyon ağırlığı %${(m.largestWeight * 100).toFixed(1)}.`,
      implication:
        "Tek isim / tek tema şoku portföyü sert sarsabilir; kademeli dengeleme önerilir.",
    });
  }

  return events;
}

function buildTemplateRecommendations(
  m: MonthlyAiMetrics
): PositionRecommendationItem[] {
  const recs: PositionRecommendationItem[] = [];
  let priority = 1;

  if (m.largestWeight != null && m.largestWeight > 0.35) {
    const top = m.allocationBySymbol[0];
    recs.push({
      action: "DECREASE",
      assetClass: "FUND",
      symbol: top?.key ?? null,
      title: "Yoğun pozisyonu azalt",
      rationale: `En büyük ağırlık ${pct(m.largestWeight)}. Tek varlık riskini düşürmek için kademeli azaltım düşünün.`,
      priority: priority++,
    });
  }

  if (m.vsDepositReturn != null && m.vsDepositReturn < 0) {
    recs.push({
      action: "PARK_CASH",
      assetClass: "CASH",
      title: "Vadeli / para piyasası tamponu",
      rationale: `Mevduata göre ayarlanmış getiri ${pct(m.vsDepositReturn)}. Likidite ve fırsat rezervi için kısa vadeli fon/nakit payını artırın.`,
      priority: priority++,
    });
  }

  if (m.alphaVsBist != null && m.alphaVsBist < -0.02) {
    recs.push({
      action: "SHIFT_CLASS",
      assetClass: "EQUITY",
      title: "BIST’e göre geride — dağılımı gözden geçir",
      rationale: `Alpha ${pct(m.alphaVsBist)}. Endeks / geniş fonlar ile aktif seçim dengesini yeniden kurun.`,
      priority: priority++,
    });
  }

  if (m.maxDrawdown != null && m.maxDrawdown > 0.08) {
    recs.push({
      action: "HOLD",
      assetClass: "GOLD",
      title: "Düşüş tamponu (altın / döviz)",
      rationale: `Dönem maks. düşüş ${pct(m.maxDrawdown)}. Koruma sınıfı (altın/FX) hedef ağırlığını kontrol edin.`,
      priority: priority++,
    });
  }

  if (recs.length === 0) {
    recs.push({
      action: "HOLD",
      assetClass: "FUND",
      title: "Mevcut dağılımı koru, hedefe yakın kal",
      rationale:
        "Metrikler aşırı sapma göstermiyor. Planlı yeniden dengeleme dışında agresif değişiklik önerilmiyor.",
      priority: 1,
    });
  }

  return recs;
}

export function buildTemplateNarrative(
  periodLabel: string,
  m: MonthlyAiMetrics
): MonthlyAiNarrative {
  const worldEvents = buildTemplateWorldEvents(periodLabel, m);
  const positionRecommendations = buildTemplateRecommendations(m);

  return {
    executiveSummary: `${periodLabel} AI Analist özeti: Portföy nominal getiri ${pct(m.nominalReturn)} (${money(m.nominalPnl)}), BIST 100 ${pct(m.bist100Return)}, alpha ${pct(m.alphaVsBist)}. Maks. düşüş ${pct(m.maxDrawdown)}, maks. yükseliş ${pct(m.maxRise)}, yıllıklaştırılmış volatilite ${pct(m.volatilityAnnual)}, Sharpe ${m.sharpeRatio?.toFixed(2) ?? "—"}. Enflasyona göre ayarlı getiri ${pct(m.vsInflationReturn)}; vadeliye göre ${pct(m.vsDepositReturn)}.`,
    performanceAnalysis: `Dönem başı değer ${money(m.startValue)}, dönem sonu ${money(m.endValue)}, ana para ${money(m.investedCapital)}. En iyi gün ${pct(m.bestDay)}, en kötü gün ${pct(m.worstDay)}; pozitif gün oranı ${pct(m.positiveDayRatio)}. ${m.observationCount} gözlemle hesaplandı.`,
    riskAnalysis: `Maksimum düşüş ${pct(m.maxDrawdown)}${m.maxDrawdownStart && m.maxDrawdownTrough ? ` (${m.maxDrawdownStart} → ${m.maxDrawdownTrough})` : ""}. Maksimum yükseliş ${pct(m.maxRise)}${m.maxRiseStart && m.maxRisePeak ? ` (${m.maxRiseStart} → ${m.maxRisePeak})` : ""}. Sortino ${m.sortinoRatio?.toFixed(2) ?? "—"}. En büyük ağırlık ${pct(m.largestWeight)}, ilk 3 toplam ${pct(m.top3Weight)}, HHI ${m.hhi?.toFixed(3) ?? "—"}.`,
    benchmarkComparison: `BIST 100 dönem getirisi ${pct(m.bist100Return)} (seviye ${m.bist100Start?.toFixed(0) ?? "—"} → ${m.bist100End?.toFixed(0) ?? "—"}). Portföy beta ${m.betaVsBist?.toFixed(2) ?? "—"}, korelasyon ${m.correlationVsBist?.toFixed(2) ?? "—"}. Alpha (portföy − BIST) ${pct(m.alphaVsBist)}.`,
    worldEvents,
    positionRecommendations,
    outlook:
      "Önümüzdeki ay için: enflasyon ve faiz görünümünü izleyin; yoğun pozisyonları kademeli dengeleyin; BIST’e göre alpha zayıfsa geniş endeks/fon payını artırın. Yeni alımları tek seferde değil, kademeli planlayın.",
    disclaimer: DISCLAIMER,
    source: "template",
  };
}

interface OpenAiNarrativeJson {
  executiveSummary?: string;
  performanceAnalysis?: string;
  riskAnalysis?: string;
  benchmarkComparison?: string;
  worldEvents?: WorldEventItem[];
  positionRecommendations?: PositionRecommendationItem[];
  outlook?: string;
}

export async function buildAiNarrative(
  periodLabel: string,
  m: MonthlyAiMetrics
): Promise<MonthlyAiNarrative> {
  const fallback = buildTemplateNarrative(periodLabel, m);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback;

  const prompt = {
    role: "system",
    content:
      "Sen Türkiye odaklı bir portföy AI analistisin. Yatırım tavsiyesi vermiyorsun; riskleri ve senaryoları açıklıyorsun. Yanıtı yalnızca geçerli JSON olarak ver.",
  };

  const user = {
    role: "user",
    content: `Dönem: ${periodLabel}
Metrikler (JSON): ${JSON.stringify(m)}

Şu şemada Türkçe JSON üret:
{
  "executiveSummary": string,
  "performanceAnalysis": string,
  "riskAnalysis": string,
  "benchmarkComparison": string,
  "worldEvents": [{"title": string, "impact": string, "implication": string}],
  "positionRecommendations": [{"action": "INCREASE"|"DECREASE"|"HOLD"|"SHIFT_CLASS"|"PARK_CASH", "assetClass": string, "symbol": string|null, "title": string, "rationale": string, "priority": number}],
  "outlook": string
}

worldEvents: o aya dair temel küresel/Türkiye makro olayları ve portföye etkisi (3-5 madde).
positionRecommendations: metrik + olaylara dayalı somut pozisyon önerileri (3-6 madde).
Abartma; sayılara sadık kal.`,
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [prompt, user],
      }),
    });

    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as OpenAiNarrativeJson;

    return {
      executiveSummary: parsed.executiveSummary ?? fallback.executiveSummary,
      performanceAnalysis:
        parsed.performanceAnalysis ?? fallback.performanceAnalysis,
      riskAnalysis: parsed.riskAnalysis ?? fallback.riskAnalysis,
      benchmarkComparison:
        parsed.benchmarkComparison ?? fallback.benchmarkComparison,
      worldEvents:
        Array.isArray(parsed.worldEvents) && parsed.worldEvents.length > 0
          ? parsed.worldEvents
          : fallback.worldEvents,
      positionRecommendations:
        Array.isArray(parsed.positionRecommendations) &&
        parsed.positionRecommendations.length > 0
          ? parsed.positionRecommendations
          : fallback.positionRecommendations,
      outlook: parsed.outlook ?? fallback.outlook,
      disclaimer: DISCLAIMER,
      source: "openai",
    };
  } catch {
    return fallback;
  }
}
