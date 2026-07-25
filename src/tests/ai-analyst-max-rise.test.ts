import { describe, expect, it } from "vitest";
import { calculateMaxRise } from "@/lib/ai-analyst/metrics";

describe("calculateMaxRise", () => {
  it("measures trough-to-peak rise", () => {
    const values = [
      { date: new Date("2026-07-01"), value: 100 },
      { date: new Date("2026-07-02"), value: 90 },
      { date: new Date("2026-07-03"), value: 108 },
      { date: new Date("2026-07-04"), value: 105 },
    ];
    const r = calculateMaxRise(values);
    expect(r.maxRise).toBeCloseTo(0.2, 5); // 90 → 108
    expect(r.start).toBe("2026-07-02");
    expect(r.peak).toBe("2026-07-03");
  });
});
