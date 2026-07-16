import { format, startOfMonth } from "date-fns";
import { d, type Decimal } from "@/lib/calculations/decimal";
import {
  chainTwr,
  compoundReturns,
  monthlyReturnStats,
  periodReturnFromValues,
} from "@/lib/calculations/returns";
import type { PortfolioSnapshotRecord } from "../types";

export function monthKey(date: Date): string {
  return format(startOfMonth(date), "yyyy-MM");
}

export function snapshotsInRange(
  snapshots: PortfolioSnapshotRecord[],
  start: Date,
  end: Date
): PortfolioSnapshotRecord[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return snapshots.filter((s) => {
    const t = s.snapshotDate.getTime();
    return t >= startMs && t <= endMs;
  });
}

export function twrReturnForSnapshots(
  snapshots: PortfolioSnapshotRecord[]
): Decimal | null {
  const factors = snapshots
    .map((s) => s.twrDailyFactor)
    .filter((f): f is Decimal => f !== null);
  if (factors.length === 0) return null;
  return chainTwr(factors);
}

export function valueReturnForSnapshots(
  snapshots: PortfolioSnapshotRecord[]
): Decimal | null {
  if (snapshots.length < 2) return null;
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  return periodReturnFromValues(first.totalMarketValue, last.totalMarketValue);
}

export function monthlyReturnsFromSnapshots(
  snapshots: PortfolioSnapshotRecord[],
  monthCount: number,
  asOf: Date
): Array<{ month: string; return: Decimal | null }> {
  const results: Array<{ month: string; return: Decimal | null }> = [];
  const cursor = startOfMonth(asOf);

  for (let i = 0; i < monthCount; i++) {
    const monthStart = new Date(cursor);
    monthStart.setMonth(cursor.getMonth() - i);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthStart.getMonth() + 1);
    monthEnd.setDate(0);

    const monthSnaps = snapshotsInRange(snapshots, monthStart, monthEnd);
    const ret = twrReturnForSnapshots(monthSnaps);
    results.push({ month: monthKey(monthStart), return: ret });
  }

  return results.reverse();
}

export function lastNMonthlyReturnStats(
  snapshots: PortfolioSnapshotRecord[],
  monthCount: number,
  asOf: Date
) {
  const monthly = monthlyReturnsFromSnapshots(snapshots, monthCount, asOf);
  const validReturns = monthly
    .map((m) => m.return)
    .filter((r): r is Decimal => r !== null);
  return {
    monthly,
    stats: monthlyReturnStats(validReturns),
  };
}

export function severityFromReturn(ret: Decimal | null): "POSITIVE" | "WARNING" | "INFO" {
  if (ret === null) return "INFO";
  if (ret.gt(0)) return "POSITIVE";
  if (ret.lt(0)) return "WARNING";
  return "INFO";
}

import { INSIGHT_DISCLAIMER } from "../types";

export function appendDisclaimer(message: string): string {
  return `${message} ${INSIGHT_DISCLAIMER}`;
}

export { compoundReturns, d };
