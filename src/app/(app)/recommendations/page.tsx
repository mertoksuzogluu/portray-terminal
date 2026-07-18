"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { clientFetch } from "@/lib/api/client-fetch";
import { DISCLAIMER } from "@/lib/constants/nav";
import { formatPercentPlain } from "@/lib/format/tr";

interface RecoItem {
  id: string;
  action: string;
  assetClass: string;
  symbol: string | null;
  title: string;
  message: string;
  currentWeight: number;
  targetWeight: number;
  suggestedDelta: number;
  score: number;
  validUntil: string;
}

interface RecoData {
  asOf: string | null;
  riskProfile: string | null;
  riskProfileLabel: string;
  riskScore: number | null;
  riskBand: { target: number; min: number; max: number };
  userRiskProfile: string;
  items: RecoItem[];
  marketNotes: { id: string; title: string; body: string; publishedAt: string; author: string }[];
  inputSummary: {
    classWeights?: Record<string, number>;
    targetWeights?: Record<string, number>;
  } | null;
  disclaimer: string;
}

const ACTION_LABEL: Record<string, string> = {
  INCREASE: "Artır",
  DECREASE: "Azalt",
  HOLD: "Tut",
  SHIFT_CLASS: "Sınıf kaydır",
  PARK_CASH: "Nakiti park et",
};

const CLASS_LABEL: Record<string, string> = {
  EQUITY: "Hisse",
  FUND: "Fon",
  FX: "Döviz",
  GOLD: "Altın",
  CASH: "Nakit",
};

export default function RecommendationsPage() {
  const [data, setData] = useState<RecoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    clientFetch<RecoData>("/api/recommendations")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Hata"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await clientFetch<RecoData>("/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ refresh: true }),
      });
      setData(res);
      toast.success("Öneriler yenilendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yenileme başarısız");
    } finally {
      setRefreshing(false);
    }
  }

  async function updateStatus(id: string, status: "APPLIED" | "DISMISSED") {
    try {
      await clientFetch("/api/recommendations", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      toast.success(status === "APPLIED" ? "Uygulandı olarak işaretlendi" : "Reddedildi");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Öneriler</h1>
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Veri yok"} onRetry={load} />;
  }

  const classWeights = data.inputSummary?.classWeights ?? {};
  const targetWeights = data.inputSummary?.targetWeights ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Risk–Getiri Önerileri</h1>
          <p className="text-sm text-muted-foreground">
            Profil: {data.riskProfileLabel}
            {data.asOf ? ` · Son koşu: ${data.asOf}` : " · Henüz koşu yok"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings"
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-muted"
          >
            Risk profili
          </Link>
          <Button onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Yeniden hesapla
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        {data.disclaimer || DISCLAIMER} Model çıktısıdır; kesin yatırım tavsiyesi değildir.
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Risk skoru</CardDescription>
            <CardTitle className="font-display text-3xl">
              {data.riskScore != null ? data.riskScore.toFixed(0) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Hedef bant: {data.riskBand.min}–{data.riskBand.max} (hedef {data.riskBand.target})
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hedefe uzaklık (sınıf)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Object.keys({ ...targetWeights, ...classWeights }).map((cls) => {
                const cur = classWeights[cls] ?? 0;
                const tgt = targetWeights[cls] ?? 0;
                const gap = cur - tgt;
                return (
                  <div key={cls} className="rounded-md border border-border p-2 text-xs">
                    <p className="font-medium">{CLASS_LABEL[cls] ?? cls}</p>
                    <p className="text-muted-foreground">
                      {formatPercentPlain(cur)} → {formatPercentPlain(tgt)}
                    </p>
                    <p className={gap > 0.01 ? "text-negative" : gap < -0.01 ? "text-positive" : ""}>
                      {gap >= 0 ? "+" : ""}
                      {formatPercentPlain(gap)}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {data.items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Lightbulb className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-display text-lg">Aktif öneri yok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Yeniden hesapla ile motoru çalıştırın veya haftalık cron’u bekleyin.
              </p>
            </CardContent>
          </Card>
        ) : (
          data.items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{ACTION_LABEL[item.action] ?? item.action}</Badge>
                    <Badge variant="outline">{CLASS_LABEL[item.assetClass] ?? item.assetClass}</Badge>
                    {item.symbol && <Badge variant="outline">{item.symbol}</Badge>}
                    <Badge>Skor {item.score.toFixed(0)}</Badge>
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription className="mt-1">{item.message}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Mevcut {formatPercentPlain(item.currentWeight)} · Hedef{" "}
                  {formatPercentPlain(item.targetWeight)} · Delta{" "}
                  {formatPercentPlain(item.suggestedDelta)} · Geçerlilik {item.validUntil}
                </p>
                {item.action !== "HOLD" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "DISMISSED")}>
                      Reddet
                    </Button>
                    <Button size="sm" onClick={() => updateStatus(item.id, "APPLIED")}>
                      Uyguladım
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {data.marketNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ortak piyasa notları</CardTitle>
            <CardDescription>Yakın çevre için yönetici notları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.marketNotes.map((n) => (
              <div key={n.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {n.author} · {new Date(n.publishedAt).toLocaleString("tr-TR")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
