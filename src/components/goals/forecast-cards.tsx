"use client";

import { GlassCard } from "./glass";

export function ForecastCards({
  forecasts,
}: {
  forecasts: {
    id: string;
    label: string;
    emoji: string;
    year: number | null;
    returnAnnual: number;
  }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {forecasts.map((f) => (
        <GlassCard key={f.id} className="text-center">
          <p className="text-2xl">{f.emoji}</p>
          <p className="mt-1 text-sm font-medium">{f.label}</p>
          <p className="mt-2 font-display text-3xl tracking-tight text-primary">
            {f.year ?? "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Yıllık ~%{(f.returnAnnual * 100).toFixed(0)}
          </p>
        </GlassCard>
      ))}
    </div>
  );
}
