"use client";

import { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatDateTR, formatMoney } from "@/lib/format/tr";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { GoalWizard } from "@/components/goals/goal-wizard";
import { GoalSelector } from "@/components/goals/goal-selector";
import { ProgressCircle } from "@/components/goals/progress-circle";
import { ForecastCards } from "@/components/goals/forecast-cards";
import { WhatIfSimulator, ReturnSimulator } from "@/components/goals/simulators";
import { Milestones, Achievements } from "@/components/goals/milestones";
import { GoalTimeline } from "@/components/goals/goal-timeline";
import { FinancialFreedomPanel } from "@/components/goals/financial-freedom";
import { GoalSummaryCard } from "@/components/goals/goal-summary-card";
import {
  AiGoalCoach,
  AiRecommendations,
  GoalProgressYtd,
} from "@/components/goals/ai-panels";
import { GlassCard } from "@/components/goals/glass";
import { cn } from "@/lib/utils/cn";
import type {
  ContributionGrowth,
  GoalTargetKind,
} from "@/lib/goals/types";

interface GoalRow {
  id: string;
  title: string;
  type: string;
  targetAmount: number;
  targetKind: GoalTargetKind;
  targetDate: string;
  monthlyContribution: number;
  contributionGrowth: ContributionGrowth;
  expectedReturnAnnual: number;
  isPrimary: boolean;
}

interface DashboardPayload {
  goals: GoalRow[];
  activeGoal: GoalRow | null;
  dashboard: {
    currentValue: number;
    snapshotDate: string | null;
    growth90dPct: number | null;
    projection: {
      progressPct: number;
      remaining: number;
      effectiveTarget: number;
      plannedDate: string;
      estimatedDate: string | null;
      aheadBehind: {
        months: number;
        label: string;
        status: "ahead" | "behind" | "on_track";
      };
      forecasts: {
        id: string;
        label: string;
        emoji: string;
        year: number | null;
        returnAnnual: number;
      }[];
      ytd: { planned: number; actual: number; comment: string };
      todayDelta: number;
      todayProgressPct: number;
      milestones: { amount: number; label: string; reached: boolean }[];
      financialFreedom: {
        score: number;
        estimatedYears: number | null;
        monthlyPassiveProxy: number;
        monthlyLivingCost: number | null;
        targetPassiveIncome: number | null;
      };
    };
    achievements: {
      code: string;
      label: string;
      unlocked: boolean;
      unlockedAt: string | null;
    }[];
    coach: {
      headlines: string[];
      recommendations: string[];
      ytdComment: string;
      source: string;
    };
  } | null;
}

