import type { AssetType } from "@prisma/client";
import { getFundProvider } from "@/lib/providers";
import {
  YahooFinanceProvider,
  toYahooBistSymbol,
} from "@/lib/providers/yahoo-finance";

/**
 * Kullanıcının ekleme ekranında seçtiği kategoriler.
 * Aynı AssetType (ör. STOCK) altında BIST/ABD ayrımı borsa + para birimi ile yapılır.
 */
export type AssetCategory = "FUND" | "BIST" | "US" | "FX" | "GOLD" | "CRYPTO";

export const ASSET_CATEGORIES: {
  id: AssetCategory;
  label: string;
  hint: string;
  example: string;
}[] = [
  { id: "FUND", label: "Fon (TEFAS)", hint: "TEFAS fon kodu", example: "PBR" },
  { id: "BIST", label: "BIST Hissesi", hint: "Borsa İstanbul sembolü", example: "THYAO" },
  { id: "US", label: "ABD Hissesi", hint: "ABD borsası sembolü", example: "AAPL" },
  { id: "FX", label: "Döviz", hint: "Parite kodu", example: "USDTRY" },
  { id: "GOLD", label: "Altın", hint: "Gram altın", example: "GRAMALTIN" },
  { id: "CRYPTO", label: "Kripto", hint: "Kripto sembolü", example: "BTC" },
];

export interface AssetLookupResult {
  symbol: string;
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  exchange: string | null;
  currency: string;
  provider: string;
  providerSymbol: string | null;
  tefasCode: string | null;
  isin: string | null;
  price: string | null;
  priceDate: string | null;
  previousClose: string | null;
  dataQuality: string;
}

interface TwelveQuoteRaw {
  symbol?: string;
  name?: string;
  exchange?: string;
  mic_code?: string;
  currency?: string;
  close?: string;
  previous_close?: string;
  datetime?: string;
  status?: string;
  code?: number;
  message?: string;
}

function explainTwelveError(message: string, providerSymbol: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("not available") ||
    lower.includes("plan") ||
    lower.includes("subscribe") ||
    lower.includes("permission") ||
    lower.includes("upgrade")
  ) {
    return (
      `Twelve Data ücretsiz planı BIST/Türkiye verisini kapsamaz (${providerSymbol}). ` +
      `Grow planı gerekir; uygulama Yahoo Finance ile devam etmeyi dener.`
    );
  }
  if (lower.includes("api credits") || lower.includes("run out") || lower.includes("limit")) {
    return `Twelve Data kota/limit aşıldı (${providerSymbol}).`;
  }
  return message || `Sembol bulunamadı: ${providerSymbol}`;
}

