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
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
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

interface Quota {
  manualUsedThisMonth: boolean;
  manualRemaining: number;
  maxManualPerMonth: number;
  maxReportsPerMonth: number;
  autoAtMonthEnd: boolean;
}

function triggerLabel(reportType: string): string {
  if (reportType === "monthly_ai_manual") return "Manuel";
  if (reportType === "monthly_ai") return "Otomatik";
  return reportType;
}

export default function AiAnalystPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clientFetch<{
        reports: Report[];
        quota: Quota;
      }>("/api/reports?type=monthly_ai");
      setReports(data.reports);
      setQuota(data.quota);
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

  const canManual = (quota?.manualRemaining ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Analist"
        description="Ayda en fazla 2 rapor: 1 manuel + ayın 30’unda 1 otomatik"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={generating || !canManual}
            onClick={() => void handleGenerate()}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {generating
              ? "Üretiliyor…"
              : canManual
                ? "Bu ayı üret"
                : "Manuel hak bitti"}
          </Button>
        }
      />

      {quota && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Manuel hak: {quota.manualRemaining}/{quota.maxManualPerMonth}
          {quota.manualUsedThisMonth
            ? " · Bu ay kullandınız · 30’unda otomatik yine gelecek"
            : " · Bu ay henüz kullanmadınız"}
        </p>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : error && reports.length === 0 ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="Henüz aylık rapor yok"
          description={
            canManual
              ? "İlk raporunuzu şimdi üretebilirsiniz. Ayın 30’unda otomatik bir rapor daha oluşur."
              : "Manuel hakkınız bu ay doldu. Ayın 30’unda otomatik rapor gelecek."
          }
          actionLabel={canManual ? "Bu ayı üret" : undefined}
          onAction={canManual ? () => void handleGenerate() : undefined}
        />
      ) : (
        <>
          {error ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
              {error}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`} className="block">
                <Card className="h-full shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted/20">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {r.title}
                      </CardTitle>
                      <Badge variant="outline">
                        {triggerLabel(r.reportType)}
                      </Badge>
                    </div>
                    <CardDescription>
                      {formatDateTR(r.periodStart)} –{" "}
                      {formatDateTR(r.periodEnd)}
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
        </>
      )}
    </div>
  );
}
