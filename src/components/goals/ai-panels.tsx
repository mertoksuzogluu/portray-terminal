"use client";

import { Sparkles } from "lucide-react";
import { GlassCard } from "./glass";

export function AiGoalCoach({
  headlines,
  source,
}: {
  headlines: string[];
  source: string;
}) {
  return (
    <GlassCard className="border-accent/20">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="font-display text-lg tracking-tight">AI Goal Coach</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
          {source === "openai" ? "Canlı" : "Şablon"}
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {headlines.map((h, i) => (
          <li
            key={i}
            className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm leading-relaxed"
          >
            {h}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

export function AiRecommendations({ items }: { items: string[] }) {
  return (
    <GlassCard>
      <h3 className="font-display text-lg tracking-tight">AI Önerileri</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Her hafta güncellenir
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((r, i) => (
          <li
            key={i}
            className="flex gap-2 text-sm text-foreground/90"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {r}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

export function GoalProgressYtd({
  planned,
  actual,
  comment,
}: {
  planned: number;
  actual: number;
  comment: string;
}) {
  const fmt = (n: number) => {
    const abs = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(Math.abs(n));
    if (n > 0) return `+${abs}`;
    if (n < 0) return `-${abs}`;
    return abs;
  };

  return (
    <GlassCard>
      <h3 className="font-display text-lg tracking-tight">Bu yıl hedef</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Portföy değerinin yıl başından (veya bu yılki başlangıçtan) bu yana
        değişimi
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Planlanan</p>
          <p className="font-display text-xl tracking-tight text-muted-foreground">
            {fmt(planned)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Gerçekleşen</p>
          <p
            className={`font-display text-xl tracking-tight ${
              actual >= 0 ? "text-primary" : "text-negative"
            }`}
          >
            {fmt(actual)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-accent">{comment}</p>
    </GlassCard>
  );
}
