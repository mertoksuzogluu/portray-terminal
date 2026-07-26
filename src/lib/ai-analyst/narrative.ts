import { formatMoney, formatPercentPlain } from "@/lib/format/tr";
import type {
  MonthlyAiMetrics,
  MonthlyAiNarrative,
  PositionRecommendationItem,
  WorldEventItem,
} from "./types";

const DISCLAIMER =
  "Bu yazı yatırım tavsiyesi değildir. Bilgi amaçlıdır; kararları kendi durumuna göre ver.";

function pct(v: number | null): string {
  if (v == null) return "—";
  return formatPercentPlain(v * 100, 2, false);
}

function money(v: number | null): string {
  if (v == null) return "—";
  return formatMoney(v);
}

function monthNameTr(periodLabel: string): string {
  const [y, m] = periodLabel.split("-");
  const names = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  const mi = Number(m) - 1;
  return `${names[mi] ?? m} ${y}`;
}

function buildTemplateWorldEvents(
  periodLabel: string,
  m: MonthlyAiMetrics
): WorldEventItem[] {
  const month = monthNameTr(periodLabel);
  const events: WorldEventItem[] = [
    {
      title: `${month}: faiz ve dünya piyasaları`,
      impact:
        "Dünyada faiz ve büyüme haberleri borsa, fon ve dövizi hareket ettirir. Türkiye varlıkları da bundan etkilenir.",
      implication:
        m.volatilityAnnual != null && m.volatilityAnnual > 0.25
          ? "Portföyünüz bu ay oldukça oynak göründü. Acele alım-satım yerine küçük adımlarla ilerlemek daha güvenli olabilir."
          : "Dalgalanma aşırı görünmüyor. Planınızı bozmadan devam etmek mantıklı olabilir.",
    },
    {
      title: "Enflasyon ve yaşam maliyeti",
      impact: `Bu ay enflasyon kıyası yaklaşık ${pct(m.inflationHurdle)}. Yani paranızın alım gücünü korumak için en az bu kadar kazanç gerekir.`,
      implication:
        m.vsInflationReturn != null && m.vsInflationReturn < 0
          ? "Kazancınız enflasyonu karşılamakta zorlanmış olabilir. Bir kısmı daha sakin enstrümanlarda tutmayı düşünebilirsiniz."
          : "Bu ay enflasyona göre durum görece iyi. Yine de tüm parayı tek yerde tutmamak iyi olur.",
    },
    {
      title: "Borsa İstanbul (BIST 100)",
      impact: `BIST 100 bu dönemde ${pct(m.bist100Return)} değişti. Sizin portföyünüz ise ${pct(m.nominalReturn)}.`,
      implication:
        m.alphaVsBist != null && m.alphaVsBist < 0
          ? "Borsanın gerisinde kaldınız. Seçtiğiniz fon/hisseleri gözden geçirmek faydalı olabilir."
          : "Borsaya göre daha iyi veya yakın gittiniz. Ani büyütme yerine dengeli kalmak iyi olabilir.",
    },
  ];

  if (m.largestWeight != null && m.largestWeight > 0.4) {
    events.push({
      title: "Tek varlıkta yoğunlaşma",
      impact: `Paranızın yaklaşık %${(m.largestWeight * 100).toFixed(0)}’i tek yerde.`,
      implication:
        "Bir şey düşerse portföyünüz sert etkilenebilir. Yavaş yavaş dağıtmayı düşünebilirsiniz.",
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
      title: `${top?.key ?? "En büyük pozisyon"} payını biraz azaltın`,
      rationale: `Paranın ${pct(m.largestWeight)}’i burada. Riski düşürmek için kademeli azaltmak iyi olabilir.`,
      priority: priority++,
    });
  }

  if (m.vsDepositReturn != null && m.vsDepositReturn < 0) {
    recs.push({
      action: "PARK_CASH",
      assetClass: "CASH",
      title: "Bir miktar parayı daha sakin yerde tutun",
      rationale: `Vadeli mevduata göre bu ay geride kaldınız (${pct(m.vsDepositReturn)}). Acil para ve fırsat için nakit/para piyasası fonu düşünülebilir.`,
      priority: priority++,
    });
  }

  if (m.alphaVsBist != null && m.alphaVsBist < -0.02) {
    recs.push({
      action: "SHIFT_CLASS",
      assetClass: "EQUITY",
      title: "Borsaya göre geridesiniz — seçimleri kontrol edin",
      rationale: `BIST 100’den yaklaşık ${pct(Math.abs(m.alphaVsBist))} geridesiniz. Daha geniş ve sade fonlar işe yarayabilir.`,
      priority: priority++,
    });
  }

  if (m.maxDrawdown != null && m.maxDrawdown > 0.08) {
    recs.push({
      action: "HOLD",
      assetClass: "GOLD",
      title: "Koruma payını kontrol edin",
      rationale: `Bu ay en kötü düşüş ${pct(m.maxDrawdown)} oldu. Altın veya döviz gibi koruma payı var mı bakın.`,
      priority: priority++,
    });
  }

  if (recs.length === 0) {
    recs.push({
      action: "HOLD",
      assetClass: "FUND",
      title: "Büyük değişiklik yapmayın",
      rationale:
        "Bu ay aşırı bir sapma görünmüyor. Planınıza yakın kalıp gerekirse küçük dengeler yapmak yeterli olabilir.",
      priority: 1,
    });
  }

  return recs;
}

