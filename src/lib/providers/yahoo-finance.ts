import type {
  HistoricalPrice,
  MarketDataProvider,
  MarketQuote,
} from "./types";

/**
 * Yahoo Finance chart API — BIST (.IS) ve ABD hisseleri için ücretsiz kaynak.
 * Twelve Data ücretsiz planı Türkiye borsasını kapsamadığı için BIST fallback olarak kullanılır.
 */
const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

interface YahooChartMeta {
  currency?: string;
  symbol?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketTime?: number;
}

interface YahooChartResult {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[] | null;
    error?: { code?: string; description?: string } | null;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** THYAO → THYAO.IS; AAPL → AAPL; zaten .IS ise olduğu gibi. */
export function toYahooSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase().replace(/\.IS$/i, "");
  if (!normalized) return symbol.trim().toUpperCase();
  // FX / emtia Yahoo formatına burada çevirmiyoruz
  if (normalized.includes("/")) return normalized;
  // BIST sembolleri genellikle 4–6 harf + opsiyonel sayı (örn. THYAO, GARAN, ISCTR)
  // Caller BIST için .IS eklemeli; bu fonksiyon genel kullanım için
  return normalized;
}

export function toYahooBistSymbol(symbol: string): string {
  return `${symbol.trim().toUpperCase().replace(/\.IS$/i, "")}.IS`;
}

export function fromYahooSymbol(providerSymbol: string): string {
  return providerSymbol.replace(/\.IS$/i, "").toUpperCase();
}

function numToStr(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return String(n);
}

async function fetchChart(
  providerSymbol: string,
  params: Record<string, string>
): Promise<YahooChartResult> {
  const url = new URL(`${CHART_BASE}/${encodeURIComponent(providerSymbol)}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PortrayTerminal/1.0; +https://portray-terminal.vercel.app)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status}`);
  }

  const data = (await res.json()) as YahooChartResponse;
  if (data.chart?.error) {
    throw new Error(
      data.chart.error.description ??
        `Yahoo Finance: ${data.chart.error.code ?? "hata"}`
    );
  }
  const result = data.chart?.result?.[0];
  if (!result?.meta) {
    throw new Error(`Sembol bulunamadı: ${providerSymbol}`);
  }
  return result;
}

export class YahooFinanceProvider implements MarketDataProvider {
  readonly name = "yahoo_finance";
  private readonly cache = new Map<
    string,
    { quote: MarketQuote; expiresAt: number }
  >();
  private readonly cacheTtlMs: number;

  constructor(cacheTtlMs = 60_000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  isConfigured(): boolean {
    return true;
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const raw = symbol.trim().toUpperCase();
    const bare = raw.replace(/\.IS$/i, "");
    if (raw.endsWith(".IS")) {
      return this.getQuoteByProviderSymbol(`${bare}.IS`);
    }
    try {
      return await this.getQuoteByProviderSymbol(bare);
    } catch {
      // ABD sembolü değilse BIST (.IS) dene
      return this.getQuoteByProviderSymbol(`${bare}.IS`);
    }
  }

  async getQuoteByProviderSymbol(providerSymbol: string): Promise<MarketQuote> {
    const cached = this.cache.get(providerSymbol);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.quote;
    }

    const result = await fetchChart(providerSymbol, {
      interval: "1d",
      range: "5d",
    });
    const meta = result.meta!;
    const price = meta.regularMarketPrice;
    if (price == null || !Number.isFinite(price)) {
      throw new Error(`Fiyat alınamadı: ${providerSymbol}`);
    }

    const quoteRow = result.indicators?.quote?.[0];
    const closes = quoteRow?.close?.filter((c): c is number => c != null) ?? [];
    const opens = quoteRow?.open ?? [];
    const highs = quoteRow?.high ?? [];
    const lows = quoteRow?.low ?? [];
    const volumes = quoteRow?.volume ?? [];
    const lastIdx = closes.length > 0 ? closes.length - 1 : -1;

    const previousClose =
      meta.chartPreviousClose ??
      meta.previousClose ??
      (closes.length >= 2 ? closes[closes.length - 2] : null);

    const asOf = meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000)
      : new Date();

