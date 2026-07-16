"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Scale } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PnlValue } from "@/components/shared/pnl-value";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatMoney, formatPercentPlain } from "@/lib/format/tr";

interface RealReturnData {
  summary: {
    nominalReturn: number | null;
    realReturn: number | null;
    inflationAdjustedCapital: number | null;
    latestInflationRate: number | null;
  };
  series: {
    date: string;
    nominalReturn: number | null;
    realReturn: number | null;
  }[];
  inflationAvailable: boolean;
}

export default function RealReturnPage() {
  const [data, setData] = useState<RealReturnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientFetch<RealReturnData>("/api/real-return")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Hata"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Reel Getiri</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Reel Getiri</h1>
        <ErrorState message={error ?? "Veri yok"} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const chartData = data.series.map((s) => ({
    date: s.date,
    nominal: s.nominalReturn != null ? s.nominalReturn * 100 : null,
    real: s.realReturn != null ? s.realReturn * 100 : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Reel Getiri</h1>
        <p className="text-sm text-muted-foreground">
          Enflasyon düzeltmeli portföy performansı (TÜFE)
        </p>
      </div>

      {!data.inflationAvailable && (
        <Card className="border-warning/40 bg-warning-muted">
          <CardContent className="py-4 text-sm">
            Enflasyon verisi henüz senkronize edilmedi. Nominal getiri gösteriliyor.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Nominal Getiri"
          value={
            data.summary.nominalReturn != null ? (
              <PnlValue value={data.summary.nominalReturn * 100} type="percent" />
            ) : (
              "—"
            )
          }
        />
        <MetricCard
          title="Reel Getiri"
          value={
            data.summary.realReturn != null ? (
              <PnlValue value={data.summary.realReturn * 100} type="percent" />
            ) : (
              "—"
            )
          }
        />
        <MetricCard
          title="Enflasyon Düzeltmeli Sermaye"
          value={
            data.summary.inflationAdjustedCapital != null
              ? formatMoney(data.summary.inflationAdjustedCapital)
              : "—"
          }
        />
        <MetricCard
          title="Son Yıllık Enflasyon"
          value={
            data.summary.latestInflationRate != null
              ? formatPercentPlain(data.summary.latestInflationRate * 100, 1, false)
              : "—"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nominal vs Reel Getiri</CardTitle>
          <CardDescription>Yüzde bazında karşılaştırma</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              <Scale className="mr-2 h-4 w-4" />
              Yeterli veri yok
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={48} />
                <Tooltip
                  formatter={(v, name) => [
                    `${Number(v).toFixed(2)}%`,
                    name === "nominal" ? "Nominal" : "Reel",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="nominal"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="real"
                  stroke="var(--chart-3)"
                  fill="var(--chart-3)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
