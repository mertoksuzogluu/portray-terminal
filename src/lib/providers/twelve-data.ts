import { format } from "date-fns";
import type {
  HistoricalPrice,
  MarketDataProvider,
  MarketQuote,
} from "./types";

const BASE_URL = "https://api.twelvedata.com";

interface TwelveQuoteResponse {
  symbol?: string;
  name?: string;
  close?: string;
  previous_close?: string;
  open?: string;
  high?: string;
  low?: string;
  volume?: string;
  datetime?: string;
  timestamp?: number;
  currency?: string;
  is_market_open?: boolean;
  code?: number;
  message?: string;
  status?: string;
}

interface TwelveTimeSeriesResponse {
  values?: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
  status?: string;
  code?: number;
  message?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * BIST sembollerini Twelve Data formatına çevirir.
 * THYAO → THYAO.IS
 */
export function toTwelveDataSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase().replace(/\.IS$/i, "");
  // Döviz / emtia özel
  if (normalized === "USDTRY" || normalized === "USD/TRY") return "USD/TRY";
  if (normalized === "EURTRY" || normalized === "EUR/TRY") return "EUR/TRY";
  if (normalized === "XU100" || normalized === "BIST100") return "XU100";
  if (normalized.includes("/")) return normalized;
  return `${normalized}.IS`;
}

export function fromTwelveDataSymbol(providerSymbol: string): string {
  return providerSymbol.replace(/\.IS$/i, "").replace("/", "").toUpperCase();
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = "twelve_data";
  private readonly apiKey: string | undefined;
  private readonly cache = new Map<
    string,
    { quote: MarketQuote; expiresAt: number }
  >();
  private readonly cacheTtlMs: number;

  constructor(apiKey = process.env.TWELVE_DATA_API_KEY, cacheTtlMs = 60_000) {
    this.apiKey = apiKey?.trim() || undefined;
    this.cacheTtlMs = cacheTtlMs;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    return this.getQuoteByProviderSymbol(toTwelveDataSymbol(symbol));
  }

  /**
   * Sağlayıcı sembolü (ör. "AAPL", "THYAO.IS", "USD/TRY") zaten hazırsa
   * dönüşüm yapmadan doğrudan sorgular. ABD hisseleri için .IS eklenmesini önler.
   */
  async getQuoteByProviderSymbol(providerSymbol: string): Promise<MarketQuote> {
    const cached = this.cache.get(providerSymbol);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.quote;
    }

    if (!this.apiKey) {
      throw new Error(
        "Twelve Data API anahtarı yapılandırılmamış. Ayarlar ekranından ekleyin veya demo veri kullanın."
      );
    }

    const quote = await this.fetchWithRetry(async () => {
      const url = new URL(`${BASE_URL}/quote`);
      url.searchParams.set("symbol", providerSymbol);
      url.searchParams.set("apikey", this.apiKey!);

      const res = await fetch(url.toString(), {
        next: { revalidate: 0 },
      });
      if (res.status === 429) {
        throw Object.assign(new Error("Rate limit"), { status: 429 });
      }
      if (!res.ok) {
        throw new Error(`Twelve Data HTTP ${res.status}`);
      }
      const data = (await res.json()) as TwelveQuoteResponse;
      if (data.status === "error" || data.code === 429) {
        const err = new Error(data.message ?? "Twelve Data hatası");
        Object.assign(err, { status: data.code });
        throw err;
      }
      if (!data.close) {
        throw new Error(data.message ?? `Fiyat alınamadı: ${providerSymbol}`);
      }

      const asOf = data.timestamp
        ? new Date(data.timestamp * 1000)
        : data.datetime
          ? new Date(data.datetime)
          : new Date();

      return {
        symbol: fromTwelveDataSymbol(providerSymbol),
        providerSymbol,
        price: data.close,
        previousClose: data.previous_close ?? null,
        open: data.open ?? null,
        high: data.high ?? null,
        low: data.low ?? null,
        volume: data.volume ?? null,
        currency: data.currency ?? "TRY",
        asOf,
        fetchedAt: new Date(),
        isDelayed: true,
        dataQuality: "DELAYED" as const,
        source: this.name,
      };
    });

    this.cache.set(providerSymbol, {
      quote,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return quote;
  }

  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    // Ücretsiz planda batch sınırlı; sırayla ve cache ile
    const results: MarketQuote[] = [];
    for (const symbol of symbols) {
      try {
        results.push(await this.getQuote(symbol));
        await sleep(200);
      } catch {
        // Tek sembol hatası tüm batch'i bozmasın
      }
    }
    return results;
  }

  async getHistoricalPrices(
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalPrice[]> {
    if (!this.apiKey) {
      throw new Error("Twelve Data API anahtarı yapılandırılmamış.");
    }

    const providerSymbol = toTwelveDataSymbol(symbol);
    return this.fetchWithRetry(async () => {
      const url = new URL(`${BASE_URL}/time_series`);
      url.searchParams.set("symbol", providerSymbol);
      url.searchParams.set("interval", "1day");
      url.searchParams.set("start_date", format(startDate, "yyyy-MM-dd"));
      url.searchParams.set("end_date", format(endDate, "yyyy-MM-dd"));
      url.searchParams.set("apikey", this.apiKey!);
      url.searchParams.set("timezone", "Europe/Istanbul");

      const res = await fetch(url.toString());
      if (res.status === 429) {
        throw Object.assign(new Error("Rate limit"), { status: 429 });
      }
      if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

      const data = (await res.json()) as TwelveTimeSeriesResponse;
      if (data.status === "error") {
        throw new Error(data.message ?? "Zaman serisi hatası");
      }

      return (data.values ?? [])
        .map((row) => ({
          symbol: fromTwelveDataSymbol(providerSymbol),
          date: new Date(row.datetime),
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume ?? null,
          source: this.name,
        }))
        .reverse();
    });
  }

  private async fetchWithRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 4
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const status =
          typeof error === "object" && error && "status" in error
            ? Number((error as { status: number }).status)
            : undefined;
        if (status === 429 || attempt < maxAttempts - 1) {
          const backoff = Math.min(1000 * 2 ** attempt, 15_000);
          await sleep(backoff);
          continue;
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Twelve Data isteği başarısız");
  }
}
