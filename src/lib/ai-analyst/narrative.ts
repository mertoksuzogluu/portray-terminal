import { formatMoney, formatPercentPlain } from "@/lib/format/tr";
import type {
  MonthlyAiMetrics,
  MonthlyAiNarrative,
  PositionRecommendationItem,
  TopHoldingSpotlight,
  WorldEventItem,
} from "./types";
import type { TopHoldingInfo } from "./top-holding-briefing";

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

function portfolioComposition(m: MonthlyAiMetrics) {
  const byClass = Object.fromEntries(
    m.allocationByClass.map((c) => [c.key, c.weight])
  ) as Record<string, number>;
  const fundW = byClass.FUND ?? 0;
  const equityW = byClass.EQUITY ?? 0;
  const goldW = byClass.GOLD ?? 0;
  const fxW = byClass.FX ?? 0;
  const cashW = byClass.CASH ?? 0;
  const totalReturn =
    m.endValue != null &&
    m.investedCapital != null &&
    m.investedCapital > 0
      ? (m.endValue - m.investedCapital) / m.investedCapital
      : null;
  return {
    fundW,
    equityW,
    goldW,
    fxW,
    cashW,
    hasDirectEquity: equityW > 0.01,
    mostlyFunds: fundW >= 0.85,
    totalReturn,
  };
}

