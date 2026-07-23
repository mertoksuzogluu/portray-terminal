import type {
  HistoricalPrice,
  MarketDataProvider,
  MarketQuote,
} from "./types";
import { TwelveDataProvider } from "./twelve-data";
import { YahooFinanceProvider } from "./yahoo-finance";

function isEquityLikeSymbol(providerSymbol: string): boolean {
  const s = providerSymbol.trim().toUpperCase();
  // FX / emtia pariteleri Twelve Data'da kalır
  if (s.includes("/")) return false;
  if (s === "XAUUSD" || s === "XAUTRY") return false;
  return true;
}

function isPlanOrCoverageError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    msg.includes("not available") ||
    msg.includes("plan") ||
    msg.includes("subscribe") ||
    msg.includes("permission") ||
    msg.includes("upgrade") ||
    msg.includes("api credits") ||
    msg.includes("run out") ||
    msg.includes("limit") ||
    msg.includes("sembol bulunamadı") ||
    msg.includes("fiyat alınamadı") ||
    msg.includes("twelve data api anahtarı") ||
    msg.includes("http 401") ||
    msg.includes("http 403") ||
    msg.includes("http 429")
  );
}

/**
 * Twelve Data öncelikli; BIST/ABD hisselerinde plan veya kota hatasında Yahoo'ya düşer.
 * Ücretsiz Twelve Data planı Türkiye borsasını kapsamaz.
 */
export class CompositeStockProvider implements MarketDataProvider {
  readonly name = "composite_stock";
  private readonly primary: TwelveDataProvider;
  private readonly fallback: YahooFinanceProvider;

  constructor(
    primary = new TwelveDataProvider(),
    fallback = new YahooFinanceProvider()
  ) {
    this.primary = primary;
    this.fallback = fallback;
  }

  isConfigured(): boolean {
    return this.primary.isConfigured() || this.fallback.isConfigured();
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    if (this.primary.isConfigured()) {
      try {
        return await this.primary.getQuote(symbol);
      } catch (error) {
        if (isPlanOrCoverageError(error)) {
          return this.fallback.getQuote(symbol);
        }
        throw error;
      }
    }
    return this.fallback.getQuote(symbol);
  }

  async getQuoteByProviderSymbol(providerSymbol: string): Promise<MarketQuote> {
    if (this.primary.isConfigured()) {
      try {
        return await this.primary.getQuoteByProviderSymbol(providerSymbol);
      } catch (error) {
        if (isEquityLikeSymbol(providerSymbol) && isPlanOrCoverageError(error)) {
          return this.fallback.getQuoteByProviderSymbol(providerSymbol);
        }
        throw error;
      }
    }
    if (!isEquityLikeSymbol(providerSymbol)) {
      throw new Error(
        "Twelve Data API anahtarı yapılandırılmamış. FX/emtia için TWELVE_DATA_API_KEY gerekli."
      );
    }
    return this.fallback.getQuoteByProviderSymbol(providerSymbol);
  }

  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const results: MarketQuote[] = [];
    for (const symbol of symbols) {
      try {
        results.push(await this.getQuote(symbol));
      } catch {
        // tek sembol
      }
    }
    return results;
  }

  async getHistoricalPrices(
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalPrice[]> {
    if (this.primary.isConfigured()) {
      try {
        return await this.primary.getHistoricalPrices(symbol, startDate, endDate);
      } catch (error) {
        if (isEquityLikeSymbol(`${symbol}.IS`) && isPlanOrCoverageError(error)) {
          return this.fallback.getHistoricalPrices(symbol, startDate, endDate);
        }
        throw error;
      }
    }
    return this.fallback.getHistoricalPrices(symbol, startDate, endDate);
  }

  async getHistoricalPricesByProviderSymbol(
    providerSymbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalPrice[]> {
    if (this.primary.isConfigured()) {
      try {
        return await this.primary.getHistoricalPricesByProviderSymbol(
          providerSymbol,
          startDate,
          endDate
        );
      } catch (error) {
        if (isEquityLikeSymbol(providerSymbol) && isPlanOrCoverageError(error)) {
          return this.fallback.getHistoricalPricesByProviderSymbol(
            providerSymbol,
            startDate,
            endDate
          );
        }
        throw error;
      }
    }
    return this.fallback.getHistoricalPricesByProviderSymbol(
      providerSymbol,
      startDate,
      endDate
    );
  }
}
