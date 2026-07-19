/** Haftalık izleme için kısa bağlam — fikir metnine eklenir. */

export const WATCH_STOCK_CONTEXT: Record<
  string,
  { sector: string; note: string }
> = {
  THYAO: {
    sector: "Havacılık",
    note: "Turizm ve yakıt maliyetine duyarlı; kur ve talep döngüsü önemli.",
  },
  TUPRS: {
    sector: "Rafineri",
    note: "Marj ve ham petrol fiyatı hareketleri karı hızlı etkiler.",
  },
  GARAN: {
    sector: "Banka",
    note: "Faiz ve kredi büyümesi ile birlikte izlenir; sektör betas yüksek.",
  },
  AKBNK: {
    sector: "Banka",
    note: "Net faiz marjı ve aktif kalitesi bankacılık fikrinin omurgası.",
  },
  YKBNK: {
    sector: "Banka",
    note: "Sektör ralli/düzeltmelerinde genelde yüksek beta gösterir.",
  },
  ISCTR: {
    sector: "Banka",
    note: "Likit banka; endeks ve faiz beklentisiyle birlikte hareket eder.",
  },
  EREGL: {
    sector: "Demir-çelik",
    note: "Küresel çelik fiyatı ve Çin talebi önemli belirleyici.",
  },
  KCHOL: {
    sector: "Holding",
    note: "Çeşitli iştirakler; BIST genel risk iştahının barometresi.",
  },
  SAHOL: {
    sector: "Holding",
    note: "Finans ağırlıklı holding; faiz ve banka çarpanlarına duyarlı.",
  },
  ASELS: {
    sector: "Savunma",
    note: "Sipariş/backlog ve jeopolitik haber akışı fiyatı oynatır.",
  },
  BIMAS: {
    sector: "Perakende",
    note: "Gıda enflasyonu ve mağaza büyümesi ciroyu destekler.",
  },
  SISE: {
    sector: "Cam / sanayi",
    note: "İhracat ve enerji maliyeti marjları etkiler.",
  },
  TOASO: {
    sector: "Otomotiv",
    note: "Yurt içi talep ve ihracat karışımı; kur etkisi çift yönlü.",
  },
  FROTO: {
    sector: "Otomotiv",
    note: "Üretim/ihracat rakamları ve global OEM döngüsü kritik.",
  },
  TCELL: {
    sector: "Telekom",
    note: "ARPU ve abone büyümesi; regülasyon riski izlenmeli.",
  },
  TTKOM: {
    sector: "Telekom",
    note: "Sabit/mobil paketler ve yatırım harcamaları marjı belirler.",
  },
  PETKM: {
    sector: "Petrokimya",
    note: "Nafta ve ürün spread’leri karlılığı oynak tutar.",
  },
  SASA: {
    sector: "Kimya / polyester",
    note: "Yüksek volatil; kapasite ve emtia maliyetine dikkat.",
  },
  ASTOR: {
    sector: "Enerji ekipmanı",
    note: "Trafo talebi ve ihracat siparişleri hikâyeyi taşır.",
  },
  ENKAI: {
    sector: "İnşaat",
    note: "Yurt dışı proje nakit akışı ve döviz gelirleri önemli.",
  },
  HEKTS: {
    sector: "Tarım kimyası",
    note: "Mevsimsel talep ve regülasyon haberleri oynaklık yaratır.",
  },
  KOZAL: {
    sector: "Altın madenciliği",
    note: "Ons altın ve üretim maliyetleri hisseyi sürükler.",
  },
  PGSUS: {
    sector: "Havacılık (LCC)",
    note: "Birim gelir ve yakıt; yaz sezonu kapasite doluluğu kritik.",
  },
  GRAMALTIN: {
    sector: "Kıymetli maden",
    note: "Ons altın × kur; enflasyon ve risk iştahı için çapa.",
  },
  USDTRY: {
    sector: "Döviz",
    note: "TCMB/faiz ve risk primi; portföy döviz pozisyonu için referans.",
  },
};

export function watchContextLine(symbol: string): string | null {
  const ctx = WATCH_STOCK_CONTEXT[symbol];
  if (!ctx) return null;
  return `${ctx.sector}: ${ctx.note}`;
}
