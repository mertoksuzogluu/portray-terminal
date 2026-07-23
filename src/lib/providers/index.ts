import { CompositeStockProvider } from "./composite-stock";
import { DemoFundProvider, TefasFundProvider } from "./tefas";
import {
  TcmbEvdsFxProvider,
  TcmbEvdsInflationProvider,
  TwelveDataFxProvider,
} from "./tcmb-evds";
import type {
  FundDataProvider,
  FxDataProvider,
  InflationDataProvider,
  MarketDataProvider,
} from "./types";

export * from "./types";
export * from "./twelve-data";
export * from "./tefas";
export * from "./tcmb-evds";
export * from "./yahoo-finance";
export * from "./composite-stock";

export function getStockProvider(): MarketDataProvider {
  // Twelve Data öncelikli; BIST için ücretsiz planda Yahoo Finance fallback
  return new CompositeStockProvider();
}

export function getFundProvider(): FundDataProvider {
  // Önce TEFAS dene; runtime hatalarında servis katmanı demo/stale kullanır
  return new TefasFundProvider();
}

export function getDemoFundProvider(): FundDataProvider {
  return new DemoFundProvider();
}

export function getFxProvider(): FxDataProvider {
  const tcmb = new TcmbEvdsFxProvider();
  if (tcmb.isConfigured()) return tcmb;
  const twelve = new TwelveDataFxProvider();
  if (twelve.isConfigured()) return twelve;
  return tcmb; // yapılandırılmamış — servis demo moda düşer
}

export function getInflationProvider(): InflationDataProvider {
  return new TcmbEvdsInflationProvider();
}

export function getProviderStatus() {
  const stock = getStockProvider();
  const fund = getFundProvider();
  const fx = getFxProvider();
  const inflation = getInflationProvider();

  const twelveConfigured = Boolean(process.env.TWELVE_DATA_API_KEY?.trim());
  return {
    twelveData: {
      configured: twelveConfigured,
      name: "twelve_data",
    },
    yahooFinance: {
      configured: true,
      name: "yahoo_finance",
    },
    stock: {
      configured: stock.isConfigured(),
      name: stock.name,
    },
    tefas: {
      configured: fund.isConfigured(),
      name: fund.name,
    },
    fx: {
      configured: fx.isConfigured(),
      name: fx.name,
    },
    inflation: {
      configured: inflation.isConfigured(),
      name: inflation.name,
    },
    demoMode: process.env.DEMO_MODE === "true" && !twelveConfigured,
  };
}
