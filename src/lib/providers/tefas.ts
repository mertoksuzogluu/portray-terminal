import type {
  FundDataProvider,
  FundHistoricalPrice,
  FundQuote,
} from "./types";

/**
 * TEFAS Nisan 2026'da eski `/api/DB/BindHistoryInfo` (ASP.NET) uçlarını kapattı;
 * artık Next.js tabanlı `/api/funds/*` JSON API kullanılıyor. Fiyatlar fon başına,
 * ay bazlı `periyod` (1,3,6,12,36,60) ile dönüyor.
 */
const TEFAS_BASE = "https://www.tefas.gov.tr";
const PRICE_ENDPOINT = "/api/funds/fonFiyatBilgiGetir";

const TEFAS_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Content-Type": "application/json",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "tr-TR,tr;q=0.9",
  Referer: "https://www.tefas.gov.tr/FonAnaliz.aspx",
  Origin: TEFAS_BASE,
};

const VALID_PERIODS = [1, 3, 6, 12, 36, 60] as const;

interface TefasRow {
  tarih?: string;
  fonKodu?: string;
  fonUnvan?: string;
  fiyat?: number;
}

interface TefasResponse {
  resultList?: TefasRow[];
  data?: TefasRow[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTefasDate(value: string | undefined): Date {
  if (!value) return new Date();
  const match = /\/Date\((\d+)\)\//.exec(value);
  if (match) return new Date(Number(match[1]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** İstenen geçmişi API'nin kabul ettiği ay değerine yuvarlar. */
function monthsBack(start: Date): number {
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86_400_000));
  const needed = Math.ceil(days / 30) + 1;
  for (const p of VALID_PERIODS) {
    if (p >= needed) return p;
  }
  return 60;
}

export class TefasFundProvider implements FundDataProvider {
  readonly name = "tefas";
  private readonly cache = new Map<
    string,
    { quote: FundQuote; expiresAt: number }
  >();

  isConfigured(): boolean {
    // TEFAS public endpoint — API key gerektirmez
    return true;
  }

  async getFundQuote(code: string): Promise<FundQuote> {
    const normalized = code.trim().toUpperCase();
    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.quote;
    }

    const rows = await this.fetchRaw(normalized, 1);
    const sorted = rows
      .filter((r) => r.fiyat != null && r.tarih)
      .sort(
        (a, b) => parseTefasDate(a.tarih).getTime() - parseTefasDate(b.tarih).getTime()
      );

    if (sorted.length === 0) {
      throw new Error(`TEFAS: ${normalized} için fiyat bulunamadı.`);
    }

    const latest = sorted[sorted.length - 1];
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;

    let dailyChange: string | null = null;
    if (previous?.fiyat != null && latest.fiyat != null && previous.fiyat > 0) {
      dailyChange = ((latest.fiyat - previous.fiyat) / previous.fiyat).toString();
    }

    const quote: FundQuote = {
      code: normalized,
      name: latest.fonUnvan || normalized,
      price: String(latest.fiyat),
      previousPrice: previous?.fiyat != null ? String(previous.fiyat) : null,
      priceDate: parseTefasDate(latest.tarih),
      dailyChange,
      fetchedAt: new Date(),
      source: this.name,
      dataQuality: "END_OF_DAY",
      status: "OK",
    };

    this.cache.set(normalized, {
      quote,
      expiresAt: Date.now() + 30 * 60_000,
    });
    return quote;
  }

  async getFundQuotes(codes: string[]): Promise<FundQuote[]> {
    const results: FundQuote[] = [];
    for (const code of codes) {
      try {
        results.push(await this.getFundQuote(code));
        await sleep(300);
      } catch {
        // Diğer fonları etkilemesin
      }
    }
    return results;
  }

  async getHistoricalPrices(
    code: string,
    startDate: Date,
    endDate: Date
  ): Promise<FundHistoricalPrice[]> {
    const normalized = code.trim().toUpperCase();
    const rows = await this.fetchRaw(normalized, monthsBack(startDate));
    return rows
      .filter((r) => r.fiyat != null && r.tarih)
      .map((r) => ({
        code: normalized,
        date: parseTefasDate(r.tarih),
        price: String(r.fiyat),
        source: this.name,
      }))
      .filter((r) => r.date >= startDate && r.date <= endDate)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private async fetchRaw(code: string, periyod: number): Promise<TefasRow[]> {
    const payload = JSON.stringify({ fonKodu: code, dil: "TR", periyod });

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${TEFAS_BASE}${PRICE_ENDPOINT}`, {
          method: "POST",
          headers: TEFAS_HEADERS,
          body: payload,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          throw new Error(`TEFAS HTTP ${res.status}`);
        }

        const text = await res.text();
        if (!text.trim()) {
          // Akamai bot koruması boş gövde döndürmüş olabilir
          throw new Error("TEFAS boş yanıt döndürdü (bot koruması olabilir).");
        }

        const json = JSON.parse(text) as TefasResponse | TefasRow[];
        if (Array.isArray(json)) return json;
        return json.resultList ?? json.data ?? [];
      } catch (error) {
        lastError = error;
        await sleep(500 * 2 ** attempt);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("TEFAS isteği başarısız");
  }
}

/**
 * Demo / offline mod — seed verisiyle çalışır.
 */
export class DemoFundProvider implements FundDataProvider {
  readonly name = "demo_tefas";
  private readonly quotes: Map<string, FundQuote>;

  constructor(quotes: FundQuote[] = []) {
    this.quotes = new Map(quotes.map((q) => [q.code.toUpperCase(), q]));
  }

  isConfigured(): boolean {
    return true;
  }

  async getFundQuote(code: string): Promise<FundQuote> {
    const found = this.quotes.get(code.toUpperCase());
    if (!found) {
      throw new Error(`Demo fon fiyatı yok: ${code}`);
    }
    return found;
  }

  async getHistoricalPrices(
    code: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<FundHistoricalPrice[]> {
    const q = await this.getFundQuote(code);
    return [
      {
        code: q.code,
        date: q.priceDate,
        price: q.price,
        source: this.name,
      },
    ];
  }
}
