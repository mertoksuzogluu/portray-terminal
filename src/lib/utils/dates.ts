import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  subDays,
  subMonths,
  format,
  parseISO,
} from "date-fns";

export const APP_TIMEZONE = "Europe/Istanbul";

/** UTC tarih anahtarı (DB Date alanları için) */
export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(key: string): Date {
  const parsed = parseISO(key);
  return startOfDay(parsed);
}

export function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function periodRanges(asOf: Date = new Date()) {
  const today = startOfDay(asOf);
  return {
    last7d: { start: subDays(today, 7), end: today },
    last30d: { start: subDays(today, 30), end: today },
    thisMonth: { start: startOfMonth(today), end: today },
    lastMonth: {
      start: startOfMonth(subMonths(today, 1)),
      end: endOfMonth(subMonths(today, 1)),
    },
    last3m: { start: subMonths(today, 3), end: today },
    last5m: { start: subMonths(today, 5), end: today },
    last6m: { start: subMonths(today, 6), end: today },
    ytd: { start: startOfYear(today), end: today },
    last1y: { start: subMonths(today, 12), end: today },
  };
}

export {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  format,
  subDays,
  subMonths,
};
