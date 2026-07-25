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
    realReturnIsEstimated?: boolean;
    latestInflationRate: number | null;
    latestMonthlyInflation: number | null;
    latestPeriod: string | null;
    month: {
      startDate: string;
      endDate: string;
      startValue: number | null;
      endValue: number | null;
      nominalPnl: number | null;
      nominalReturn: number | null;
    };
    hurdles: {
      inflation: {
        period: string | null;
        rate: number | null;
        annualRate?: number | null;
      };
      usd: { rate: number | null; start: number | null; end: number | null };
      deposit: { annualRate: number; monthlyRate: number };
    };
    adjusted: {
      vsInflation: number | null;
      vsUsd: number | null;
      vsDeposit: number | null;
    };
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

  const { month, hurdles, adjusted } = data.summary;
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
            Bu ayki portföy kârı; enflasyon, dolar ve vadeli mevduata göre
            {month.startDate && month.endDate
              ? ` · ${month.startDate} → ${month.endDate}`
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ana para</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {month.startValue != null ? formatMoney(month.startValue) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              Ay başı portföy değeri
              {month.startDate ? ` · ${month.startDate}` : ""}
            </p>
            {month.endValue != null && (
              <p className="tabular-nums">
                Güncel:{" "}
                <span className="font-medium text-foreground">
                  {formatMoney(month.endValue)}
                </span>
                {month.endDate ? ` · ${month.endDate}` : ""}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bu ay nominal getiri</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {month.nominalPnl != null ? (
                <PnlValue value={month.nominalPnl} type="money" />
              ) : (
                "—"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {month.nominalReturn != null ? (
              <>
                Oran:{" "}
                <PnlValue value={month.nominalReturn * 100} type="percent" />
              </>
            ) : (
              "Bu ay için yeterli snapshot yok"
            )}
            <span className="mt-1 block text-xs">
              Formül: ayarlanmış kâr = nominal × (1 − aylık hurdle)
            </span>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-muted/30">
        <CardContent className="space-y-1 py-4 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Aylık TÜFE</span> =
            bir ayın fiyat artışı
            {data.summary.latestPeriod && data.summary.latestMonthlyInflation != null
              ? ` (${data.summary.latestPeriod}: ${formatPercentPlain(data.summary.latestMonthlyInflation * 100, 2, false)})`
              : ""}
            . Bu, aylık kâr hurdle’ıdır —{" "}
            <span className="font-medium text-foreground">yıllık × 1/12 değil</span>.
          </p>
          <p>
            <span className="font-medium text-foreground">Yıllık TÜFE (YoY)</span> =
            son 12 ayın kümülatifi
            {data.summary.latestInflationRate != null
              ? ` (${formatPercentPlain(data.summary.latestInflationRate * 100, 1, false)})`
              : ""}
            . Aylık %0,99 × 12 ≈ %12 olsa da gerçek yıllık, önceki yüksek aylar
            yüzünden daha yüksektir.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <HurdleCard
          title="Enflasyona göre"
          subtitle={
            hurdles.inflation.period && hurdles.inflation.rate != null
              ? `Aylık TÜFE ${hurdles.inflation.period} · ${formatPercentPlain(hurdles.inflation.rate * 100, 2, false)}${
                  hurdles.inflation.annualRate != null
                    ? ` · yıllık YoY ${formatPercentPlain(hurdles.inflation.annualRate * 100, 1, false)}`
                    : ""
                }`
              : "TÜFE oranı yok"
          }
          adjusted={adjusted.vsInflation}
          hurdleRate={hurdles.inflation.rate}
        />
        <HurdleCard
          title="Dolara göre"
          subtitle={
            hurdles.usd.rate != null
              ? `USD/TRY bu ay · ${formatPercentPlain(hurdles.usd.rate * 100, 2, false)}`
              : "USD/TRY verisi yok"
          }
          adjusted={adjusted.vsUsd}
          hurdleRate={hurdles.usd.rate}
        />
        <HurdleCard
          title="Vadeli mevduata göre"
          subtitle={`Yıllık ${formatPercentPlain(hurdles.deposit.annualRate * 100, 1, false)} → aylık ${formatPercentPlain(hurdles.deposit.monthlyRate * 100, 2, false)}`}
          adjusted={adjusted.vsDeposit}
          hurdleRate={hurdles.deposit.monthlyRate}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Kümülatif Nominal"
          value={
            data.summary.nominalReturn != null ? (
              <PnlValue value={data.summary.nominalReturn * 100} type="percent" />
            ) : (
              "—"
            )
          }
        />
        <MetricCard
          title="Kümülatif Reel (TÜFE)"
          value={
            data.summary.realReturn != null ? (
              <PnlValue value={data.summary.realReturn * 100} type="percent" />
            ) : (
              "—"
            )
          }
          hint={
            data.summary.realReturnIsEstimated
              ? "Son TÜFE ayından sonraki günler prorata tahmin"
              : undefined
          }
        />
        <MetricCard
          title="Yıllık TÜFE (YoY)"
          value={
            data.summary.latestInflationRate != null
              ? formatPercentPlain(data.summary.latestInflationRate * 100, 1, false)
              : "—"
          }
          hint="Son 12 ay — aylık × 12 değil"
        />
        <MetricCard
          title="Aylık TÜFE"
          value={
            data.summary.latestMonthlyInflation != null
              ? formatPercentPlain(
                  data.summary.latestMonthlyInflation * 100,
                  2,
                  false
                )
              : "—"
          }
          hint={
            data.summary.latestPeriod
              ? `${data.summary.latestPeriod} resmi aylık değişim`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nominal vs Reel Getiri</CardTitle>
            <CardDescription>Kümülatif yüzde karşılaştırma</CardDescription>
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
                    <th className="pb-2 pr-2 font-medium text-right">Aylık</th>
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
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {row.monthlyRate != null
                          ? formatPercentPlain(row.monthlyRate * 100, 2, false)
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

function HurdleCard({
  title,
  subtitle,
  adjusted,
  hurdleRate,
}: {
  title: string;
  subtitle: string;
  adjusted: number | null;
  hurdleRate: number | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl tabular-nums">
          {adjusted != null ? (
            <PnlValue value={adjusted} type="money" />
          ) : (
            "—"
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>{subtitle}</p>
        {hurdleRate != null && (
          <p className="text-xs">
            Hurdle: {formatPercentPlain(hurdleRate * 100, 2, false)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
