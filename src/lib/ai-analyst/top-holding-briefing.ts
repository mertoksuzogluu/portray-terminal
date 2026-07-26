import { openaiWebSearch } from "./openai-web";

export interface TopHoldingInfo {
  symbol: string;
  name: string;
  weight: number;
  value: number;
  assetType?: string | null;
}

/**
 * En ağırlıklı ürün için X/Twitter, TEFAS, haber ve forum taraması.
 */
export async function fetchTopHoldingBriefing(params: {
  holding: TopHoldingInfo;
  monthName: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{ briefing: string | null; error: string | null }> {
  const { holding, monthName, periodStart, periodEnd } = params;
  const isFund =
    holding.assetType === "MUTUAL_FUND" ||
    holding.name.toLowerCase().includes("fon");

  const prompt = `Web’de ve sosyal medyada (özellikle X/Twitter, ayrıca Reddit, yatırım forumları, TEFAS, haber siteleri) araştır.

Ürün: ${holding.symbol}${holding.name && holding.name !== holding.symbol ? ` — ${holding.name}` : ""}
Tür: ${holding.assetType ?? (isFund ? "yatırım fonu" : "bilinmiyor")}
Dönem: ${monthName} (${periodStart} – ${periodEnd})
Portföydeki payı: yaklaşık %${(holding.weight * 100).toFixed(1)}

İstediğim çıktı (Türkçe, sade dil, uydurma yorum yazma; bulduklarını özetle):

1) DURUM: Bu ürün son dönemde nasıl gidiyor? Getiri, gündem, bilinen özellik (para piyasası fonu / hisse / vs.)
2) İNSANLAR NE DİYOR: X/Twitter ve forumlarda öne çıkan yorumlar — iyimser / temkinli / şikayet. Mümkünse temaları yaz (faiz, stopaj, alternatif fon, çıkış vb.)
3) BEKLENTİLER: Yatırımcılar önümüzdeki haftalar/ay için ne bekliyor?
4) RİSK VE TAKİP: Dikkat edilmesi gerekenler (faiz kararı, likidite, yoğunlaşma, rakip ürünler)
5) KAYNAKLAR: Hangi tür kaynaklara dayandın (X, TEFAS, haber adı vb.) — link zorunlu değil

Bulgu azsa dürüstçe söyle; genel “piyasa belirsiz” laflarına kaçma.
En az 4 kısa başlıklı paragraf yaz.`;

  const result = await openaiWebSearch(prompt);
  if (!result.text) {
    return {
      briefing: null,
      error: result.error ?? "Ürün brifingi alınamadı.",
    };
  }
  return { briefing: result.text, error: null };
}
