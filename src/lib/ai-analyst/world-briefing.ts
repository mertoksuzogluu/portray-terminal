import { openaiWebSearch } from "./openai-web";

/**
 * OpenAI Responses API + web_search ile güncel piyasa / jeopolitik brifing.
 * Aylık rapor başına ~1 arama (~$0.01 + token).
 */
export async function fetchWorldMarketBriefing(params: {
  periodLabel: string;
  monthName: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{ briefing: string | null; error: string | null }> {
  const prompt = `Web’de araştır. Dönem: ${params.monthName} (${params.periodStart} – ${params.periodEnd}).

Türkiye’de bireysel yatırımcının portföyünü (fon, hisse, döviz, altın) etkileyebilecek
GÜNCEL ve SOMUT olayları yaz. Genel laflar yasak (“siyasi belirsizlik”, “jeopolitik risk” tek başına yetmez).

Her madde için şunu ver:
1) Ne oldu / ne bekleniyor? (ülke, aktör, tarih veya hafta)
2) Hangi varlık etkilenir? (BIST, USD/TRY, altın, petrol, faiz)
3) İyi senaryo / kötü senaryo (ör. savaş alevlenirse petrol yükselir, risk iştahı düşer)

Kapsam örnekleri (varsa gerçekleri yaz, uydurma):
- ABD–İran / Orta Doğu gerilimi, Hürmüz, petrol
- Fed / ECB faiz, ABD istihdam
- TCMB faiz, enflasyon, Türkiye siyaseti
- Çin / Avrupa büyüme, riskli varlıklar
- Büyük şirket veya emtia şokları

Türkçe, sade dil, 5–7 madde. Madde madde numaralandır.`;

  const result = await openaiWebSearch(prompt);
  if (!result.text) {
    return {
      briefing: null,
      error: result.error ?? "Dünya brifingi alınamadı.",
    };
  }
  return { briefing: result.text, error: null };
}
