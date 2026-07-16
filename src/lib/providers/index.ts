import { TwelveDataProvider } from "./twelve-data";
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

export function getStockProvider(): MarketDataProvider {
  return new TwelveDataProvider();
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

  return {
    twelveData: {
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
    demoMode: process.env.DEMO_MODE === "true" || !stock.isConfigured(),
  };
}
