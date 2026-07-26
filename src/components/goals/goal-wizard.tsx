"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientFetch } from "@/lib/api/client-fetch";
import {
  CONTRIBUTION_GROWTH_LABELS,
  GOAL_TYPE_LABELS,
  type ContributionGrowth,
  type GoalTargetKind,
  type GoalType,
} from "@/lib/goals/types";
import { GlassCard } from "./glass";
import { cn } from "@/lib/utils/cn";

const TYPES = Object.keys(GOAL_TYPE_LABELS) as GoalType[];
const GROWTH = Object.keys(CONTRIBUTION_GROWTH_LABELS) as ContributionGrowth[];
const RETURNS = [0.15, 0.2, 0.25];

function addYears(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function GoalWizard({ onCreated }: { onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<GoalType>("PORTFOLIO_SIZE");
  const [customTitle, setCustomTitle] = useState("");
  const [targetKind, setTargetKind] = useState<GoalTargetKind>("LUMP_SUM");
  const [targetAmount, setTargetAmount] = useState("25000000");
  const [dateMode, setDateMode] = useState<"5" | "10" | "custom">("10");
  const [customDate, setCustomDate] = useState(addYears(10));
  const [monthly, setMonthly] = useState("100000");
  const [growth, setGrowth] = useState<ContributionGrowth>("FIXED");
  const [ret, setRet] = useState(0.2);
  const [customRet, setCustomRet] = useState("");
  const [living, setLiving] = useState("120000");
  const [passive, setPassive] = useState("200000");

  const targetDate = useMemo(() => {
    if (dateMode === "5") return addYears(5);
    if (dateMode === "10") return addYears(10);
    return customDate;
  }, [dateMode, customDate]);

  const expectedReturn = customRet ? Number(customRet) / 100 : ret;

  async function submit() {
    setSaving(true);
    try {
      const amount = Number(targetAmount.replace(/\./g, "").replace(",", "."));
      const contrib = Number(monthly.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Geçerli bir hedef tutarı girin.");
      }
      if (!Number.isFinite(contrib) || contrib < 0) {
        throw new Error("Geçerli bir aylık kapasite girin.");
      }
      if (!Number.isFinite(expectedReturn) || expectedReturn < 0) {
        throw new Error("Geçerli bir getiri girin.");
      }

      const kind: GoalTargetKind =
        type === "PASSIVE_INCOME" || targetKind === "MONTHLY_PASSIVE"
          ? "MONTHLY_PASSIVE"
          : "LUMP_SUM";

      await clientFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          type,
          title:
            type === "CUSTOM" && customTitle.trim()
              ? customTitle.trim()
              : undefined,
          targetAmount: amount,
          targetKind: kind,
          targetDate,
          monthlyContribution: contrib,
          contributionGrowth: growth,
          expectedReturnAnnual: expectedReturn,
          freedomPrefs:
            type === "FINANCIAL_FREEDOM" || type === "PASSIVE_INCOME"
              ? {
                  monthlyLivingCost: Number(living) || 0,
                  targetPassiveIncome: Number(passive) || amount,
                }
              : undefined,
        }),
      });
      toast.success("Hedef oluşturuldu");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    "Hedef türü",
    "Tutar",
    "Tarih",
    "Aylık kapasite",
    "Katkı artışı",
    "Beklenen getiri",
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Target className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h1 className="font-display text-3xl tracking-tight">Hedef Kurulumu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Finansal hedefine ne kadar yaklaştığını takip et.
        </p>
      </div>

      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= step ? "bg-primary" : "bg-white/10"
            )}
          />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Adım {step + 1}/{steps.length} — {steps[step]}
      </p>

      <GlassCard className="min-h-[280px]">
        {step === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  if (t === "PASSIVE_INCOME") setTargetKind("MONTHLY_PASSIVE");
                  else setTargetKind("LUMP_SUM");
                }}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                  type === t
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20"
                )}
              >
                {GOAL_TYPE_LABELS[t]}
              </button>
            ))}
            {type === "CUSTOM" && (
              <div className="sm:col-span-2">
                <Label>Hedef adı</Label>
                <Input
                  className="mt-1"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Örn. Çocuk eğitim fonu"
                />
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {type === "PASSIVE_INCOME" || type === "FINANCIAL_FREEDOM" ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={targetKind === "LUMP_SUM" ? "default" : "outline"}
                  onClick={() => setTargetKind("LUMP_SUM")}
                >
                  Toplam tutar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    targetKind === "MONTHLY_PASSIVE" ? "default" : "outline"
                  }
                  onClick={() => setTargetKind("MONTHLY_PASSIVE")}
                >
                  Aylık pasif gelir
                </Button>
              </div>
            ) : null}
            <div>
              <Label>
                {targetKind === "MONTHLY_PASSIVE"
                  ? "Hedef aylık pasif gelir (TL)"
                  : "Hedef tutarı (TL)"}
              </Label>
              <Input
                className="mt-1 font-display text-lg"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>
            {(type === "FINANCIAL_FREEDOM" || type === "PASSIVE_INCOME") && (
              <div className="grid gap-3 sm:grid-cols-2">
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
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {(
              [
                ["5", "5 yıl"],
                ["10", "10 yıl"],
                ["custom", "Özel tarih"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDateMode(id)}
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-left text-sm",
                  dateMode === id
                    ? "border-primary/60 bg-primary/10"
                    : "border-white/10"
                )}
              >
                {label}
              </button>
            ))}
            {dateMode === "custom" && (
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Planlanan tarih: {targetDate}
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>
              Ortalama olarak her ay ne kadar yatırım yapabileceğini
              düşünüyorsun?
            </Label>
            <Input
              className="font-display text-lg"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              inputMode="decimal"
            />
            <p className="rounded-md border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-muted-foreground">
              Bu bilgi yalnızca hedef projeksiyonlarını hesaplamak için
              kullanılır. Portföyüne otomatik eklenmez.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2">
            <p className="mb-2 text-sm text-muted-foreground">
              Bu tutar zamanla değişecek mi?
            </p>
            {GROWTH.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrowth(g)}
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-left text-sm",
                  growth === g
                    ? "border-primary/60 bg-primary/10"
                    : "border-white/10"
                )}
              >
                {CONTRIBUTION_GROWTH_LABELS[g]}
              </button>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Beklenen ortalama yıllık getiri
            </p>
            <div className="flex flex-wrap gap-2">
              {RETURNS.map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={
                    !customRet && ret === r ? "default" : "outline"
                  }
                  onClick={() => {
                    setRet(r);
                    setCustomRet("");
                  }}
                >
                  %{(r * 100).toFixed(0)}
                </Button>
              ))}
            </div>
            <div>
              <Label>Kendi değerin (%)</Label>
              <Input
                className="mt-1"
                placeholder="Örn. 18"
                value={customRet}
                onChange={(e) => setCustomRet(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
        )}
      </GlassCard>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Geri
        </Button>
        {step < 5 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)}>
            İleri
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" disabled={saving} onClick={submit}>
            {saving ? "Kaydediliyor…" : "Hedefi oluştur"}
          </Button>
        )}
      </div>
    </div>
  );
}
