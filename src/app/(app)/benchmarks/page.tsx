"use client";

import { useEffect, useState } from "react";
import { GitCompare } from "lucide-react";
import { BenchmarkChart } from "@/components/charts/benchmark-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PnlValue } from "@/components/shared/pnl-value";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatPercentPlain } from "@/lib/format/tr";

interface BenchmarkItem {
  id: string;
  name: string;
  symbol: string;
  type: string;
  currency: string;
  series: { date: string; portfolio: number; benchmark: number }[];
  outperformance: number;
  dataPoints: number;
  thinPortfolioHistory?: boolean;
}

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    clientFetch<{ benchmarks: BenchmarkItem[] }>("/api/benchmarks")
      .then((res) => {
        setBenchmarks(res.benchmarks);
        if (res.benchmarks[0]) setActive(res.benchmarks[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Hata"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Karşılaştırma</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Karşılaştırma</h1>
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (benchmarks.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Karşılaştırma</h1>
        <EmptyState
          icon={GitCompare}
          title="Endeks verisi yok"
          description="Karşılaştırma için benchmark fiyatları henüz yüklenmemiş."
        />
      </div>
    );
  }

  const current = benchmarks.find((b) => b.id === active) ?? benchmarks[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Karşılaştırma</h1>
        <p className="text-sm text-muted-foreground">Portföy vs endeks performansı</p>
      </div>

      {benchmarks.some((b) => b.thinPortfolioHistory) && (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Portföy geçmişiniz kısa (birkaç gün). Grafik endeks serisini gösterir; daha anlamlı
          karşılaştırma için işlemlerinizi ve fiyat yenilemeyi sürdürün.
        </p>
      )}

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="flex-wrap">
          {benchmarks.map((b) => (
            <TabsTrigger key={b.id} value={b.id}>
              {b.symbol}
            </TabsTrigger>
          ))}
        </TabsList>

        {benchmarks.map((b) => (
          <TabsContent key={b.id} value={b.id}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{b.name}</CardTitle>
                  <Badge variant="outline">{b.type}</Badge>
                  <Badge variant="muted">{b.currency}</Badge>
                </div>
                <CardDescription>
                  {b.dataPoints} veri noktası · Fark:{" "}
                  <PnlValue value={b.outperformance} type="percent" showIcon={false} />
                </CardDescription>
              </CardHeader>
              <CardContent>
                {b.series.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ortak tarih aralığı bulunamadı</p>
                ) : (
                  <BenchmarkChart data={b.series} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {current && (
        <p className="text-xs text-muted-foreground">
          Endeksler 100 bazında normalize edilmiştir. {formatPercentPlain(current.outperformance, 2, false)} fark
          portföy lehine/aleyhine gösterir.
        </p>
      )}
    </div>
  );
}
