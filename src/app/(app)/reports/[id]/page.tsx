"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PnlValue } from "@/components/shared/pnl-value";
import { ApiError, clientFetch } from "@/lib/api/client-fetch";
import type { MonthlyAiReportContent } from "@/lib/ai-analyst/types";
import {
  formatDateTR,
  formatMoney,
  formatPercentPlain,
} from "@/lib/format/tr";

interface ReportPayload {
  id: string;
  title: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  createdAt: string;
  content: MonthlyAiReportContent | Record<string, unknown>;
}

function isMonthlyContent(
  c: ReportPayload["content"]
): c is MonthlyAiReportContent {
  return (
    typeof c === "object" &&
    c != null &&
    "kind" in c &&
    (c as MonthlyAiReportContent).kind === "monthly_ai" &&
    "metrics" in c &&
    "narrative" in c
  );
}

function MetricCard({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{children}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
      ) : null}
    </Card>
  );
}

function pctOrDash(v: number | null | undefined) {
  if (v == null) return "—";
  return <PnlValue value={v * 100} type="percent" />;
}

export default function AiAnalystDetailPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    clientFetch<{ report: ReportPayload }>(`/api/reports/${params.id}`)
      .then((d) => setReport(d.report))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Yüklenemedi")
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Link
          href="/reports"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          AI Analist
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {error ?? "Rapor yok"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const content = isMonthlyContent(report.content) ? report.content : null;
  const m = content?.metrics;
  const n = content?.narrative;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/reports"
            className="-ml-2 mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            AI Analist
          </Link>
          <h1 className="font-display text-2xl tracking-tight">{report.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTR(report.periodStart)} – {formatDateTR(report.periodEnd)}
            {n ? ` · Kaynak: ${n.source === "openai" ? "OpenAI" : "Şablon analist"}` : ""}
          </p>
        </div>
        <Badge variant="outline">Aylık AI Raporu</Badge>
      </div>

      {n && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yönetici özeti</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            {n.executiveSummary}
          </CardContent>
        </Card>
      )}

      {m && (
        <>
          <div>
            <h2 className="mb-3 font-display text-lg">Dönem metrikleri</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Nominal getiri">
                {pctOrDash(m.nominalReturn)}
              </MetricCard>
              <MetricCard label="Nominal kâr" hint="Ay içi değişim">
                {m.nominalPnl != null ? (
                  <PnlValue value={m.nominalPnl} type="money" />
                ) : (
                  "—"
                )}
              </MetricCard>
              <MetricCard label="Maks. düşüş">
                {m.maxDrawdown != null
                  ? formatPercentPlain(m.maxDrawdown * 100, 2, false)
                  : "—"}
              </MetricCard>
              <MetricCard label="Maks. yükseliş">
                {m.maxRise != null
                  ? formatPercentPlain(m.maxRise * 100, 2, false)
                  : "—"}
              </MetricCard>
              <MetricCard label="Volatilite (yıllık)">
                {m.volatilityAnnual != null
                  ? formatPercentPlain(m.volatilityAnnual * 100, 2, false)
                  : "—"}
              </MetricCard>
              <MetricCard label="Sharpe (risk oranı)">
                {m.sharpeRatio?.toFixed(2) ?? "—"}
              </MetricCard>
              <MetricCard label="Sortino">
                {m.sortinoRatio?.toFixed(2) ?? "—"}
              </MetricCard>
              <MetricCard label="Pozitif gün oranı">
                {pctOrDash(m.positiveDayRatio)}
              </MetricCard>
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg">Reel / alternatif getiri</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>{m.inflationLabel}</CardDescription>
                  <CardTitle className="text-lg tabular-nums">
                    Hurdle {pctOrDash(m.inflationHurdle)} · Ayarlı{" "}
                    {pctOrDash(m.vsInflationReturn)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Ayarlı kâr:{" "}
                  {m.vsInflationPnl != null
                    ? formatMoney(m.vsInflationPnl)
                    : "—"}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>{m.depositLabel}</CardDescription>
                  <CardTitle className="text-lg tabular-nums">
                    Hurdle {pctOrDash(m.depositHurdle)} · Ayarlı{" "}
                    {pctOrDash(m.vsDepositReturn)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Ayarlı kâr:{" "}
                  {m.vsDepositPnl != null ? formatMoney(m.vsDepositPnl) : "—"}
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg">BIST 100 karşılaştırması</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="BIST 100 getiri">
                {pctOrDash(m.bist100Return)}
              </MetricCard>
              <MetricCard label="Portföy alpha">
                {pctOrDash(m.alphaVsBist)}
              </MetricCard>
              <MetricCard label="Beta">
                {m.betaVsBist?.toFixed(2) ?? "—"}
              </MetricCard>
              <MetricCard label="Korelasyon">
                {m.correlationVsBist?.toFixed(2) ?? "—"}
              </MetricCard>
            </div>
            {n && (
              <Card className="mt-3">
                <CardContent className="pt-4 text-sm leading-relaxed text-muted-foreground">
                  {n.benchmarkComparison}
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg">Dağılım</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sınıf dağılımı</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {m.allocationByClass.map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatPercentPlain(s.weight * 100, 1, false)} ·{" "}
                        {formatMoney(s.value)}
                      </span>
                    </div>
                  ))}
                  {m.allocationByClass.length === 0 && (
                    <p className="text-sm text-muted-foreground">Veri yok</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pozisyonlar</CardTitle>
                  <CardDescription>
                    En büyük {pctOrDash(m.largestWeight)} · Top3{" "}
                    {pctOrDash(m.top3Weight)} · HHI {m.hhi?.toFixed(3) ?? "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {m.allocationBySymbol.slice(0, 8).map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium">{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatPercentPlain(s.weight * 100, 1, false)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {n && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performans analizi</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                {n.performanceAnalysis}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk analizi</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                {n.riskAnalysis}
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg">Dünya / makro olaylar</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {n.worldEvents.map((e, i) => (
                <Card key={`${e.title}-${i}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{e.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Etki: </span>
                      {e.impact}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Portföy için:{" "}
                      </span>
                      {e.implication}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg">Pozisyon önerileri</h2>
            <div className="space-y-3">
              {n.positionRecommendations
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((r, i) => (
                  <Card key={`${r.title}-${i}`}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{r.action}</Badge>
                        <Badge variant="secondary">{r.assetClass}</Badge>
                        {r.symbol ? (
                          <Badge variant="outline">{r.symbol}</Badge>
                        ) : null}
                        <CardTitle className="text-base">{r.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {r.rationale}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Önümüzdeki ay</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              {n.outlook}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">{n.disclaimer}</p>
        </>
      )}

      {!content && (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            {report.summary}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
