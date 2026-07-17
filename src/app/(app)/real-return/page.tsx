"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw, Scale } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    latestMonthlyInflation: number | null;
    latestPeriod: string | null;
  };
  series: {
    date: string;
    nominalReturn: number | null;
    realReturn: number | null;
  }[];
  inflation: {
    period: string;
    indexValue: number;
    monthlyRate: number | null;
    annualRate: number | null;
    source: string;
  }[];
  inflationAvailable: boolean;
}

export default function RealReturnPage() {
  const [data, setData] = useState<RealReturnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clientFetch<RealReturnData>("/api/real-return");
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSyncInflation() {
    setSyncing(true);
    try {
      const res = await clientFetch<{ count: number; source: string }>(
        "/api/inflation",
        { method: "POST" }
      );
      toast.success(
        `${res.count} dönem güncellendi (${res.source === "tufe_official" ? "resmi TÜFE" : "TCMB EVDS"})`
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Senkron başarısız");
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !data) {
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
        <ErrorState message={error ?? "Veri yok"} onRetry={() => void load()} />
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Reel Getiri</h1>
          <p className="text-sm text-muted-foreground">
            Enflasyon düzeltmeli portföy performansı (TÜFE)
            {data.summary.latestPeriod
              ? ` · Son dönem: ${data.summary.latestPeriod}`
              : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={syncing}
          onClick={() => void handleSyncInflation()}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Güncelleniyor…" : "Enflasyonu Güncelle"}
        </Button>
      </div>

      {!data.inflationAvailable && (
        <Card className="border-warning/40 bg-warning-muted">
          <CardContent className="py-4 text-sm">
            Enflasyon verisi henüz yok. Yukarıdaki butona basarak TÜFE serisini
            yükleyin.
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
          title="Son Yıllık Enflasyon"
          value={
            data.summary.latestInflationRate != null
              ? formatPercentPlain(data.summary.latestInflationRate * 100, 1, false)
              : "—"
          }
        />
        <MetricCard
          title="Aylık Enflasyon Maliyeti"
          value={
            data.summary.latestMonthlyInflation != null ? (
              <PnlValue
                value={-Math.abs(data.summary.latestMonthlyInflation) * 100}
                type="percent"
              />
            ) : (
              "—"
            )
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
                    fillOpacity={0.15}
                    name="nominal"
                  />
                  <Area
                    type="monotone"
                    dataKey="real"
                    stroke="var(--chart-2)"
                    fill="var(--chart-2)"
                    fillOpacity={0.12}
                    name="real"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enflasyon Düzeltmeli Sermaye</CardTitle>
            <CardDescription>TÜFE ile güncellenmiş katkı</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data.summary.inflationAdjustedCapital != null
                ? formatMoney(data.summary.inflationAdjustedCapital)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>TÜFE Serisi</CardTitle>
          <CardDescription>
            Son dönemler · kaynak: TCMB/TÜİK (2025=100)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.inflation.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz enflasyon kaydı yok</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Dönem</th>
                    <th className="pb-2 pr-2 font-medium text-right">Endeks</th>
                    <th className="pb-2 pr-2 font-medium text-right">
                      Aylık maliyet
                    </th>
                    <th className="pb-2 font-medium text-right">Yıllık</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inflation.map((row) => (
                    <tr
                      key={row.period}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2 pr-2 font-medium">{row.period}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {row.indexValue.toLocaleString("tr-TR", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-negative">
                        {row.monthlyRate != null
                          ? formatPercentPlain(
                              -Math.abs(row.monthlyRate) * 100,
                              2,
                              false
                            )
                          : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {row.annualRate != null
                          ? formatPercentPlain(row.annualRate * 100, 1, false)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: React.ReactNode;
}) {
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
