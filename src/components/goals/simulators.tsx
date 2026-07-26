"use client";

import { useEffect, useMemo, useState } from "react";
import { simulateGoalShift } from "@/lib/goals/projection";
import type { ContributionGrowth, GoalTargetKind } from "@/lib/goals/types";
import { formatMoney } from "@/lib/format/tr";
import { GlassCard } from "./glass";

export function WhatIfSimulator({
  currentValue,
  targetAmount,
  targetKind,
  targetDate,
  monthlyContribution,
  contributionGrowth,
  expectedReturnAnnual,
}: {
  currentValue: number;
  targetAmount: number;
  targetKind: GoalTargetKind;
  targetDate: string;
  monthlyContribution: number;
  contributionGrowth: ContributionGrowth;
  expectedReturnAnnual: number;
}) {
  const [contrib, setContrib] = useState(monthlyContribution);

  useEffect(() => {
    setContrib(monthlyContribution);
  }, [monthlyContribution]);

  const result = useMemo(
    () =>
      simulateGoalShift(
        {
          currentValue,
          targetAmount,
          targetKind,
          targetDate: new Date(targetDate),
          monthlyContribution,
          contributionGrowth,
          expectedReturnAnnual,
        },
        { monthlyContribution: contrib }
      ),
    [
      currentValue,
      targetAmount,
      targetKind,
      targetDate,
      monthlyContribution,
      contributionGrowth,
      expectedReturnAnnual,
      contrib,
    ]
  );

  const max = Math.max(monthlyContribution * 3, 50_000, contrib);

  return (
    <GlassCard>
      <h3 className="font-display text-lg tracking-tight">What-if Simülatör</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Sadece simülasyon — gerçek verileri değiştirmez.
      </p>
      <div className="mt-4">
        <div className="mb-2 flex justify-between text-sm">
          <span>Aylık kapasite</span>
          <span className="font-medium text-primary">
            {formatMoney(contrib, "TRY", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={max}
          step={Math.max(1000, Math.round(max / 100))}
          value={contrib}
          onChange={(e) => setContrib(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-foreground/90">
        {result.label}
      </p>
    </GlassCard>
  );
}

const RETURN_MIN = 0;
const RETURN_MAX = 2; // %200

export function ReturnSimulator({
  currentValue,
  targetAmount,
  targetKind,
  targetDate,
  monthlyContribution,
  contributionGrowth,
  expectedReturnAnnual,
}: {
  currentValue: number;
  targetAmount: number;
  targetKind: GoalTargetKind;
  targetDate: string;
  monthlyContribution: number;
  contributionGrowth: ContributionGrowth;
  expectedReturnAnnual: number;
}) {
  const clampRet = (v: number) =>
    Math.min(RETURN_MAX, Math.max(RETURN_MIN, v));

  const [ret, setRet] = useState(() => clampRet(expectedReturnAnnual));
  const [pctInput, setPctInput] = useState(() =>
    String(Math.round(clampRet(expectedReturnAnnual) * 100))
  );

  useEffect(() => {
    const next = clampRet(expectedReturnAnnual);
    setRet(next);
    setPctInput(String(Math.round(next * 100)));
  }, [expectedReturnAnnual]);

  const result = useMemo(
    () =>
      simulateGoalShift(
        {
          currentValue,
          targetAmount,
          targetKind,
          targetDate: new Date(targetDate),
          monthlyContribution,
          contributionGrowth,
          expectedReturnAnnual,
        },
        { expectedReturnAnnual: ret }
      ),
    [
      currentValue,
      targetAmount,
      targetKind,
      targetDate,
      monthlyContribution,
      contributionGrowth,
      expectedReturnAnnual,
      ret,
    ]
  );

  function applyPct(raw: string) {
    setPctInput(raw);
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;
    setRet(clampRet(n / 100));
  }

  return (
    <GlassCard>
      <h3 className="font-display text-lg tracking-tight">Getiri Simülatörü</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Beklenen yıllık getiriyi değiştir — kayıt edilmez. (0–200%)
      </p>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span>Yıllık getiri</span>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">%</span>
            <input
              type="number"
              min={0}
              max={200}
              step={1}
              value={pctInput}
              onChange={(e) => applyPct(e.target.value)}
              onBlur={() =>
                setPctInput(String(Math.round(ret * 100)))
              }
              className="w-16 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-right font-medium text-accent tabular-nums outline-none focus:border-accent/50"
            />
          </div>
        </div>
        <input
          type="range"
          min={RETURN_MIN}
          max={RETURN_MAX}
          step={0.01}
          value={ret}
          onChange={(e) => {
            const next = clampRet(Number(e.target.value));
            setRet(next);
            setPctInput(String(Math.round(next * 100)));
          }}
          className="w-full accent-accent"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>%0</span>
          <span>%100</span>
          <span>%200</span>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed">
        {result.label}
        {result.simDate ? (
          <span className="mt-1 block text-muted-foreground">
            Tahmini tarih:{" "}
            {result.simDate.toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        ) : null}
      </p>
    </GlassCard>
  );
}
