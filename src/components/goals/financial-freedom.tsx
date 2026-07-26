"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatMoney, formatPercentPlain } from "@/lib/format/tr";
import { GlassCard } from "./glass";

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
  const [living, setLiving] = useState(String(monthlyLivingCost ?? 120000));
  const [passive, setPassive] = useState(
    String(targetPassiveIncome ?? 200000)
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await clientFetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        body: JSON.stringify({
          freedomPrefs: {
            monthlyLivingCost: Number(living) || 0,
            targetPassiveIncome: Number(passive) || 0,
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
          <Input
            className="mt-1"
            value={living}
            onChange={(e) => setLiving(e.target.value)}
          />
        </div>
        <div>
          <Label>Hedef pasif gelir</Label>
          <Input
            className="mt-1"
            value={passive}
            onChange={(e) => setPassive(e.target.value)}
          />
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