    const quote: MarketQuote = {
      symbol: fromYahooSymbol(providerSymbol),
      providerSymbol,
      price: String(price),
      previousClose: numToStr(previousClose),
      open: lastIdx >= 0 ? numToStr(opens[lastIdx]) : null,
      high: lastIdx >= 0 ? numToStr(highs[lastIdx]) : null,
      low: lastIdx >= 0 ? numToStr(lows[lastIdx]) : null,
      volume: lastIdx >= 0 ? numToStr(volumes[lastIdx]) : null,
      currency: meta.currency ?? "TRY",
      asOf,
      fetchedAt: new Date(),
      isDelayed: true,
      dataQuality: "DELAYED",
      source: this.name,
    };

    this.cache.set(providerSymbol, {
      quote,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return quote;
  }

  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const results: MarketQuote[] = [];
    for (const symbol of symbols) {
      try {
        results.push(await this.getQuote(symbol));
        await sleep(150);
      } catch {
        // tek sembol hatası batch'i bozmasın
      }
    }
    return results;
  }

  async getHistoricalPrices(
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalPrice[]> {
    const raw = symbol.trim().toUpperCase();
    const bare = raw.replace(/\.IS$/i, "");
    if (raw.endsWith(".IS")) {
      return this.getHistoricalPricesByProviderSymbol(
        `${bare}.IS`,
        startDate,
        endDate
      );
    }
    try {
      return await this.getHistoricalPricesByProviderSymbol(
        bare,
        startDate,
        endDate
      );
    } catch {
      return this.getHistoricalPricesByProviderSymbol(
        `${bare}.IS`,
        startDate,
        endDate
      );
    }
  }

  async getHistoricalPricesByProviderSymbol(
    providerSymbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalPrice[]> {
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000) + 86_400;

    const result = await fetchChart(providerSymbol, {
      interval: "1d",
      period1: String(period1),
      period2: String(period2),
    });

    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || timestamps.length === 0) {
      return [];
    }

    const rows: HistoricalPrice[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = quote.close?.[i];
      if (close == null || !Number.isFinite(close)) continue;
      rows.push({
        symbol: fromYahooSymbol(providerSymbol),
        date: new Date(timestamps[i]! * 1000),
        open: numToStr(quote.open?.[i] ?? null),
        high: numToStr(quote.high?.[i] ?? null),
        low: numToStr(quote.low?.[i] ?? null),
        close: String(close),
        volume: numToStr(quote.volume?.[i] ?? null),
        source: this.name,
      });
    }
    return rows;
  }

  /** Lookup ekranı için isim bilgisini de döner. */
  async lookupQuote(providerSymbol: string): Promise<{
    quote: MarketQuote;
    name: string;
    exchange: string;
  }> {
    // getQuoteByProviderSymbol chart çeker; isim için ayrı meta lazım → tek fetch
    const result = await fetchChart(providerSymbol, {
      interval: "1d",
      range: "5d",
    });
    const meta = result.meta!;
    const price = meta.regularMarketPrice;
    if (price == null || !Number.isFinite(price)) {
      throw new Error(`Fiyat alınamadı: ${providerSymbol}`);
    }

    const quoteRow = result.indicators?.quote?.[0];
    const closes = quoteRow?.close?.filter((c): c is number => c != null) ?? [];
    const opens = quoteRow?.open ?? [];
    const highs = quoteRow?.high ?? [];
    const lows = quoteRow?.low ?? [];
    const volumes = quoteRow?.volume ?? [];
    const lastIdx = closes.length > 0 ? closes.length - 1 : -1;
    const previousClose =
      meta.chartPreviousClose ??
      meta.previousClose ??
      (closes.length >= 2 ? closes[closes.length - 2] : null);
    const asOf = meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000)
      : new Date();

    const quote: MarketQuote = {
      symbol: fromYahooSymbol(providerSymbol),
      providerSymbol,
      price: String(price),
      previousClose: numToStr(previousClose),
      open: lastIdx >= 0 ? numToStr(opens[lastIdx]) : null,
      high: lastIdx >= 0 ? numToStr(highs[lastIdx]) : null,
      low: lastIdx >= 0 ? numToStr(lows[lastIdx]) : null,
      volume: lastIdx >= 0 ? numToStr(volumes[lastIdx]) : null,
      currency: meta.currency ?? "TRY",
      asOf,
      fetchedAt: new Date(),
      isDelayed: true,
      dataQuality: "DELAYED",
      source: this.name,
    };

    this.cache.set(providerSymbol, {
      quote,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return {
      quote,
      name: meta.longName || meta.shortName || fromYahooSymbol(providerSymbol),
      exchange: meta.fullExchangeName || meta.exchangeName || "BIST",
    };
  }
}
