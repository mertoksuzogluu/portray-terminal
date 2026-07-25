"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ApiError, clientFetch } from "@/lib/api/client-fetch";
import { formatDateTR } from "@/lib/format/tr";

interface Report {
  id: string;
  title: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  createdAt: string;
}

export default function AiAnalystPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clientFetch<{ reports: Report[] }>(
        "/api/reports?type=monthly_ai"
      );
      setReports(data.reports);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Raporlar yüklenemedi."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await clientFetch<{
        ok: boolean;
        source?: "openai" | "template" | null;
        aiError?: string | null;
      }>("/api/reports/generate-monthly", { method: "POST" });
      await load();
      if (result.source === "template" && result.aiError) {
        setError(`AI bağlanamadı: ${result.aiError}`);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Rapor üretilemedi."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-tight">AI Analist</h1>
          <p className="text-sm text-muted-foreground">
            Her ayın 30’unda yayımlanan detaylı portföy raporu — risk, reel
            getiri, BIST 100 karşılaştırması ve pozisyon önerileri
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={generating}
          onClick={() => void handleGenerate()}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {generating ? "Üretiliyor…" : "Bu ayı üret"}
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="Henüz aylık rapor yok"
          description="Ayın 30’unda otomatik üretilir. Şimdi denemek için «Bu ayı üret»e basabilirsiniz."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`} className="block">
              <Card className="h-full transition-colors hover:border-foreground/20">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{r.title}</CardTitle>
                    <Badge variant="outline">AI Analist</Badge>
                  </div>
                  <CardDescription>
                    {formatDateTR(r.periodStart)} – {formatDateTR(r.periodEnd)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {r.summary}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Oluşturulma: {formatDateTR(r.createdAt)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
