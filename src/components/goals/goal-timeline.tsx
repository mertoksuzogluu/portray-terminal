"use client";

import { GlassCard } from "./glass";
import { cn } from "@/lib/utils/cn";

export function GoalTimeline({
  progressPct,
  plannedDate,
  estimatedDate,
}: {
  progressPct: number;
  plannedDate: string;
  estimatedDate: string | null;
}) {
  const planYear = new Date(plannedDate).getFullYear();
  const nowYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = nowYear; y <= planYear; y++) years.push(y);
  if (years.length === 0) years.push(nowYear);

  const estYear = estimatedDate
    ? new Date(estimatedDate).getFullYear()
    : null;

  return (
    <GlassCard>
      <h3 className="font-display text-lg tracking-tight">Hedef zaman çizelgesi</h3>
      <div className="mt-5 space-y-3">
        {years.map((year, i) => {
          const isLast = i === years.length - 1;
          const span = Math.max(1, planYear - nowYear);
          const expectedByYear = ((year - nowYear) / span) * 100;
          const fill = Math.min(
            100,
            isLast
              ? progressPct
              : year < (estYear ?? planYear)
                ? Math.min(progressPct + (expectedByYear - progressPct) * 0.3, 95)
                : Math.min(progressPct, expectedByYear)
          );
          // Visual: today bar uses actual progress; intermediate years interpolate
          const bar =
            year === nowYear
              ? progressPct
              : isLast
                ? 100
                : Math.min(
                    100,
                    progressPct +
                      ((100 - progressPct) * (year - nowYear)) / span
                  );

          return (
            <div key={year} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs text-muted-foreground">
                {year === nowYear ? "Bugün" : String(year)}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700",
                    isLast && "from-accent to-primary"
                  )}
                  style={{ width: `${Math.max(4, bar)}%` }}
                />
              </div>
              {isLast ? (
                <span className="w-16 text-right text-xs">🎯 Hedef</span>
              ) : (
                <span className="w-16 text-right text-[10px] text-muted-foreground">
                  ~%{Math.round(fill)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
