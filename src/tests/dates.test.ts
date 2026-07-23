import { describe, expect, it } from "vitest";
import {
  istanbulToday,
  marketDateOnly,
  parseDateKey,
  toDateKey,
} from "@/lib/utils/dates";

describe("market dates (Europe/Istanbul)", () => {
  it("maps Istanbul midnight timestamp to the Istanbul calendar day", () => {
    // 2026-07-22 00:00 Istanbul = 2026-07-21 21:00 UTC
    const ts = new Date("2026-07-21T21:00:00.000Z");
    expect(toDateKey(marketDateOnly(ts))).toBe("2026-07-22");
  });

  it("keeps UTC midnight @db.Date values stable", () => {
    const stored = new Date("2026-07-22T00:00:00.000Z");
    expect(toDateKey(stored)).toBe("2026-07-22");
    expect(toDateKey(marketDateOnly(stored))).toBe("2026-07-22");
  });

  it("parses date keys as UTC midnight", () => {
    const d = parseDateKey("2026-07-17");
    expect(d.toISOString()).toBe("2026-07-17T00:00:00.000Z");
  });

  it("istanbulToday returns a UTC date-only value", () => {
    const t = istanbulToday();
    expect(t.getUTCHours()).toBe(0);
    expect(t.getUTCMinutes()).toBe(0);
    expect(toDateKey(t)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("previousWeekday", () => {
  it("skips weekends", async () => {
    const { previousWeekday } = await import("@/lib/utils/dates");
    expect(previousWeekday(new Date("2026-07-23T00:00:00.000Z")).toISOString()).toBe(
      "2026-07-22T00:00:00.000Z"
    );
    expect(previousWeekday(new Date("2026-07-20T00:00:00.000Z")).toISOString()).toBe(
      "2026-07-17T00:00:00.000Z"
    );
  });
});