export function buildTemplateNarrative(
  periodLabel: string,
  m: MonthlyAiMetrics
): MonthlyAiNarrative {
  const month = monthNameTr(periodLabel);
  const worldEvents = buildTemplateWorldEvents(periodLabel, m);
  const positionRecommendations = buildTemplateRecommendations(m);

  const gainText =
    m.nominalPnl != null && m.nominalPnl >= 0
      ? `yaklaşık ${money(m.nominalPnl)} kazanç`
      : `yaklaşık ${money(m.nominalPnl != null ? Math.abs(m.nominalPnl) : null)} zarar`;

  return {
    executiveSummary: `${month} özeti: Portföyünüz bu dönemde ${pct(m.nominalReturn)} değişti (${gainText}). Borsa (BIST 100) ${pct(m.bist100Return)} gitti. En kötü düşüş ${pct(m.maxDrawdown)}, en iyi yükseliş ${pct(m.maxRise)}. Enflasyona göre ayarlı sonuç ${pct(m.vsInflationReturn)}; vadeliye göre ${pct(m.vsDepositReturn)}.`,
    performanceAnalysis: `Ay başında portföy ${money(m.startValue)}, ay sonunda ${money(m.endValue)} idi. Yatırdığınız ana para yaklaşık ${money(m.investedCapital)}. En iyi gün ${pct(m.bestDay)}, en kötü gün ${pct(m.worstDay)}. Günlerin yaklaşık ${pct(m.positiveDayRatio)}’inde değer arttı.`,
    riskAnalysis: `En kötü düşüş ${pct(m.maxDrawdown)}${m.maxDrawdownStart && m.maxDrawdownTrough ? ` (${m.maxDrawdownStart} ile ${m.maxDrawdownTrough} arasında)` : ""}. En iyi yükseliş ${pct(m.maxRise)}${m.maxRiseStart && m.maxRisePeak ? ` (${m.maxRiseStart} → ${m.maxRisePeak})` : ""}. Fiyatlar ne kadar oynak? Yaklaşık yıllık ${pct(m.volatilityAnnual)}. En büyük tek pozisyon payı ${pct(m.largestWeight)}; ilk üç toplam ${pct(m.top3Weight)}.`,
    benchmarkComparison: `BIST 100 bu dönemde ${pct(m.bist100Return)} değişti. Sizin getiriniz ${pct(m.nominalReturn)}. Fark (siz − borsa): ${pct(m.alphaVsBist)}. Borsayla ne kadar birlikte hareket ettiğiniz: ${m.correlationVsBist != null ? m.correlationVsBist.toFixed(2) : "—"}.`,
    worldEvents,
    positionRecommendations,
    outlook:
      "Gelecek ay için sakin ilerleyin: enflasyon ve faiz haberlerini izleyin, tek varlığa aşırı yüklenmeyin, yeni alımları parçalara bölün. Büyük ani değişikliklerden kaçının.",
    disclaimer: DISCLAIMER,
    source: "template",
    aiError: null,
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

function sanitizeApiKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().replace(/^["']|["']$/g, "").trim();
  return key.length > 0 ? key : null;
}

/** Basit sayılar — modele teknik jargon taşımayalım. */
function metricsForPrompt(m: MonthlyAiMetrics) {
  return {
    ayBasiPortfoy: m.startValue,
    aySonuPortfoy: m.endValue,
    yatirilanAnaPara: m.investedCapital,
    buAyKazancZarar: m.nominalPnl,
    buAyYuzde: m.nominalReturn,
    enKotuDusus: m.maxDrawdown,
    enIyiYukselis: m.maxRise,
    dalgalanmaYillik: m.volatilityAnnual,
    enIyiGun: m.bestDay,
    enKotuGun: m.worstDay,
    artiGunOrani: m.positiveDayRatio,
    enflasyonKiyasi: m.inflationHurdle,
    enflasyonaGoreSonuc: m.vsInflationReturn,
    vadeliKiyasi: m.depositHurdle,
    vadeliyeGoreSonuc: m.vsDepositReturn,
    bist100Yuzde: m.bist100Return,
    borsayaGoreFark: m.alphaVsBist,
    enBuyukPozisyonPayi: m.largestWeight,
    ilkUcPay: m.top3Weight,
    dagilim: m.allocationBySymbol.slice(0, 8).map((s) => ({
      ad: s.label,
      pay: s.weight,
      tutar: s.value,
    })),
  };
}

export async function buildAiNarrative(
  periodLabel: string,
  m: MonthlyAiMetrics,
  options?: { worldBriefing?: string | null }
): Promise<MonthlyAiNarrative> {
  const fallback = buildTemplateNarrative(periodLabel, m);
  const apiKey = sanitizeApiKey(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return {
      ...fallback,
      aiError:
        "OPENAI_API_KEY bulunamadı. Vercel’e ekleyip Redeploy yaptığınızdan emin olun.",
    };
  }

  const month = monthNameTr(periodLabel);
  const model = sanitizeApiKey(process.env.OPENAI_MODEL) || "gpt-4o-mini";
  const briefing = options?.worldBriefing?.trim() || "";

  const system = {
    role: "system",
    content: `Sen sade dille yazan bir portföy asistanısın. Türkçe yaz.
Kurallar:
- Yatırım tavsiyesi gibi emir verme; "düşünebilirsin", "bakılabilir" de.
- Finans jargonu kullanma (alpha, beta, sharpe, hurdle, volatilite, nominal, sortino, HHI yok).
- Bunun yerine: kazanç, düşüş, yükseliş, dalgalanma, enflasyon, vadeli, borsa, pay yaz.
- worldEvents’te genel laf yasak (“siyasi belirsizlik” yetmez). Ülke, olay, senaryo yaz.
- BIST yüzdesini yalnızca verilen sayılardan yaz; uydurma / abartma.
- Sadece geçerli JSON döndür.`,
  };

  const user = {
    role: "user",
    content: `Ay: ${month} (${periodLabel})
Sayılar (oranlar 0.05 = %5): ${JSON.stringify(metricsForPrompt(m))}

${
  briefing
    ? `GÜNCEL DÜNYA BRİFİNGİ (web aramasından — worldEvents’i bundan genişlet, uydurma ekleme):\n${briefing}\n`
    : "Web brifingi yok; worldEvents’te o aya özgü somut jeopolitik/makro senaryolar yaz (ör. Orta Doğu gerilimi → petrol/altın; Fed faizi → risk iştahı). Genel slogan yazma.\n"
}

JSON şema:
{
  "executiveSummary": "3-5 cümle, günlük dilde ay özeti",
  "performanceAnalysis": "ne kadar kazanıldı/kayıp, ay başı-sonu",
  "riskAnalysis": "en kötü düşüş, en iyi yükseliş, dalgalanma, tek pozisyon riski — sade dil",
  "benchmarkComparison": "BIST 100 ile karşılaştırma — SADECE verilen bist100Yuzde sayısını kullan",
  "worldEvents": [{"title":"somut başlık (ülke/olay)","impact":"ne oldu + hangi varlık (borsa/döviz/altın/petrol)","implication":"iyi/kötü senaryo ve portföy için ne anlama gelir"}],
  "positionRecommendations": [{"action":"INCREASE|DECREASE|HOLD|SHIFT_CLASS|PARK_CASH","assetClass":"FUND|EQUITY|CASH|GOLD|FX","symbol":null,"title":"kısa başlık","rationale":"neden + hangi dünya olayına bağlı, sade dil","priority":1}],
  "outlook": "gelecek ay: somut riskler ve sakin öneri, 4-6 cümle"
}

worldEvents: 5-7 madde, her biri detaylı (2-4 cümle impact + implication).
positionRecommendations: 3-5 madde; mümkünse worldEvents’e bağla.
Sayıları uydurma; verilenlere uy.`,
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [system, user],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let detail = body.slice(0, 280);
      try {
        const j = JSON.parse(body) as { error?: { message?: string } };
        if (j.error?.message) detail = j.error.message;
      } catch {
        /* keep text */
      }
      return {
        ...fallback,
        aiError: `OpenAI hata (${res.status}): ${detail}`,
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return { ...fallback, aiError: "OpenAI boş yanıt döndü." };
    }

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
      aiError: null,
    };
  } catch (err) {
    return {
      ...fallback,
      aiError:
        err instanceof Error
          ? `OpenAI isteği başarısız: ${err.message}`
          : "OpenAI isteği başarısız.",
    };
  }
}
