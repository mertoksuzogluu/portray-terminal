export type DataQualityStatus =
  | "LIVE"
  | "DELAYED"
  | "END_OF_DAY"
  | "STALE"
  | "MANUAL"
  | "ERROR";

export interface MarketQuote {
  symbol: string;
  providerSymbol: string;
  price: string;
  previousClose: string | null;
  open: string | null;
  high: string | null;
  low: string | null;
  volume: string | null;
  currency: string;
  asOf: Date;
  fetchedAt: Date;
  isDelayed: boolean;
  dataQuality: DataQualityStatus;
  source: string;
}

export interface HistoricalPrice {
  symbol: string;
  date: Date;
  open: string | null;
  high: string | null;
  low: string | null;
  close: string;
  volume: string | null;
  source: string;
}

export interface MarketDataProvider {
  readonly name: string;
  getQuote(symbol: string): Promise<MarketQuote>;
  getQuoteByProviderSymbol?(providerSymbol: string): Promise<MarketQuote>;
  getQuotes?(symbols: string[]): Promise<MarketQuote[]>;
  getHistoricalPrices(
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalPrice[]>;
  isConfigured(): boolean;
}

export interface FundQuote {
  code: string;
  name: string;
  price: string;
  previousPrice: string | null;
  priceDate: Date;
  dailyChange: string | null;
  fetchedAt: Date;
  source: string;
  dataQuality: DataQualityStatus;
  status: "OK" | "STALE" | "ERROR";
}

export interface FundHistoricalPrice {
  code: string;
  date: Date;
  price: string;
  source: string;
}

export interface FundDataProvider {
  readonly name: string;
  getFundQuote(code: string): Promise<FundQuote>;
  getFundQuotes?(codes: string[]): Promise<FundQuote[]>;
  getHistoricalPrices(
    code: string,
    startDate: Date,
    endDate: Date
  ): Promise<FundHistoricalPrice[]>;
  isConfigured(): boolean;
}

export interface FxQuote {
  pair: string;
  rate: string;
  asOf: Date;
  source: string;
  dataQuality: DataQualityStatus;
}

export interface FxDataProvider {
  readonly name: string;
  getRate(pair: "USDTRY" | "EURTRY"): Promise<FxQuote>;
  isConfigured(): boolean;
}

export interface InflationDataProvider {
  readonly name: string;
  fetchLatest(): Promise<
    Array<{
      period: string;
      indexValue: string;
      monthlyRate: string | null;
      annualRate: string | null;
    }>
  >;
  isConfigured(): boolean;
}
