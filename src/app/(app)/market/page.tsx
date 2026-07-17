"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, Minus, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatNumber, formatPercentPlain } from "@/lib/format/tr";
import { DISCLAIMER } from "@/lib/constants/nav";

type OpportunitySignal =
  | "NEAR_2Y_LOW"
  | "NEAR_2Y_HIGH"
  | "MID_RANGE"
  | "INSUFFICIENT_DATA";

interface AssetOpportunity {
  assetId: string;
  symbol: string;
  name: string;
  assetType: string;
  inPortfolio: boolean;
  portfolioWeight: number | null;
  currentPrice: number;
  low2y: number;
  high2y: number;
  rangePosition: number | null;
  drawdownFromHigh: number | null;
  upsideToHigh: number | null;
  return1y: number | null;
  return3m: number | null;
  observationCount: number;
  signal: OpportunitySignal;
  title: string;
  message: string;
  severity: "INFO" | "POSITIVE" | "WARNING";
}

interface MarketAnalysisData {
  asOf: string;
  years: number;
  opportunities: AssetOpportunity[];
  portfolioHighlights: AssetOpportunity[];
  watchlistHighlights: AssetOpportunity[];
  disclaimer: string;
  historySync?: {
    processed: number;
    skipped: number;
    errors: string[];
  } | null;
}

function signalBadge(signal: OpportunitySignal) {
  switch (signal) {
    case "NEAR_2Y_LOW":
      return <Badge variant="positive">2y dip bölgesi</Badge>;
    case "NEAR_2Y_HIGH":
      return <Badge variant="warning">2y zirve bölgesi</Badge>;
    case "INSUFFICIENT_DATA":
      return <Badge variant="secondary">Yetersiz veri</Badge>;
    default:
      return <Badge variant="outline">Orta bant</Badge>;
  }
}

function RangeBar({ position }: { position: number | null }) {
  if (position == null) {
    return <div className="h-2 rounded-full bg-muted" />;
  }
  const pct = Math.min(100, Math.max(0, position * 100));
  return (
    <div className="relative h-2 rounded-full bg-muted">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent/40"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

function OpportunityRow({ o }: { o: AssetOpportunity }) {
  return (
    <div className="space-y-2 border-b border-border/60 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{o.symbol}</span>
            {signalBadge(o.signal)}
            {o.inPortfolio && (
              <Badge variant="outline" className="text-[10px]">
                Portföy
                {o.portfolioWeight != null
                  ? ` · ${formatPercentPlain(o.portfolioWeight, 1)}`
                  : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{o.name}</p>
        </div>
        <div className="text-right text-sm tabular-nums">
          <div>{formatNumber(o.currentPrice, 2)}</div>
          <div className="text-xs text-muted-foreground">
            {o.observationCount} gün
          </div>
        </div>
      </div>

      <RangeBar position={o.rangePosition} />
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>2y dip {formatNumber(o.low2y, 2)}</span>
        <span>
          Bant{" "}
          {o.rangePosition == null
            ? "—"
            : `%${(o.rangePosition * 100).toFixed(0)}`}
        </span>
        <span>2y zirve {formatNumber(o.high2y, 2)}</span>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{o.message}</p>

      <div className="flex flex-wrap gap-3 text-xs tabular-nums text-muted-foreground">
        <span>
          3A:{" "}
          {o.return3m == null ? "—" : formatPercentPlain(o.return3m, 1)}
        </span>
        <span>
          1Y:{" "}
          {o.return1y == null ? "—" : formatPercentPlain(o.return1y, 1)}
        </span>
        <span>
          Zirveden:{" "}
          {o.drawdownFromHigh == null
            ? "—"
            : formatPercentPlain(o.drawdownFromHigh, 1)}
        </span>
      </div>
    </div>
  );
}

export default function MarketPage() {
  const [data, setData] = useState<MarketAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const q = refresh ? "?refresh=1" : "";
      const res = await clientFetch<MarketAnalysisData>(
        `/api/market-analysis${q}`
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
        <h1 className="font-display text-2xl">Piyasa Bağlamı</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Piyasa Bağlamı</h1>
        <ErrorState message={error ?? "Veri yok"} onRetry={() => void load()} />
      </div>
    );
  }

  const lows = data.opportunities.filter((o) => o.signal === "NEAR_2Y_LOW");
  const highs = data.opportunities.filter((o) => o.signal === "NEAR_2Y_HIGH");
  const insufficient = data.opportunities.filter(
    (o) => o.signal === "INSUFFICIENT_DATA"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Piyasa Bağlamı</h1>
          <p className="text-sm text-muted-foreground">
            Son {data.years} yıllık fiyat bandı · {data.asOf} · kişiye özel
            (portföy + izleme)
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
          Geçmişi doldur & yenile
        </Button>
      </div>

      {data.historySync && (
        <p className="text-xs text-muted-foreground">
          Geçmiş senkron: {data.historySync.processed} işlendi,{" "}
          {data.historySync.skipped} atlandı
          {data.historySync.errors.length
            ? ` · ${data.historySync.errors.length} hata`
            : ""}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Dip bölgesi
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{lows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ArrowUpToLine className="h-3.5 w-3.5" />
              Zirve bölgesi
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{highs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Minus className="h-3.5 w-3.5" />
              Yetersiz seri
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {insufficient.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Portföyünüz</CardTitle>
            <CardDescription>
              Elinizdeki varlıkların 2 yıllık banda göre göreli konumu
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.portfolioHighlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Açık pozisyon yok veya henüz fiyat serisi yok.
              </p>
            ) : (
              data.portfolioHighlights.map((o) => (
                <OpportunityRow key={o.assetId} o={o} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>İzleme listesi</CardTitle>
            <CardDescription>
              Altın, döviz ve örnek hisseler — portföy dışı bağlam
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.watchlistHighlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">İzleme varlığı yok.</p>
            ) : (
              data.watchlistHighlights.map((o) => (
                <OpportunityRow key={o.assetId} o={o} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {data.disclaimer} {DISCLAIMER}
      </p>
    </div>
  );
}