function buildTemplateRecommendations(
  m: MonthlyAiMetrics,
  holding?: TopHoldingInfo | null
): PositionRecommendationItem[] {
  const recs: PositionRecommendationItem[] = [];
  let priority = 1;
  const comp = portfolioComposition(m);
  const top = holding ??
    (m.allocationBySymbol[0]
      ? {
          symbol: m.allocationBySymbol[0].key,
          name: m.allocationBySymbol[0].label,
          weight: m.allocationBySymbol[0].weight,
          value: m.allocationBySymbol[0].value,
        }
      : null);

  // 1) Ana ürün: WHY ile koru / dikkat
  if (top && top.weight >= 0.25) {
    const profitBit =
      comp.totalReturn != null
        ? `Toplamda yaklaşık ${pct(comp.totalReturn)} kârdasınız.`
        : m.nominalReturn != null
          ? `Bu dönemde yaklaşık ${pct(m.nominalReturn)} getiri görünüyor.`
          : "";
    const beatDeposit =
      m.vsDepositPnl != null && m.vsDepositPnl >= 0
        ? " Aynı sürede vadeliyi de geçmiş görünüyorsunuz."
        : m.vsDepositPnl != null
          ? " Aynı sürede vadeli biraz daha önde; yine de düzenli getiri tarafı güçlü."
          : "";
    recs.push({
      action: "HOLD",
      assetClass: "FUND",
      symbol: top.symbol,
      title: `${top.symbol}’yi şimdilik tutun — ama nedeni bu`,
      rationale: `${top.symbol}${top.name && top.name !== top.symbol ? ` (${top.name})` : ""} portföyünüzün ~${pct(top.weight)}’i. ${profitBit}${beatDeposit} Düzenli / sakin getiri profili gibi duruyor; acele satmak zorunda değilsiniz. Yeni büyük para eklerken payı daha da şişirmemeye dikkat edin (tek üründe aşırı yığılma).`,
      priority: priority++,
    });
  }

  // 2) Hisse yok / çok az → riskli ürüne acele etme
  if (!comp.hasDirectEquity) {
    recs.push({
      action: "HOLD",
      assetClass: "EQUITY",
      symbol: null,
      title: "Doğrudan hisse alımını şimdilik bekletin",
      rationale: `Portföyünüzde doğrudan hisse senedi görünmüyor${comp.mostlyFunds ? "; ağırlık fonlarda" : ""}. Piyasa ve jeopolitik haberler oynakken yeni hisse / yüksek riskli ürüne acele etmeyin. Planınız varsa bile kademeli ve küçük payla düşünün; ana paranız sakin tarafta kalsın.`,
      priority: priority++,
    });
  } else if (comp.equityW < 0.1) {
    recs.push({
      action: "HOLD",
      assetClass: "EQUITY",
      symbol: null,
      title: "Hisse payınız düşük — büyütmeyi aceleye getirmeyin",
      rationale: `Hisse / riskli taraf yaklaşık ${pct(comp.equityW)}. Artırmak isterseniz tek seferde değil, küçük adımlarla ve gerekçeniz netken ilerleyin.`,
      priority: priority++,
    });
  }

  // 3) Yoğunlaşma uyarısı (HOLD ile çelişmesin: azalt deme, yeni para yönlendir)
  if (top && top.weight >= 0.5) {
    recs.push({
      action: "SHIFT_CLASS",
      assetClass: "FUND",
      symbol: top.symbol,
      title: `Yeni birikimi ${top.symbol} dışına yönlendirin`,
      rationale: `${top.symbol} zaten çok ağır (~${pct(top.weight)}). Mevcutı satmak zorunda değilsiniz; bundan sonraki yatırımları başka fon / nakit / koruma tarafına bölmek tek ürün riskini yumuşatır.`,
      priority: priority++,
    });
  }

  // 4) Vadeliye göre gerideyse
  if (m.vsDepositReturn != null && m.vsDepositReturn < -0.005) {
    recs.push({
      action: "PARK_CASH",
      assetClass: "CASH",
      title: "Bir kısmı daha öngörülebilir tutun",
      rationale: `Bu kıyas penceresinde vadeli yaklaşık ${money(m.depositOpportunityPnl)} getirecekti; portföy farkı ${money(m.vsDepositPnl)}. Acil para ve fırsat için kısa vadeli / para piyasası payına bakılabilir — hepsini bozmak şart değil.`,
      priority: priority++,
    });
  }

  // 5) Koruma sınıfı yoksa nazik hatırlatma
  if ((comp.goldW ?? 0) + (comp.fxW ?? 0) < 0.02 && comp.fundW > 0.7) {
    recs.push({
      action: "HOLD",
      assetClass: "GOLD",
      symbol: null,
      title: "İsterseniz küçük bir koruma payı düşünün",
      rationale:
        "Portföy çoğunlukla fon tarafında; altın veya döviz gibi küçük bir tampon yok. Zorunlu değil — sadece sürpriz haberlere karşı isteğe bağlı çeşitlilik.",
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

  return recs.slice(0, 5);
}

function buildTemplateTopHolding(
  holding: TopHoldingInfo | null | undefined
): TopHoldingSpotlight | null {
  if (!holding) return null;
  const label =
    holding.name && holding.name !== holding.symbol
      ? `${holding.symbol} (${holding.name})`
      : holding.symbol;
  return {
    symbol: holding.symbol,
    name: holding.name || holding.symbol,
    weight: holding.weight,
    value: holding.value,
    summary: `${label} portföyünüzün yaklaşık ${pct(holding.weight)}’ini oluşturuyor (${money(holding.value)}). En büyük pozisyon olduğu için bu üründeki haber ve yorumlar tüm portföyü etkiler.`,
    whatPeopleSay:
      "Sosyal medya taraması bu raporda çalışmadı. X/Twitter ve yatırım forumlarında fon/hisse kodunu aratarak güncel yorumlara bakabilirsiniz.",
    expectations:
      "Faiz ve enflasyon haberleri bu tür ürünlerin getirisine yön verir. Büyük değişiklik öncesi resmi açıklamaları ve TEFAS/piyasa verisini kontrol etmek iyi olur.",
    currentSituation: `${label} şu an portföyünüzün omurgası. Pay bu kadar yüksekken tek ürün riski de yüksektir.`,
    risksAndWatch:
      "Tek üründe yoğunlaşma, faiz kararı, alternatif ürünlere geçiş dalgası ve likidite. Payı kademeli dengelemek düşünülebilir.",
    sourcesNote: "Şablon metin — web/X taraması yok.",
  };
}

export function buildTemplateNarrative(
  periodLabel: string,
  m: MonthlyAiMetrics,
  holding?: TopHoldingInfo | null
): MonthlyAiNarrative {
  const month = monthNameTr(periodLabel);
  const worldEvents = buildTemplateWorldEvents(periodLabel, m);
  const positionRecommendations = buildTemplateRecommendations(m, holding);
  const top =
    holding ??
    (m.allocationBySymbol[0]
      ? {
          symbol: m.allocationBySymbol[0].key,
          name: m.allocationBySymbol[0].label,
          weight: m.allocationBySymbol[0].weight,
          value: m.allocationBySymbol[0].value,
        }
      : null);

  const gainText =
    m.nominalPnl != null && m.nominalPnl >= 0
      ? `yaklaşık ${money(m.nominalPnl)} kazanç`
      : `yaklaşık ${money(m.nominalPnl != null ? Math.abs(m.nominalPnl) : null)} zarar`;

  return {
    executiveSummary: `${month} özeti: Portföyünüz bu dönemde ${pct(m.nominalReturn)} değişti (${gainText}). Borsa (BIST 100) ${pct(m.bist100Return)} gitti. En kötü düşüş ${pct(m.maxDrawdown)}, en iyi yükseliş ${pct(m.maxRise)}. Aynı sürede vadeli yaklaşık ${money(m.depositOpportunityPnl)} getirecekti; fark ${money(m.vsDepositPnl)} (${pct(m.vsDepositReturn)}). Enflasyona göre fark ${money(m.vsInflationPnl)}.`,
    performanceAnalysis: `Ay başında portföy ${money(m.startValue)}, ay sonunda ${money(m.endValue)} idi. Yatırdığınız ana para yaklaşık ${money(m.investedCapital)}. En iyi gün ${pct(m.bestDay)}, en kötü gün ${pct(m.worstDay)}. Günlerin yaklaşık ${pct(m.positiveDayRatio)}’inde değer arttı.`,
    riskAnalysis: `En kötü düşüş ${pct(m.maxDrawdown)}${m.maxDrawdownStart && m.maxDrawdownTrough ? ` (${m.maxDrawdownStart} ile ${m.maxDrawdownTrough} arasında)` : ""}. En iyi yükseliş ${pct(m.maxRise)}${m.maxRiseStart && m.maxRisePeak ? ` (${m.maxRiseStart} → ${m.maxRisePeak})` : ""}. Fiyatlar ne kadar oynak? Yaklaşık yıllık ${pct(m.volatilityAnnual)}. En büyük tek pozisyon payı ${pct(m.largestWeight)}; ilk üç toplam ${pct(m.top3Weight)}.`,
    benchmarkComparison: `BIST 100 bu dönemde ${pct(m.bist100Return)} değişti. Sizin getiriniz ${pct(m.nominalReturn)}. Fark (siz − borsa): ${pct(m.alphaVsBist)}. Borsayla ne kadar birlikte hareket ettiğiniz: ${m.correlationVsBist != null ? m.correlationVsBist.toFixed(2) : "—"}.`,
    worldEvents,
    topHoldingSpotlight: buildTemplateTopHolding(top),
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
  topHoldingSpotlight?: Partial<TopHoldingSpotlight> | null;
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
  const comp = portfolioComposition(m);
  return {
    ayBasiPortfoy: m.startValue,
    aySonuPortfoy: m.endValue,
    yatirilanAnaPara: m.investedCapital,
    buAyKazancZarar: m.nominalPnl,
    buAyYuzde: m.nominalReturn,
    toplamKumulatifGetiri: comp.totalReturn,
    enKotuDusus: m.maxDrawdown,
    enIyiYukselis: m.maxRise,
    dalgalanmaYillik: m.volatilityAnnual,
    enIyiGun: m.bestDay,
    enKotuGun: m.worstDay,
    artiGunOrani: m.positiveDayRatio,
    kiyasGunSayisi: m.heldDays,
    enflasyonKiyasOrani: m.inflationHurdle,
    enflasyonMaliyetiTl: m.inflationOpportunityPnl,
    enflasyonaGoreFarkTl: m.vsInflationPnl,
    enflasyonaGoreFarkYuzde: m.vsInflationReturn,
    vadeliKiyasOrani: m.depositHurdle,
    vadeliIleKazanilacakTl: m.depositOpportunityPnl,
    vadeliyeGoreFarkTl: m.vsDepositPnl,
    vadeliyeGoreFarkYuzde: m.vsDepositReturn,
    bist100Yuzde: m.bist100Return,
    borsayaGoreFark: m.alphaVsBist,
    enBuyukPozisyonPayi: m.largestWeight,
    ilkUcPay: m.top3Weight,
    dogrudanHisseVarMi: comp.hasDirectEquity,
    fonAgirlikliMi: comp.mostlyFunds,
    sinifPaylari: {
      fon: comp.fundW,
      hisse: comp.equityW,
      altin: comp.goldW,
      doviz: comp.fxW,
      nakit: comp.cashW,
    },
    dagilim: m.allocationBySymbol.slice(0, 8).map((s) => ({
      ad: s.label,
      pay: s.weight,
      tutar: s.value,
    })),
  };
}

function mergeTopHoldingSpotlight(
  holding: TopHoldingInfo | null | undefined,
  parsed: Partial<TopHoldingSpotlight> | null | undefined,
  fallback: TopHoldingSpotlight | null
): TopHoldingSpotlight | null {
  if (!holding && !fallback) return null;
  const base = fallback ?? buildTemplateTopHolding(holding);
  if (!base) return null;
  if (!parsed) return base;
  return {
    symbol: holding?.symbol ?? base.symbol,
    name: holding?.name || base.name,
    weight: holding?.weight ?? base.weight,
    value: holding?.value ?? base.value,
    summary: parsed.summary?.trim() || base.summary,
    whatPeopleSay: parsed.whatPeopleSay?.trim() || base.whatPeopleSay,
    expectations: parsed.expectations?.trim() || base.expectations,
    currentSituation: parsed.currentSituation?.trim() || base.currentSituation,
    risksAndWatch: parsed.risksAndWatch?.trim() || base.risksAndWatch,
    sourcesNote: parsed.sourcesNote?.trim() || base.sourcesNote,
  };
}

export async function buildAiNarrative(
  periodLabel: string,
  m: MonthlyAiMetrics,
  options?: {
    worldBriefing?: string | null;
    topHolding?: TopHoldingInfo | null;
    topHoldingBriefing?: string | null;
  }
): Promise<MonthlyAiNarrative> {
  const holding = options?.topHolding ?? null;
  const fallback = buildTemplateNarrative(periodLabel, m, holding);
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
  const holdingBrief = options?.topHoldingBriefing?.trim() || "";

  const system = {
    role: "system",
    content: `Sen sade dille yazan bir portföy asistanısın. Türkçe yaz.
Kurallar:
- Yatırım tavsiyesi gibi emir verme; "düşünebilirsin", "bakılabilir" de.
- Finans jargonu kullanma (alpha, beta, sharpe, hurdle, volatilite, nominal, sortino, HHI yok).
- Bunun yerine: kazanç, düşüş, yükseliş, dalgalanma, enflasyon, vadeli, borsa, pay yaz.
- worldEvents’te genel laf yasak (“siyasi belirsizlik” yetmez). Ülke, olay, senaryo yaz.
- topHoldingSpotlight’ta X/Twitter ve web brifingine dayan; uydurma alıntı yazma.
- BIST yüzdesini yalnızca verilen sayılardan yaz; uydurma / abartma.
- positionRecommendations: SAÇMA / BOŞ “koruyun” deme. Her maddede NEDEN yaz (kâr oranı, düzenli getiri, yoğunlaşma, portföyde ne var/yok).
- Portföyde doğrudan hisse yoksa: riskli hisse alımını beklet / plan varsa ertele diyebilirsin.
- Ana ürün zaten ağırsa: “koruyun çünkü X kârdasınız / düzenli duruyor” de; gerekirse “yeni parayı başka yere” de — sadece “koruyun” yetmez.
- Sadece geçerli JSON döndür.`,
  };

  const holdingBlock = holding
    ? `EN AĞIRLIKLI ÜRÜN: ${holding.symbol} — ${holding.name} | pay ${pct(holding.weight)} | tutar ${money(holding.value)}
${
  holdingBrief
    ? `ÜRÜN SOSYAL/PİYASA BRİFİNGİ (X/Twitter, TEFAS, haber — topHoldingSpotlight bunu kullan):\n${holdingBrief}\n`
    : "Ürün web brifingi yok; topHoldingSpotlight’ta yine de yoğunlaşma riskini ve takip noktalarını yaz.\n"
}`
    : "En ağırlıklı ürün yok.\n";

  const user = {
    role: "user",
    content: `Ay: ${month} (${periodLabel})
Sayılar (oranlar 0.05 = %5): ${JSON.stringify(metricsForPrompt(m))}

${
  briefing
    ? `GÜNCEL DÜNYA BRİFİNGİ (web aramasından — worldEvents’i bundan genişlet, uydurma ekleme):\n${briefing}\n`
    : "Web brifingi yok; worldEvents’te o aya özgü somut jeopolitik/makro senaryolar yaz (ör. Orta Doğu gerilimi → petrol/altın; Fed faizi → risk iştahı). Genel slogan yazma.\n"
}
${holdingBlock}

JSON şema:
{
  "executiveSummary": "3-5 cümle, günlük dilde ay özeti",
  "performanceAnalysis": "ne kadar kazanıldı/kayıp, ay başı-sonu",
  "riskAnalysis": "en kötü düşüş, en iyi yükseliş, dalgalanma, tek pozisyon riski — sade dil",
  "benchmarkComparison": "BIST 100 ile karşılaştırma — SADECE verilen bist100Yuzde sayısını kullan",
  "worldEvents": [{"title":"somut başlık (ülke/olay)","impact":"ne oldu + hangi varlık","implication":"iyi/kötü senaryo"}],
  "topHoldingSpotlight": {
    "summary": "2-3 cümle özet",
    "whatPeopleSay": "X/Twitter ve forumlarda ne deniyor — temalar, iyimser/kötümser — detaylı 1 paragraf",
    "expectations": "yatırımcı beklentileri — detaylı 1 paragraf",
    "currentSituation": "ürünün güncel durumu — detaylı 1 paragraf",
    "risksAndWatch": "riskler ve neye bakılmalı",
    "sourcesNote": "hangi kaynak türleri (X, TEFAS, haber…)"
  },
  "positionRecommendations": [{"action":"INCREASE|DECREASE|HOLD|SHIFT_CLASS|PARK_CASH","assetClass":"FUND|EQUITY|CASH|GOLD|FX","symbol":"PBR veya null","title":"kısa başlık","rationale":"2-4 cümle NEDEN: kâr %, düzenli getiri, portföyde hisse var/yok, yoğunlaşma — boş 'koruyun' yasak","priority":1}],
  "outlook": "gelecek ay: somut riskler ve sakin öneri, 4-6 cümle"
}

worldEvents: 5-7 madde.
topHoldingSpotlight: zorunlu (ürün varsa); brifinge sadık kal, uydurma alıntı yok.

positionRecommendations — 4-5 madde, örnek tarzı (kendi sayılarınla yaz):
1) Ana ürün (örn. PBR): "Şimdilik tutun çünkü toplamda ~%13 kârdasınız; düzenli getiri gibi duruyor. Yeni büyük parayı aynı ürüne yığmayın."
2) Hisse yoksa: "Doğrudan hisse / yüksek riskli ürün alımını bekletin; planınız varsa erteleyin veya çok küçük başlayın."
3) Yoğunlaşma: "Mevcutı bozmak zorunda değilsiniz; yeni birikimi başka yere bölün."
4) Vadeli/enflasyon veya dünya olayına bağlı 1 pratik madde.
Her rationale içinde sayı veya somut gerekçe olsun.

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
      topHoldingSpotlight: mergeTopHoldingSpotlight(
        holding,
        parsed.topHoldingSpotlight,
        fallback.topHoldingSpotlight
      ),
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
