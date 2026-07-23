import {
  startOfDay as dfStartOfDay,
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

/**
 * Europe/Istanbul takvim gününü UTC gece yarısı Date olarak döner.
 * Vercel (UTC) ile yerel Mac (UTC+3) arasında gün kaymasını önler.
 */
export function marketDateOnly(date: Date = new Date()): Date {
  if (Number.isNaN(date.getTime())) {
    return new Date(NaN);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Bugünün İstanbul takvim günü (UTC Date). */
export function istanbulToday(now: Date = new Date()): Date {
  return marketDateOnly(now);
}

/**
 * DB Date / timestamp alanları için kararlı gün anahtarı (YYYY-MM-DD).
 * @db.Date değerleri UTC gece yarısı tutulduğu için ISO günü güvenli.
 * Diğer timestamp'lerde İstanbul günü kullanılır.
 */
export function toDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  // Saf tarih (saat 00:00 UTC) → doğrudan ISO gün
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return date.toISOString().slice(0, 10);
  }
  return marketDateOnly(date).toISOString().slice(0, 10);
}

export function parseDateKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const parsed = parseISO(key);
  return marketDateOnly(parsed);
}

/** @deprecated Yerel TZ'ye bağlı — yeni kodda marketDateOnly kullanın. */
export function dateOnly(date: Date): Date {
  return marketDateOnly(date);
}

/**
 * date-fns startOfDay yerine İstanbul günü.
 * Mevcut import'ları kırmamak için aynı isimle export edilir.
 */
export function startOfDay(date: Date = new Date()): Date {
  return marketDateOnly(date);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function periodRanges(asOf: Date = new Date()) {
  const today = marketDateOnly(asOf);
  // periodRanges içindeki subDays date-fns yerel TZ kullanır;
  // asOf zaten UTC gece yarısı olduğu için tutarlı kalsın diye
  // UTC tabanlı kaydırma kullanıyoruz.
  return {
    last7d: { start: addUtcDays(today, -7), end: today },
    last30d: { start: addUtcDays(today, -30), end: today },
    thisMonth: {
      start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      end: today,
    },
    lastMonth: (() => {
      const start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)
      );
      const end = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)
      );
      return { start, end };
    })(),
    last3m: { start: addUtcDays(today, -90), end: today },
    last5m: { start: addUtcDays(today, -150), end: today },
    last6m: { start: addUtcDays(today, -180), end: today },
    ytd: {
      start: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
      end: today,
    },
    last1y: { start: addUtcDays(today, -365), end: today },
  };
}

export {
  dfStartOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  format,
  subDays,
  subMonths,
};
