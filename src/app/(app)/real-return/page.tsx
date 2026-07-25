"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import { cn } from "@/lib/utils/cn";

type PeriodKey = "month" | "year" | "total";

interface PeriodBlock {
  key: PeriodKey;
  label: string;
  startDate: string;
  endDate: string;
  startValue: number | null;
  endValue: number | null;
  nominalPnl: number | null;
  nominalReturn: number | null;
  hurdles: {
    inflation: { rate: number | null; label: string };
    usd: { rate: number | null; label: string };
    deposit: { rate: number | null; label: string };
  };
  adjusted: {
    vsInflation: number | null;
    vsUsd: number | null;
    vsDeposit: number | null;
  };
}

interface RealReturnData {
  summary: {
    nominalReturn: number | null;
    investedCapital: number | null;
    currentValue: number | null;
    realReturn: number | null;
    inflationAdjustedCapital: number | null;
    realReturnIsEstimated?: boolean;
    latestInflationRate: number | null;
    latestMonthlyInflation: number | null;
    latestPeriod: string | null;
    periods: Record<PeriodKey, PeriodBlock>;
  };
  series: {
    date: string;
    nominalReturn: number | null;
    realReturn: number | null;
    nominalPnl?: number | null;
    realPnl?: number | null;
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

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "Aylık Reel Getiri" },
  { key: "year", label: "Yıllık Reel Getiri" },
  { key: "total", label: "Toplam Reel Getiri" },
];

export default function RealReturnPage() {
  const [data, setData] = useState<RealReturnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("month");

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

  const active = data.summary.periods?.[period];
  const chartData = data.series
    .filter((s) => {
      if (!active) return true;
      return s.date >= active.startDate && s.date <= active.endDate;
    })
    .filter((s) => s.nominalReturn != null || s.realReturn != null)
    .map((s) => ({
      date: s.date,
      label: formatChartDate(s.date),
      nominal: s.nominalReturn != null ? s.nominalReturn * 100 : null,
      real: s.realReturn != null ? s.realReturn * 100 : null,
      gap:
        s.nominalReturn != null && s.realReturn != null
          ? (s.nominalReturn - s.realReturn) * 100
          : null,
    }));
  const latestChart = chartData.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Reel Getiri</h1>
          <p className="text-sm text-muted-foreground">
            Getiri; enflasyon, dolar ve vadeli mevduata göre
            {active
              ? ` · ${active.startDate} → ${active.endDate}`
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

      <div className="flex flex-wrap gap-2">
        {PERIOD_TABS.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            size="sm"
            variant={period === tab.key ? "default" : "outline"}
            className={cn(period === tab.key && "shadow-sm")}
            onClick={() => setPeriod(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ana para</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.summary.investedCapital != null
                ? formatMoney(data.summary.investedCapital)
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Yatırılan para (net katkı — getiri dahil değil)</p>
            {data.summary.currentValue != null && (
              <p className="tabular-nums">
                Güncel portföy:{" "}
                <span className="font-medium text-foreground">
                  {formatMoney(data.summary.currentValue)}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {active?.label ?? "Dönem"} toplam getiri
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {active?.nominalPnl != null ? (
                <PnlValue value={active.nominalPnl} type="money" />
              ) : (
                "—"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {active?.nominalReturn != null ? (
              <>
                Oran:{" "}
                <PnlValue value={active.nominalReturn * 100} type="percent" />
              </>
            ) : (
              "Bu dönem için yeterli snapshot yok"
            )}
            <span className="mt-1 block text-xs">
              {period === "month"
                ? "Ay içi değişim (ilk gün → bugün); toplam ana paraya göre"
                : "Nominal kâr (dış katkı hariç)"}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Formül</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Reel getiri = toplam getiri × (1 − hurdle)
            </p>
            <p className="mt-2 text-xs">
              Üç hurdle: TÜFE, USD/TRY, vadeli mevduat. Seçilen döneme göre oran
              değişir (aylık / yıllık YoY / dönem başı→son).
            </p>
          </CardContent>
        </Card>
      </div>

      {active && (
        <>
          <div>
            <h2 className="mb-3 font-display text-lg tracking-tight">
              {active.label} reel getiri (3 faktör)
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <HurdleCard
                title="Enflasyona göre"
                subtitle={
                  active.hurdles.inflation.rate != null
                    ? `${active.hurdles.inflation.label} · ${formatPercentPlain(active.hurdles.inflation.rate * 100, 2, false)}`
                    : active.hurdles.inflation.label
                }
                adjusted={active.adjusted.vsInflation}
                hurdleRate={active.hurdles.inflation.rate}
              />
              <HurdleCard
                title="Dolara göre"
                subtitle={
                  active.hurdles.usd.rate != null
                    ? `${active.hurdles.usd.label} · ${formatPercentPlain(active.hurdles.usd.rate * 100, 2, false)}`
                    : active.hurdles.usd.label
                }
                adjusted={active.adjusted.vsUsd}
                hurdleRate={active.hurdles.usd.rate}
              />
              <HurdleCard
                title="Vadeli mevduata göre"
                subtitle={
                  active.hurdles.deposit.rate != null
                    ? `${active.hurdles.deposit.label} · ${formatPercentPlain(active.hurdles.deposit.rate * 100, 2, false)}`
                    : active.hurdles.deposit.label
                }
                adjusted={active.adjusted.vsDeposit}
                hurdleRate={active.hurdles.deposit.rate}
              />
            </div>
          </div>
        </>
      )}

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
            <CardDescription>
              {active?.label ?? "Dönem"} · kümülatif % (TÜFE düzeltmeli reel)
              {latestChart?.gap != null
                ? ` · fark ${formatPercentPlain(latestChart.gap, 2, false)}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length < 2 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                <Scale className="mr-2 h-4 w-4" />
                Grafik için bu dönemde en az 2 snapshot gerekir
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={36}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v) =>
                      formatPercentPlain(Number(v), 1, false)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: 12,
                    }}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | { date?: string }
                        | undefined;
                      return row?.date ?? "";
                    }}
                    formatter={(value, name) => {
                      const n = Number(value);
                      const label =
                        name === "nominal"
                          ? "Nominal"
                          : name === "real"
                            ? "Reel (TÜFE)"
                            : "Fark";
                      return [formatPercentPlain(n, 2, false), label];
                    }}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "nominal"
                        ? "Nominal"
                        : value === "real"
                          ? "Reel (TÜFE)"
                          : value
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="nominal"
                    name="nominal"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="real"
                    name="real"
                    stroke="var(--chart-2)"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enflasyon Düzeltmeli Sermaye</CardTitle>
            <CardDescription>TÜFE ile güncellenmiş katkı</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-2xl font-semibold tabular-nums">
              {data.summary.inflationAdjustedCapital != null
                ? formatMoney(data.summary.inflationAdjustedCapital)
                : "—"}
            </p>
            {latestChart && (
              <div className="space-y-2 border-t border-border pt-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Nominal</span>
                  <span className="tabular-nums font-medium">
                    {latestChart.nominal != null
                      ? formatPercentPlain(latestChart.nominal, 2, false)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Reel (TÜFE)</span>
                  <span className="tabular-nums font-medium">
                    {latestChart.real != null
                      ? formatPercentPlain(latestChart.real, 2, false)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Enflasyon farkı</span>
                  <span className="tabular-nums font-medium text-negative">
                    {latestChart.gap != null
                      ? formatPercentPlain(-Math.abs(latestChart.gap), 2, false)
                      : "—"}
                  </span>
                </div>
              </div>
            )}
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

function formatChartDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}`;
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
