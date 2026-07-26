"use client";

import { formatDateTR, formatMoney, formatPercentPlain } from "@/lib/format/tr";
import { GlassCard } from "./glass";
import { cn } from "@/lib/utils/cn";

export function GoalSummaryCard({
  targetAmount,
  progressPct,
  estimatedDate,
  aheadStatus,
  aheadLabel,
  todayDelta,
  todayProgressPct,
}: {
  targetAmount: number;
  progressPct: number;
  estimatedDate: string | null;
  aheadStatus: "ahead" | "behind" | "on_track";
  aheadLabel: string;
  todayDelta: number;
  todayProgressPct: number;
}) {
  const statusEmoji =
    aheadStatus === "ahead" ? "🚀" : aheadStatus === "behind" ? "⏱️" : "⚖️";
  const statusText =
    aheadStatus === "ahead"
      ? "Planın Önünde"
      : aheadStatus === "behind"
        ? "Planın Gerisinde"
        : "Planla Uyumlu";

  return (
    <GlassCard className="border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-accent/10">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Goal Summary
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="text-xs text-muted-foreground">🎯 Hedef</p>
          <p className="font-display text-xl tracking-tight">
            {formatMoney(targetAmount, "TRY", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tamamlanma</p>
          <p className="font-display text-xl tracking-tight text-primary">
            {formatPercentPlain(progressPct / 100, 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tahmini Tarih</p>
          <p className="font-display text-xl tracking-tight">
            {estimatedDate ? formatDateTR(estimatedDate) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Durum</p>
          <p
            className={cn(
              "font-display text-xl tracking-tight",
              aheadStatus === "ahead" && "text-positive",
              aheadStatus === "behind" && "text-negative"
            )}
          >
            {statusEmoji} {statusText}
          </p>
          <p className="text-[11px] text-muted-foreground">{aheadLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Bugünkü İlerleme</p>
          <p
            className={cn(
              "font-display text-xl tracking-tight",
              todayDelta >= 0 ? "text-positive" : "text-negative"
            )}
          >
            {todayDelta >= 0 ? "+" : ""}
            {formatMoney(todayDelta, "TRY", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
      </div>
      <p className="mt-4 border-t border-white/10 pt-3 text-sm text-muted-foreground">
        Bugün hedefe %{" "}
        {Math.abs(todayProgressPct).toLocaleString("tr-TR", {
          maximumFractionDigits: 2,
        })}{" "}
        {todayDelta >= 0 ? "daha yaklaştın" : "uzaklaştın"}.
      </p>
    </GlassCard>
  );
}
