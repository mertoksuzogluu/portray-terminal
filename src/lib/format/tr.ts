import { d, type DecimalInput } from "@/lib/calculations/decimal";

const TRY_FORMATTER = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_NUMBER = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function formatMoney(
  value: DecimalInput,
  currency = "TRY",
  options?: Intl.NumberFormatOptions
): string {
  const amount = d(value).toNumber();
  if (currency === "TRY") {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount);
  }
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    ...options,
  }).format(amount);
}

export function formatNumber(value: DecimalInput, digits = 2): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(d(value).toNumber());
}

export function formatPercent(
  value: DecimalInput,
  digits = 2,
  alreadyRatio = true
): string {
  const pct = alreadyRatio ? d(value).times(100) : d(value);
  const sign = pct.isPositive() ? "+" : "";
  return `${sign}${formatNumber(pct, digits)}%`;
}

export function formatPercentPlain(
  value: DecimalInput,
  digits = 2,
  alreadyRatio = true
): string {
  const pct = alreadyRatio ? d(value).times(100) : d(value);
  return `${formatNumber(pct, digits)}%`;
}

export function formatCompact(value: DecimalInput): string {
  return COMPACT_NUMBER.format(d(value).toNumber());
}

export function formatSignedMoney(value: DecimalInput, currency = "TRY"): string {
  const amount = d(value);
  const formatted = formatMoney(amount.abs(), currency);
  if (amount.isZero()) return formatted;
  return amount.isPositive() ? `+${formatted}` : `-${formatted}`;
}

export function formatDateTR(date: Date | string): string {
  const dte = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(dte);
}

export function formatDateTimeTR(date: Date | string): string {
  const dte = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dte);
}

export { TRY_FORMATTER, NUMBER_FORMATTER };
