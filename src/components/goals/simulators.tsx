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
  const [ret, setRet] = useState(expectedReturnAnnual);

  useEffect(() => {
    setRet(expectedReturnAnnual);
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

  return (
    <GlassCard>
      <h3 className="font-display text-lg tracking-tight">Getiri Simülatörü</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Beklenen yıllık getiriyi değiştir — kayıt edilmez.
      </p>
      <div className="mt-4">
        <div className="mb-2 flex justify-between text-sm">
          <span>Yıllık getiri</span>
          <span className="font-medium text-accent">
            %{(ret * 100).toFixed(0)}
          </span>
        </div>
        <input
          type="range"
          min={0.05}
          max={0.4}
          step={0.01}
          value={ret}
          onChange={(e) => setRet(Number(e.target.value))}
          className="w-full accent-accent"
        />
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
