import type { FxDataProvider, FxQuote, InflationDataProvider } from "./types";

const EVDS_BASE = "https://evds2.tcmb.gov.tr/service/evds";

/**
 * TCMB EVDS serileri:
 * TP.DK.USD.A — USD/TRY (döviz alış)
 * TP.DK.EUR.A — EUR/TRY
 * TP.FG.J0 — TÜFE genel endeks
 */
const SERIES = {
  USDTRY: "TP.DK.USD.A",
  EURTRY: "TP.DK.EUR.A",
  TUFE: "TP.FG.J0",
} as const;

interface EvdsResponse {
  items?: Array<Record<string, string | null>>;
}

export class TcmbEvdsFxProvider implements FxDataProvider {
  readonly name = "tcmb_evds";
  private readonly apiKey: string | undefined;

  constructor(apiKey = process.env.TCMB_EVDS_API_KEY) {
    this.apiKey = apiKey?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async getRate(pair: "USDTRY" | "EURTRY"): Promise<FxQuote> {
    if (!this.apiKey) {
      throw new Error("TCMB EVDS API anahtarı yapılandırılmamış.");
    }

    const series = SERIES[pair];
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 14);

    const url = new URL(`${EVDS_BASE}/series=${series}`);
    url.searchParams.set(
      "startDate",
      formatTr(start)
    );
    url.searchParams.set("endDate", formatTr(end));
    url.searchParams.set("type", "json");
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`TCMB EVDS HTTP ${res.status}`);
    const data = (await res.json()) as EvdsResponse;
    const items = (data.items ?? []).filter((row) => {
      const key = Object.keys(row).find((k) => k.startsWith("TP_"));
      return key && row[key] != null && row[key] !== "";
    });
    const last = items[items.length - 1];
    if (!last) throw new Error(`TCMB: ${pair} kuru bulunamadı.`);

    const valueKey = Object.keys(last).find((k) => k.startsWith("TP_"));
    const rate = valueKey ? last[valueKey] : null;
    if (!rate) throw new Error(`TCMB: ${pair} değeri boş.`);

    return {
      pair,
      rate: String(rate).replace(",", "."),
      asOf: last.Tarih ? parseTrDate(last.Tarih) : new Date(),
      source: this.name,
      dataQuality: "END_OF_DAY",
    };
  }
}

export class TcmbEvdsInflationProvider implements InflationDataProvider {
  readonly name = "tcmb_evds_inflation";
  private readonly apiKey: string | undefined;

  constructor(apiKey = process.env.TCMB_EVDS_API_KEY) {
    this.apiKey = apiKey?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async fetchLatest(): Promise<
    Array<{
      period: string;
      indexValue: string;
      monthlyRate: string | null;
      annualRate: string | null;
    }>
  > {
    if (!this.apiKey) {
      throw new Error("TCMB EVDS API anahtarı yapılandırılmamış.");
    }

    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 2);

    const url = new URL(`${EVDS_BASE}/series=${SERIES.TUFE}`);
    url.searchParams.set("startDate", formatTr(start));
    url.searchParams.set("endDate", formatTr(end));
    url.searchParams.set("type", "json");
    url.searchParams.set("frequency", "5"); // aylık
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`TCMB EVDS HTTP ${res.status}`);
    const data = (await res.json()) as EvdsResponse;

    const rows: Array<{
      period: string;
      indexValue: string;
      monthlyRate: string | null;
      annualRate: string | null;
    }> = [];

    let prev: number | null = null;
    for (const item of data.items ?? []) {
      const valueKey = Object.keys(item).find((k) => k.startsWith("TP_"));
      const raw = valueKey ? item[valueKey] : null;
      if (!raw || !item.Tarih) continue;
      const indexValue = Number(String(raw).replace(",", "."));
      if (!Number.isFinite(indexValue)) continue;

      const period = toPeriod(item.Tarih);
      let monthlyRate: string | null = null;
      if (prev != null && prev > 0) {
        monthlyRate = ((indexValue - prev) / prev).toString();
      }
      rows.push({
        period,
        indexValue: String(indexValue),
        monthlyRate,
        annualRate: null,
      });
      prev = indexValue;
    }

    return rows;
  }
}

function formatTr(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function parseTrDate(value: string): Date {
  // dd-MM-yyyy
  const [dd, mm, yyyy] = value.split("-").map(Number);
  if (!yyyy) return new Date(value);
  return new Date(Date.UTC(yyyy, (mm ?? 1) - 1, dd ?? 1));
}

function toPeriod(tarih: string): string {
  // dd-MM-yyyy → yyyy-MM
  const parts = tarih.split("-");
  if (parts.length >= 3) {
    return `${parts[2]}-${parts[1]}`;
  }
  return tarih.slice(0, 7);
}

/** API key yokken Twelve Data FX fallback */
export class TwelveDataFxProvider implements FxDataProvider {
  readonly name = "twelve_data_fx";

  isConfigured(): boolean {
    return Boolean(process.env.TWELVE_DATA_API_KEY?.trim());
  }

  async getRate(pair: "USDTRY" | "EURTRY"): Promise<FxQuote> {
    const { TwelveDataProvider } = await import("./twelve-data");
    const provider = new TwelveDataProvider();
    const symbol = pair === "USDTRY" ? "USD/TRY" : "EUR/TRY";
    const quote = await provider.getQuote(symbol);
    return {
      pair,
      rate: quote.price,
      asOf: quote.asOf,
      source: this.name,
      dataQuality: quote.dataQuality,
    };
  }
}
