"use client";

import { Check, Lock } from "lucide-react";
import { GlassCard } from "./glass";
import { cn } from "@/lib/utils/cn";

export function Milestones({
  items,
}: {
  items: { amount: number; label: string; reached: boolean }[];
}) {
  return (
    <GlassCard>
      <h3 className="font-display text-lg tracking-tight">Kilometre taşları</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((m) => (
          <div
            key={m.amount}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
              m.reached
                ? "border-positive/40 bg-positive/10 text-positive"
                : "border-white/10 bg-white/[0.02] text-muted-foreground"
            )}
          >
            {m.reached ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5 opacity-60" />
            )}
            {m.label}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export function Achievements({
  items,
}: {
  items: {
    code: string;
    label: string;
    unlocked: boolean;
    unlockedAt: string | null;
  }[];
}) {
  return (
    <GlassCard>
      <h3 className="font-display text-lg tracking-tight">Başarımlar</h3>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((a) => (
          <div
            key={a.code}
            className={cn(
              "rounded-lg border px-3 py-3 text-center text-xs",
              a.unlocked
                ? "border-accent/40 bg-accent/10 text-foreground"
                : "border-white/5 bg-black/20 text-muted-foreground opacity-60"
            )}
          >
            <p className="text-lg">{a.unlocked ? "🏅" : "🔒"}</p>
            <p className="mt-1 font-medium">{a.label}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
