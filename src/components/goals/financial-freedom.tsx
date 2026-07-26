"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatMoney, formatPercentPlain } from "@/lib/format/tr";
import { GlassCard } from "./glass";
import { MoneyInput } from "./money-input";

export function FinancialFreedomPanel({
  goalId,
  score,
  estimatedYears,
  monthlyPassiveProxy,
  monthlyLivingCost,
  targetPassiveIncome,
  onSaved,
}: {
  goalId: string;
  score: number;
  estimatedYears: number | null;
  monthlyPassiveProxy: number;
  monthlyLivingCost: number | null;
  targetPassiveIncome: number | null;
  onSaved: () => void;
}) {
  const [living, setLiving] = useState(monthlyLivingCost ?? 120_000);
  const [passive, setPassive] = useState(targetPassiveIncome ?? 200_000);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLiving(monthlyLivingCost ?? 120_000);
    setPassive(targetPassiveIncome ?? 200_000);
  }, [goalId, monthlyLivingCost, targetPassiveIncome]);

  async function save() {
    setSaving(true);
    try {
      await clientFetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        body: JSON.stringify({
          freedomPrefs: {
            monthlyLivingCost: living || 0,
            targetPassiveIncome: passive || 0,
          },
        }),
      });
      toast.success("Finansal özgürlük tercihleri kaydedildi");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard>
      <h3 className="font-display text-lg tracking-tight">
        Finansal özgürlük
      </h3>
      <div className="mt-4 flex items-end gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Freedom Score</p>
          <p className="font-display text-4xl tracking-tight text-primary">
            {formatPercentPlain(score, 0)}
          </p>
        </div>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
              style={{ width: `${Math.min(100, score * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Mevcut pasif proxy:{" "}
            {formatMoney(monthlyPassiveProxy, "TRY", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
            /ay
            {estimatedYears != null
              ? ` · Mevcut planınla yaklaşık ${estimatedYears.toFixed(1)} yıl içinde ulaşman bekleniyor.`
              : null}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Aylık yaşam giderim</Label>
          <div className="mt-1">
            <MoneyInput value={living} onChange={setLiving} />
          </div>
        </div>
        <div>
          <Label>Hedef pasif gelir</Label>
          <div className="mt-1">
            <MoneyInput value={passive} onChange={setPassive} />
          </div>
        </div>
      </div>
      <Button
        className="mt-3"
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={save}
      >
        {saving ? "Kaydediliyor…" : "Güncelle"}
      </Button>
    </GlassCard>
  );
}
