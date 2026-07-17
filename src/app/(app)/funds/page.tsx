"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatPercentPlain } from "@/lib/format/tr";
import { DISCLAIMER } from "@/lib/constants/nav";

interface MonthlyFundAnalysis {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  fundType: string;
  fundCount: number;
  top: {
    rank: number;
    code: string;
    name: string;
    returnPct: number;
    riskLevel: number | null;
    category: string | null;
    founder: string | null;
    inPortfolio: boolean;
  }[];
  stats: {
    topAvgReturn: number;
    marketMedianReturn: number;
    marketAvgReturn: number;
    bestReturn: number;
    worstInTopReturn: number;
  };
  categoryBreakdown: { category: string; count: number; avgReturn: number }[];
  insights: { title: string; message: string; severity: "INFO" | "POSITIVE" | "WARNING" }[];
  portfolioOverlap: { code: string; name: string; returnPct: number }[];
  fetchedAt: string;
  disclaimer: string;
}

export default function FundsPage() {
  const [data, setData] = useState<MonthlyFundAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const q = refresh ? "?refresh=1" : "";
      const res = await clientFetch<MonthlyFundAnalysis>(
        `/api/funds/monthly-leaders${q}`
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri yüklenemedi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Fon Performansı</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Fon Performansı</h1>
        <ErrorState message={error ?? "Veri yok"} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Fon Performansı</h1>
          <p className="text-sm text-muted-foreground">
            {data.periodLabel} · TEFAS yatırım fonları · {data.fundCount} fon
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={refreshing}
          onClick={() => void load(true)}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Yenile
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="En iyi getiri"
          value={formatPercentPlain(data.stats.bestReturn, 2, false)}
        />
        <StatCard
          title="İlk 10 ortalaması"
          value={formatPercentPlain(data.stats.topAvgReturn, 2, false)}
        />
        <StatCard
          title="Piyasa medyanı"
          value={formatPercentPlain(data.stats.marketMedianReturn, 2, false)}
        />
        <StatCard
          title="İlk 10 alt sınır"
          value={formatPercentPlain(data.stats.worstInTopReturn, 2, false)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent" />
              En İyi 10 Fon — {data.periodLabel}
            </CardTitle>
            <CardDescription>
              Takvim ayı getirisi (TEFAS). Portföyünüzdekiler işaretlenir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">#</th>
                    <th className="pb-2 pr-2 font-medium">Kod</th>
                    <th className="pb-2 pr-2 font-medium">Fon</th>
                    <th className="pb-2 pr-2 font-medium">Kategori</th>
                    <th className="pb-2 pr-2 font-medium text-right">Risk</th>
                    <th className="pb-2 font-medium text-right">Getiri</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((f) => (
                    <tr
                      key={f.code}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2.5 pr-2 tabular-nums text-muted-foreground">
                        {f.rank}
                      </td>
                      <td className="py-2.5 pr-2 font-medium">
                        {f.code}
                        {f.inPortfolio && (
                          <Badge variant="positive" className="ml-2 text-[10px]">
                            Portföy
                          </Badge>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate py-2.5 pr-2" title={f.name}>
                        {f.name}
                      </td>
                      <td className="max-w-[140px] truncate py-2.5 pr-2 text-muted-foreground">
                        {f.category ?? "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-muted-foreground">
                        {f.riskLevel != null ? f.riskLevel : "—"}
                      </td>
                      <td className="py-2.5 text-right font-medium tabular-nums text-positive">
                        {formatPercentPlain(f.returnPct, 2, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kategori Dağılımı</CardTitle>
            <CardDescription>İlk 10 içindeki temalar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kategori bilgisi yok</p>
            ) : (
              data.categoryBreakdown.map((c) => (
                <div key={c.category} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.category}</p>
                    <p className="text-xs text-muted-foreground">{c.count} fon</p>
                  </div>
                  <span className="shrink-0 tabular-nums text-sm text-positive">
                    {formatPercentPlain(c.avgReturn, 1, false)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analiz</CardTitle>
          <CardDescription>
            Kural tabanlı özet — yatırım tavsiyesi değildir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.insights.map((i) => (
            <div
              key={i.title}
              className="rounded-md border border-border bg-muted/30 p-3"
            >
              <div className="mb-1 flex items-center gap-2">
                <Badge
                  variant={
                    i.severity === "POSITIVE"
                      ? "positive"
                      : i.severity === "WARNING"
                        ? "warning"
                        : "muted"
                  }
                >
                  {i.severity === "POSITIVE"
                    ? "Olumlu"
                    : i.severity === "WARNING"
                      ? "Dikkat"
                      : "Bilgi"}
                </Badge>
                <span className="font-medium">{i.title}</span>
              </div>
              <p className="text-sm text-muted-foreground">{i.message}</p>
            </div>
          ))}
          <div className="flex items-start gap-2 pt-2 text-[11px] text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              {data.disclaimer} {DISCLAIMER}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
