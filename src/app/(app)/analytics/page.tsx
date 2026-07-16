"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PnlValue } from "@/components/shared/pnl-value";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatPercentPlain } from "@/lib/format/tr";

interface AnalyticsData {
  performance: { cumulativeReturn: number | null; series: { date: string; value: number }[] };
  contribution: {
    total: number;
    assets: { symbol: string; contribution: number; weight: number; dailyReturn: number }[];
  };
  risk: {
    volatility: number | null;
    sharpe: number | null;
    sortino: number | null;
    bestDay: number | null;
    worstDay: number | null;
    positiveDayRatio: number | null;
    maxDrawdown: number | null;
    currentDrawdown: number | null;
    observationCount: number;
    insufficientData: boolean;
  };
  concentration: { hhi: number; topHoldings: { symbol: string; weight: number }[] };
  drawdown: { date: string; drawdown: number }[];
  monthlyHeatmap: { month: string; return: number }[];
  rolling: { date: string; return: number | null }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientFetch<AnalyticsData>("/api/analytics")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Hata"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Analiz</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Analiz</h1>
        <ErrorState message={error ?? "Veri yok"} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Analiz</h1>
        <p className="text-sm text-muted-foreground">
          Performans, risk ve konsantrasyon metrikleri
        </p>
      </div>

      <Tabs defaultValue="performance">
        <TabsList className="flex-wrap">
          <TabsTrigger value="performance">Performans</TabsTrigger>
          <TabsTrigger value="contribution">Katkı</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="concentration">Konsantrasyon</TabsTrigger>
          <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
          <TabsTrigger value="heatmap">Aylık Isı</TabsTrigger>
          <TabsTrigger value="rolling">Rolling</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Normalize Performans</CardTitle>
              <CardDescription>
                Kümülatif:{" "}
                {data.performance.cumulativeReturn != null ? (
                  <PnlValue value={data.performance.cumulativeReturn * 100} type="percent" />
                ) : (
                  "—"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.performance.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contribution">
          <Card>
            <CardHeader>
              <CardTitle>Getiri Katkısı</CardTitle>
            </CardHeader>
            <CardContent>
              {data.contribution.assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Katkı verisi yok</p>
              ) : (
                <div className="space-y-2">
                  {data.contribution.assets.map((a) => (
                    <div key={a.symbol} className="flex items-center justify-between border-b border-border py-2">
                      <span className="font-medium">{a.symbol}</span>
                      <div className="flex gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Ağırlık {formatPercentPlain(a.weight, 1)}
                        </span>
                        <PnlValue value={a.contribution * 100} type="percent" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RiskCard label="Yıllık Volatilite" value={data.risk.volatility} />
            <RiskCard label="Sharpe" value={data.risk.sharpe} plain />
            <RiskCard label="Sortino" value={data.risk.sortino} plain />
            <RiskCard label="Max Drawdown" value={data.risk.maxDrawdown} percent />
            <RiskCard label="Güncel Drawdown" value={data.risk.currentDrawdown} percent />
            <RiskCard label="Pozitif Gün Oranı" value={data.risk.positiveDayRatio} percent />
          </div>
          {data.risk.insufficientData && (
            <p className="mt-4 text-sm text-warning">
              Yetersiz gözlem ({data.risk.observationCount} gün). Daha güvenilir metrikler için daha
              uzun geçmiş gerekir.
            </p>
          )}
        </TabsContent>

        <TabsContent value="concentration">
          <Card>
            <CardHeader>
              <CardTitle>Konsantrasyon (HHI: {data.concentration.hhi.toFixed(4)})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.concentration.topHoldings.map((h) => (
                <div key={h.symbol} className="flex justify-between">
                  <span>{h.symbol}</span>
                  <span>{formatPercentPlain(h.weight, 1)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drawdown">
          <Card>
            <CardHeader>
              <CardTitle>Drawdown Eğrisi</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.drawdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => formatPercentPlain(v, 0)} tick={{ fontSize: 11 }} width={56} />
                  <Tooltip formatter={(v) => formatPercentPlain(Number(v), 2)} />
                  <Area type="monotone" dataKey="drawdown" stroke="var(--negative)" fill="var(--negative)" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap">
          <Card>
            <CardHeader>
              <CardTitle>Aylık Getiri Isı Haritası</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.monthlyHeatmap}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(v) => formatPercentPlain(v, 0)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatPercentPlain(Number(v), 2)} />
                  <Bar dataKey="return">
                    {data.monthlyHeatmap.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.return >= 0 ? "var(--positive)" : "var(--negative)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rolling">
          <Card>
            <CardHeader>
              <CardTitle>30 Günlük Rolling Getiri</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.rolling.filter((r) => r.return != null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatPercentPlain(v, 0)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatPercentPlain(Number(v), 2)} />
                  <Area type="monotone" dataKey="return" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RiskCard({
  label,
  value,
  percent,
  plain,
}: {
  label: string;
  value: number | null;
  percent?: boolean;
  plain?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        {value == null ? (
          <span className="text-muted-foreground">—</span>
        ) : plain ? (
          <span className="text-xl font-semibold tabular-nums">{value.toFixed(2)}</span>
        ) : percent ? (
          <PnlValue value={value * 100} type="percent" />
        ) : (
          <PnlValue value={value * 100} type="percent" />
        )}
      </CardContent>
    </Card>
  );
}
