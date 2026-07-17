/** Likit BIST + makro çapa havuzu — haftalık rotasyon için. */

export type WatchUniverseItem = {
  symbol: string;
  name: string;
  assetType: "STOCK" | "GOLD" | "FX";
  providerSymbol: string;
  /** Her hafta sabit gösterilen çapa (altın/döviz). */
  anchor?: boolean;
};

export const MARKET_WATCH_UNIVERSE: WatchUniverseItem[] = [
  {
    symbol: "GRAMALTIN",
    name: "Gram Altın (TRY)",
    assetType: "GOLD",
    providerSymbol: "XAU/TRY",
    anchor: true,
  },
  {
    symbol: "USDTRY",
    name: "ABD Doları / Türk Lirası",
    assetType: "FX",
    providerSymbol: "USD/TRY",
    anchor: true,
  },
  {
    symbol: "THYAO",
    name: "Türk Hava Yolları A.Ş.",
    assetType: "STOCK",
    providerSymbol: "THYAO.IS",
  },
  {
    symbol: "TUPRS",
    name: "Tüpraş",
    assetType: "STOCK",
    providerSymbol: "TUPRS.IS",
  },
  {
    symbol: "GARAN",
    name: "Garanti BBVA",
    assetType: "STOCK",
    providerSymbol: "GARAN.IS",
  },
  {
    symbol: "AKBNK",
    name: "Akbank",
    assetType: "STOCK",
    providerSymbol: "AKBNK.IS",
  },
  {
    symbol: "YKBNK",
    name: "Yapı Kredi",
    assetType: "STOCK",
    providerSymbol: "YKBNK.IS",
  },
  {
    symbol: "ISCTR",
    name: "İş Bankası (C)",
    assetType: "STOCK",
    providerSymbol: "ISCTR.IS",
  },
  {
    symbol: "EREGL",
    name: "Ereğli Demir Çelik",
    assetType: "STOCK",
    providerSymbol: "EREGL.IS",
  },
  {
    symbol: "KCHOL",
    name: "Koç Holding",
    assetType: "STOCK",
    providerSymbol: "KCHOL.IS",
  },
  {
    symbol: "SAHOL",
    name: "Sabancı Holding",
    assetType: "STOCK",
    providerSymbol: "SAHOL.IS",
  },
  {
    symbol: "ASELS",
    name: "Aselsan",
    assetType: "STOCK",
    providerSymbol: "ASELS.IS",
  },
  {
    symbol: "BIMAS",
    name: "BİM",
    assetType: "STOCK",
    providerSymbol: "BIMAS.IS",
  },
  {
    symbol: "SISE",
    name: "Şişecam",
    assetType: "STOCK",
    providerSymbol: "SISE.IS",
  },
  {
    symbol: "TOASO",
    name: "Tofaş",
    assetType: "STOCK",
    providerSymbol: "TOASO.IS",
  },
  {
    symbol: "FROTO",
    name: "Ford Otosan",
    assetType: "STOCK",
    providerSymbol: "FROTO.IS",
  },
  {
    symbol: "TCELL",
    name: "Turkcell",
    assetType: "STOCK",
    providerSymbol: "TCELL.IS",
  },
  {
    symbol: "TTKOM",
    name: "Türk Telekom",
    assetType: "STOCK",
    providerSymbol: "TTKOM.IS",
  },
  {
    symbol: "PETKM",
    name: "Petkim",
    assetType: "STOCK",
    providerSymbol: "PETKM.IS",
  },
  {
    symbol: "SASA",
    name: "SASA Polyester",
    assetType: "STOCK",
    providerSymbol: "SASA.IS",
  },
  {
    symbol: "ASTOR",
    name: "Astor Enerji",
    assetType: "STOCK",
    providerSymbol: "ASTOR.IS",
  },
  {
    symbol: "ENKAI",
    name: "Enka İnşaat",
    assetType: "STOCK",
    providerSymbol: "ENKAI.IS",
  },
  {
    symbol: "HEKTS",
    name: "Hektaş",
    assetType: "STOCK",
    providerSymbol: "HEKTS.IS",
  },
  {
    symbol: "KOZAL",
    name: "Koza Altın",
    assetType: "STOCK",
    providerSymbol: "KOZAL.IS",
  },
  {
    symbol: "PGSUS",
    name: "Pegasus",
    assetType: "STOCK",
    providerSymbol: "PGSUS.IS",
  },
];

/** ISO hafta anahtarı: 2026-W29 */
export function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministik haftalık seçim — aynı hafta aynı hisseler. */
export function pickWeeklyWatchSymbols(options?: {
  asOf?: Date;
  stockCount?: number;
}): {
  weekKey: string;
  anchors: WatchUniverseItem[];
  rotating: WatchUniverseItem[];
  all: WatchUniverseItem[];
} {
  const asOf = options?.asOf ?? new Date();
  const stockCount = options?.stockCount ?? 6;
  const weekKey = isoWeekKey(asOf);
  const anchors = MARKET_WATCH_UNIVERSE.filter((x) => x.anchor);
  const pool = MARKET_WATCH_UNIVERSE.filter((x) => !x.anchor);
  const seed = hashString(weekKey);
  const shuffled = [...pool];
  // Fisher–Yates with LCG
  let state = seed || 1;
  for (let i = shuffled.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const rotating = shuffled.slice(0, Math.min(stockCount, shuffled.length));
  return { weekKey, anchors, rotating, all: [...anchors, ...rotating] };
}