async function fetchTwelveQuote(providerSymbol: string): Promise<TwelveQuoteRaw> {
  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Twelve Data API anahtarı yapılandırılmamış. .env dosyasına TWELVE_DATA_API_KEY ekleyip sunucuyu yeniden başlatın."
    );
  }

  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", providerSymbol);
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Twelve Data HTTP ${res.status}`);
  }
  const data = (await res.json()) as TwelveQuoteRaw;
  if (data.status === "error" || (data.code && data.code >= 400)) {
    throw new Error(
      explainTwelveError(data.message ?? "", providerSymbol)
    );
  }
  if (!data.close) {
    throw new Error(`Fiyat alınamadı: ${providerSymbol}`);
  }
  return data;
}

async function lookupBistViaYahoo(code: string): Promise<AssetLookupResult> {
  const providerSymbol = toYahooBistSymbol(code);
  const yahoo = new YahooFinanceProvider();
  const { quote, name, exchange } = await yahoo.lookupQuote(providerSymbol);
  return {
    symbol: code.replace(/\.IS$/i, ""),
    name,
    assetType: "STOCK",
    category: "BIST",
    exchange: exchange.includes("Istanbul") || exchange === "IST" ? "BIST" : exchange || "BIST",
    currency: quote.currency || "TRY",
    provider: "yahoo_finance",
    providerSymbol,
    tefasCode: null,
    isin: null,
    price: quote.price,
    priceDate: quote.asOf.toISOString(),
    previousClose: quote.previousClose,
    dataQuality: quote.dataQuality,
  };
}

/** USDTRY → USD/TRY, BTCUSD → BTC/USD gibi parite formatına çevirir. */
function toPair(code: string): string {
  const c = code.replace("/", "").toUpperCase();
  if (c.length === 6) return `${c.slice(0, 3)}/${c.slice(3)}`;
  return code.toUpperCase();
}

export async function lookupAsset(
  category: AssetCategory,
  rawCode: string
): Promise<AssetLookupResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error("Kod/sembol girin.");

  if (category === "FUND") {
    const fund = await getFundProvider().getFundQuote(code);
    return {
      symbol: code,
      name: fund.name || code,
      assetType: "MUTUAL_FUND",
      category,
      exchange: "TEFAS",
      currency: "TRY",
      provider: "tefas",
      providerSymbol: null,
      tefasCode: code,
      isin: null,
      price: fund.price,
      priceDate: fund.priceDate.toISOString().slice(0, 10),
      previousClose: fund.previousPrice,
      dataQuality: fund.dataQuality,
    };
  }

  if (category === "BIST") {
    const providerSymbol = `${code.replace(/\.IS$/i, "")}.IS`;
    // Twelve Data ücretsiz planda BIST yok → Yahoo Finance birincil / fallback
    if (process.env.TWELVE_DATA_API_KEY?.trim()) {
      try {
        const q = await fetchTwelveQuote(providerSymbol);
        return {
          symbol: code.replace(/\.IS$/i, ""),
          name: q.name || code,
          assetType: "STOCK",
          category,
          exchange: q.exchange || "BIST",
          currency: q.currency || "TRY",
          provider: "twelve_data",
          providerSymbol,
          tefasCode: null,
          isin: null,
          price: q.close ?? null,
          priceDate: q.datetime ?? null,
          previousClose: q.previous_close ?? null,
          dataQuality: "DELAYED",
        };
      } catch {
        // plan / kota / sembol → Yahoo
      }
    }
    try {
      return await lookupBistViaYahoo(code);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : `BIST sembolü bulunamadı: ${code}`
      );
    }
  }

  if (category === "US") {
    const providerSymbol = code;
    if (process.env.TWELVE_DATA_API_KEY?.trim()) {
      try {
        const q = await fetchTwelveQuote(providerSymbol);
        return {
          symbol: code,
          name: q.name || code,
          assetType: "STOCK",
          category,
          exchange: q.exchange || "NASDAQ",
          currency: q.currency || "USD",
          provider: "twelve_data",
          providerSymbol,
          tefasCode: null,
          isin: null,
          price: q.close ?? null,
          priceDate: q.datetime ?? null,
          previousClose: q.previous_close ?? null,
          dataQuality: "DELAYED",
        };
      } catch {
        // Twelve başarısızsa Yahoo dene
      }
    }
    const yahoo = new YahooFinanceProvider();
    const { quote, name, exchange } = await yahoo.lookupQuote(providerSymbol);
    return {
      symbol: code,
      name,
      assetType: "STOCK",
      category,
      exchange: exchange || "NASDAQ",
      currency: quote.currency || "USD",
      provider: "yahoo_finance",
      providerSymbol,
      tefasCode: null,
      isin: null,
      price: quote.price,
      priceDate: quote.asOf.toISOString(),
      previousClose: quote.previousClose,
      dataQuality: quote.dataQuality,
    };
  }

  if (category === "FX") {
    const providerSymbol = toPair(code);
    const q = await fetchTwelveQuote(providerSymbol);
    return {
      symbol: providerSymbol.replace("/", ""),
      name: q.name || `${providerSymbol}`,
      assetType: "FX",
      category,
      exchange: null,
      currency: q.currency || "TRY",
      provider: "twelve_data",
      providerSymbol,
      tefasCode: null,
      isin: null,
      price: q.close ?? null,
      priceDate: q.datetime ?? null,
      previousClose: q.previous_close ?? null,
      dataQuality: "DELAYED",
    };
  }

  if (category === "GOLD") {
    const providerSymbol = code === "GRAMALTIN" || code === "XAUTRY" ? "XAU/TRY" : toPair(code);
    const q = await fetchTwelveQuote(providerSymbol);
    return {
      symbol: code === "XAUTRY" ? "GRAMALTIN" : code,
      name: q.name || "Gram Altın (TRY)",
      assetType: "GOLD",
      category,
      exchange: null,
      currency: q.currency || "TRY",
      provider: "twelve_data",
      providerSymbol,
      tefasCode: null,
      isin: null,
      price: q.close ?? null,
      priceDate: q.datetime ?? null,
      previousClose: q.previous_close ?? null,
      dataQuality: "DELAYED",
    };
  }

  // CRYPTO
  const providerSymbol = code.includes("/") ? code : `${code}/USD`;
  const q = await fetchTwelveQuote(providerSymbol);
  return {
    symbol: providerSymbol.replace("/", ""),
    name: q.name || providerSymbol,
    assetType: "CRYPTO",
    category,
    exchange: q.exchange || null,
    currency: q.currency || "USD",
    provider: "twelve_data",
    providerSymbol,
    tefasCode: null,
    isin: null,
    price: q.close ?? null,
    priceDate: q.datetime ?? null,
    previousClose: q.previous_close ?? null,
    dataQuality: "DELAYED",
  };
}