export default function GoalsPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(async (goalId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const q = goalId ? `?goalId=${encodeURIComponent(goalId)}` : "";
      const res = await clientFetch<DashboardPayload>(
        `/api/goals/dashboard${q}`
      );
      setData(res);
      setActiveId(res.activeGoal?.id ?? null);
      setShowWizard(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorState message={error} onRetry={() => load(activeId)} />
    );
  }

  const goals = data?.goals ?? [];
  const dash = data?.dashboard;
  const active = data?.activeGoal;

  if (showWizard || goals.length === 0) {
    if (goals.length === 0 && !showWizard) {
      return (
        <div className="space-y-6">
          <EmptyState
            icon={Target}
            title="Henüz hedef yok"
            description="Finansal hedefini tanımla; portföyünden bağımsız olarak ilerlemeyi ve projeksiyonları takip et."
            actionLabel="Hedef oluştur"
            onAction={() => setShowWizard(true)}
          />
        </div>
      );
    }
    return (
      <div className="goals-surface -mx-4 min-h-[70vh] px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <GoalWizard
          onCreated={() => {
            setShowWizard(false);
            void load();
          }}
        />
        {goals.length > 0 ? (
          <div className="mx-auto mt-4 max-w-2xl text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowWizard(false)}
            >
              İptal
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!dash || !active) {
    return (
      <EmptyState
        icon={Target}
        title="Hedef yüklenemedi"
        description="Tekrar deneyin veya yeni bir hedef oluşturun."
        actionLabel="Yenile"
        onAction={() => load()}
      />
    );
  }

  const p = dash.projection;

  return (
    <div className="goals-surface -mx-4 space-y-6 px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Hedefler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Portföy değeri salt okunur · katkı varsayımları yalnızca simülasyon
          </p>
        </div>
        <GoalSelector
          goals={goals}
          activeId={active.id}
          onSelect={(id) => {
            setActiveId(id);
            void load(id);
          }}
          onNew={() => setShowWizard(true)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <GlassCard className="flex flex-col items-center justify-center py-8">
          <ProgressCircle
            targetAmount={p.effectiveTarget}
            currentValue={dash.currentValue}
            progressPct={p.progressPct}
          />
          <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Kalan tutar</p>
              <p className="font-display text-lg tracking-tight">
                {formatMoney(p.remaining, "TRY", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Portföy (salt okuma)</p>
              <p className="font-display text-lg tracking-tight">
                {formatMoney(dash.currentValue, "TRY", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display text-lg tracking-tight">
            Tahmini ulaşma tarihi
          </h3>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Planlanan</span>
              <span>{formatDateTR(p.plannedDate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tahmini</span>
              <span className="font-medium">
                {p.estimatedDate ? formatDateTR(p.estimatedDate) : "—"}
              </span>
            </div>
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium",
                p.aheadBehind.status === "ahead" &&
                  "bg-positive/15 text-positive",
                p.aheadBehind.status === "behind" &&
                  "bg-negative/15 text-negative",
                p.aheadBehind.status === "on_track" &&
                  "bg-white/5 text-muted-foreground"
              )}
            >
              {p.aheadBehind.label}
            </p>
          </div>
        </GlassCard>
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl tracking-tight">
          Goal Forecast
        </h2>
        <ForecastCards forecasts={p.forecasts} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GoalProgressYtd
          planned={p.ytd.planned}
          actual={p.ytd.actual}
          comment={dash.coach.ytdComment || p.ytd.comment}
        />
        <AiGoalCoach
          headlines={dash.coach.headlines}
          source={dash.coach.source}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WhatIfSimulator
          currentValue={dash.currentValue}
          targetAmount={active.targetAmount}
          targetKind={active.targetKind}
          targetDate={active.targetDate}
          monthlyContribution={active.monthlyContribution}
          contributionGrowth={active.contributionGrowth}
          expectedReturnAnnual={active.expectedReturnAnnual}
        />
        <ReturnSimulator
          currentValue={dash.currentValue}
          targetAmount={active.targetAmount}
          targetKind={active.targetKind}
          targetDate={active.targetDate}
          monthlyContribution={active.monthlyContribution}
          contributionGrowth={active.contributionGrowth}
          expectedReturnAnnual={active.expectedReturnAnnual}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Milestones items={p.milestones} />
        <Achievements items={dash.achievements} />
      </div>

      <GoalTimeline
        progressPct={p.progressPct}
        plannedDate={p.plannedDate}
        estimatedDate={p.estimatedDate}
      />

      <FinancialFreedomPanel
        goalId={active.id}
        score={p.financialFreedom.score}
        estimatedYears={p.financialFreedom.estimatedYears}
        monthlyPassiveProxy={p.financialFreedom.monthlyPassiveProxy}
        monthlyLivingCost={p.financialFreedom.monthlyLivingCost}
        targetPassiveIncome={p.financialFreedom.targetPassiveIncome}
        onSaved={() => load(active.id)}
      />

      <AiRecommendations items={dash.coach.recommendations} />

      <GoalSummaryCard
        targetAmount={p.effectiveTarget}
        progressPct={p.progressPct}
        estimatedDate={p.estimatedDate}
        aheadStatus={p.aheadBehind.status}
        aheadLabel={p.aheadBehind.label}
        todayDelta={p.todayDelta}
        todayProgressPct={p.todayProgressPct}
      />
    </div>
  );
}
