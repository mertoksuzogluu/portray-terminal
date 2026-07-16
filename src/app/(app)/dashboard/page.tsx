import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bell } from "lucide-react";
import { Suspense } from "react";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { PortfolioValueChart } from "@/components/charts/portfolio-value-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PnlValue } from "@/components/shared/pnl-value";
import { ApiError, serverFetch } from "@/lib/api/server-fetch";
import { formatDateTR, formatMoney, formatPercentPlain } from "@/lib/format/tr";
import { DISCLAIMER } from "@/lib/constants/nav";

interface DashboardData {
  summary: {
    totalValue: number;
    cashValue: number;
    dailyPnl: number;
    dailyReturn: number | null;
    cumulativeReturn: number | null;
    investedCapital: number;
    snapshotDate: string | null;
    currency: string;
  };
  chartData: { date: string; value: number }[];
  allocation: { name: string; value: number; weight: number }[];
  insights: { id: string; title: string; message: string; severity: string; date: string }[];
  alerts: { id: string; message: string; triggeredAt: string; ruleName: string; isRead: boolean }[];
  winners: { assetId: string; symbol: string; name: string; pnl: number; returnPct: number | null }[];
  losers: { assetId: string; symbol: string; name: string; pnl: number; returnPct: number | null }[];
}

async function DashboardContent() {
  let data: DashboardData;
  try {
    data = await serverFetch<DashboardData>("/api/dashboard");
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Veri yüklenemedi.";
    return (
      <div className="rounded-lg border border-negative/30 bg-negative-muted p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-negative" />
        <p className="font-display text-lg">Portföy özeti yüklenemedi</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  const { summary } = data;
  const isEmpty = summary.totalValue === 0 && data.allocation.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Portföy Özeti</h1>
        <p className="text-sm text-muted-foreground">
          {summary.snapshotDate
            ? `Son güncelleme: ${formatDateTR(summary.snapshotDate)}`
            : "Henüz anlık görüntü yok"}
        </p>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-display text-lg">Portföyünüz boş</p>
            <p className="mt-2 text-sm text-muted-foreground">
              İşlem ekleyerek veya demo hesapla giriş yaparak başlayın.
            </p>
            <Link
              href="/transactions"
              className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              İşlem ekle →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Toplam Değer" value={formatMoney(summary.totalValue, summary.currency)} />
            <KpiCard
              title="Günlük K/Z"
              value={<PnlValue value={summary.dailyPnl} currency={summary.currency} />}
            />
            <KpiCard
              title="Günlük Getiri"
              value={
                summary.dailyReturn != null ? (
                  <PnlValue value={summary.dailyReturn * 100} type="percent" />
                ) : (
                  "—"
                )
              }
            />
            <KpiCard
              title="Kümülatif Getiri"
              value={
                summary.cumulativeReturn != null ? (
                  <PnlValue value={summary.cumulativeReturn * 100} type="percent" />
                ) : (
                  "—"
                )
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Portföy Değeri</CardTitle>
                <CardDescription>Son 12 ay performans eğrisi</CardDescription>
              </CardHeader>
              <CardContent>
                <PortfolioValueChart data={data.chartData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Varlık Dağılımı</CardTitle>
                <CardDescription>Piyasa değerine göre ağırlık</CardDescription>
              </CardHeader>
              <CardContent>
                <AllocationChart data={data.allocation} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-positive" />
                  Günün Kazananları
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.winners.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bugün pozitif hareket yok</p>
                ) : (
                  data.winners.map((w) => (
                    <div key={w.symbol} className="flex items-center justify-between">
                      <Link href={`/portfolio/${w.assetId}`} className="hover:underline">
                        <span className="font-medium">{w.symbol}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{w.name}</span>
                      </Link>
                      <PnlValue value={w.pnl} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-negative" />
                  Günün Kaybedenleri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.losers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bugün negatif hareket yok</p>
                ) : (
                  data.losers.map((l) => (
                    <div key={l.symbol} className="flex items-center justify-between">
                      <span className="font-medium">{l.symbol}</span>
                      <PnlValue value={l.pnl} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Son Uyarılar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aktif uyarı yok</p>
                ) : (
                  data.alerts.map((a) => (
                    <div key={a.id} className="border-b border-border pb-2 last:border-0">
                      <p className="text-sm">{a.message}</p>
                      <p className="text-xs text-muted-foreground">{a.ruleName}</p>
                    </div>
                  ))
                )}
                <Link href="/alerts" className="text-xs text-primary hover:underline">
                  Tüm uyarılar →
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Analiz Öngörüleri</CardTitle>
              <CardDescription>Otomatik üretilen portföy içgörüleri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.insights.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz içgörü üretilmedi</p>
              ) : (
                data.insights.map((i) => (
                  <div key={i.id} className="rounded-md border border-border bg-muted/30 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={severityVariant(i.severity)}>{i.severity}</Badge>
                      <span className="text-xs text-muted-foreground">{i.date}</span>
                    </div>
                    <p className="font-medium">{i.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{i.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-center text-[11px] text-muted-foreground lg:hidden">{DISCLAIMER}</p>
    </div>
  );
}

function KpiCard({
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

function severityVariant(severity: string) {
  switch (severity) {
    case "POSITIVE":
      return "positive" as const;
    case "WARNING":
    case "CRITICAL":
      return "warning" as const;
    default:
      return "muted" as const;
  }
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
