"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ApiError, clientFetch } from "@/lib/api/client-fetch";
import type { MonthlyAiReportContent } from "@/lib/ai-analyst/types";
import {
  formatDateTR,
  formatMoney,
  formatPercentPlain,
} from "@/lib/format/tr";
import { cn } from "@/lib/utils/cn";

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

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return formatPercentPlain(v * 100, 2, false);
}

function money(v: number | null | undefined): string {
  if (v == null) return "—";
  return formatMoney(v);
}

function actionTr(action: string): string {
  switch (action) {
    case "INCREASE":
      return "Artır";
    case "DECREASE":
      return "Azalt";
    case "HOLD":
      return "Koruyun";
    case "SHIFT_CLASS":
      return "Kaydırın";
    case "PARK_CASH":
      return "Mevduat / para piyasası";
    default:
      return action;
  }
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-neutral-200 pt-6 dark:border-neutral-700">
      <h2 className="mb-3 font-display text-lg tracking-tight text-neutral-900 dark:text-neutral-50">
        <span className="mr-2 text-neutral-400">{number}</span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-neutral-100 py-2.5 last:border-0 dark:border-neutral-800">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-right text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </span>
    </div>
  );
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
        <p className="text-sm text-muted-foreground">{error ?? "Rapor yok"}</p>
      </div>
    );
  }

  const content = isMonthlyContent(report.content) ? report.content : null;
  const m = content?.metrics;
  const n = content?.narrative;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/reports"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          AI Analist
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          Yazdır / PDF
        </Button>
      </div>

      {n?.aiError && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm print:hidden">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            AI bağlanamadı — şablon metin kullanıldı
          </p>
          <p className="mt-1 text-amber-800/90 dark:text-amber-200/80">
            {n.aiError}
          </p>
        </div>
      )}

      {/* PDF / belge görünümü */}
      <article
        className={cn(
          "mx-auto max-w-3xl rounded-sm border border-neutral-200 bg-[#faf9f7] px-6 py-10 shadow-sm",
          "dark:border-neutral-700 dark:bg-neutral-950",
          "print:max-w-none print:border-0 print:bg-white print:px-0 print:py-0 print:shadow-none"
        )}
      >
        <header className="mb-8 border-b border-neutral-300 pb-6 dark:border-neutral-600">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Aylık portföy raporu
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-neutral-900 dark:text-neutral-50">
            {report.title.replace(/ — AI Analist · /, " · ")}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Dönem: {formatDateTR(report.periodStart)} –{" "}
            {formatDateTR(report.periodEnd)}
            {n
              ? ` · ${n.source === "openai" ? "AI ile yazıldı" : "Şablon metin"}`
              : ""}
          </p>
        </header>

        {n && (
          <Section number="01" title="Kısaca ne oldu?">
            <p>{n.executiveSummary}</p>
          </Section>
        )}

        {m && (
          <Section number="02" title="Sayılarla bu ay">
            <div className="rounded-sm border border-neutral-200 bg-white/70 px-4 dark:border-neutral-700 dark:bg-neutral-900/50">
              <StatRow label="Ay başı portföy" value={money(m.startValue)} />
              <StatRow label="Ay sonu portföy" value={money(m.endValue)} />
              <StatRow label="Yatırılan ana para" value={money(m.investedCapital)} />
              <StatRow label="Bu ay kazanç / zarar" value={money(m.nominalPnl)} />
              <StatRow label="Bu ay yüzde" value={pct(m.nominalReturn)} />
              <StatRow
                label="Kıyas süresi"
                value={
                  m.heldDays != null ? `${m.heldDays} gün (kâr ile aynı)` : "—"
                }
              />
              <StatRow label="En kötü düşüş" value={pct(m.maxDrawdown)} />
              <StatRow label="En iyi yükseliş" value={pct(m.maxRise)} />
              <StatRow label="Dalgalanma (yıllık)" value={pct(m.volatilityAnnual)} />
              <StatRow
                label={
                  m.inflationLabel
                    ? `Enflasyon maliyeti (${m.inflationLabel})`
                    : "Enflasyon maliyeti"
                }
                value={`${money(m.inflationOpportunityPnl)} · ${pct(m.inflationHurdle)}`}
              />
              <StatRow
                label="Enflasyona göre fark (portföy − enflasyon)"
                value={`${money(m.vsInflationPnl)} · ${pct(m.vsInflationReturn)}`}
              />
              <StatRow
                label={
                  m.depositLabel
                    ? `Vadeli ile kazanılacak (${m.depositLabel})`
                    : "Vadeli ile kazanılacak"
                }
                value={`${money(m.depositOpportunityPnl)} · ${pct(m.depositHurdle)}`}
              />
              <StatRow
                label="Vadeliye göre fark (portföy − vadeli)"
                value={`${money(m.vsDepositPnl)} · ${pct(m.vsDepositReturn)}`}
              />
              <StatRow label="BIST 100 bu ay" value={pct(m.bist100Return)} />
              <StatRow
                label="Borsaya göre farkınız"
                value={pct(m.alphaVsBist)}
              />
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Vadeli / enflasyon kıyası: aynı paradan aynı günde vadeli veya
              enflasyon kadar ne kaybedilirdi; fark eksi ise vadeli (veya
              enflasyon) daha iyi demektir. Rapor tarihi ayın 1’i–sonu olsa bile
              kâr hesabı ilk portföy gününden itibaren yapılır.
            </p>
          </Section>
        )}

        {n && (
          <>
            <Section number="03" title="Performans">
              <p>{n.performanceAnalysis}</p>
            </Section>
            <Section number="04" title="Risk ve dalgalanma">
              <p>{n.riskAnalysis}</p>
            </Section>
            <Section number="05" title="Borsa ile karşılaştırma">
              <p>{n.benchmarkComparison}</p>
            </Section>
          </>
        )}

        {m && m.allocationBySymbol.length > 0 && (
          <Section number="06" title="Paranız nerede?">
            <p className="text-sm text-neutral-500">
              En büyük pay {pct(m.largestWeight)}. İlk üç toplam{" "}
              {pct(m.top3Weight)}.
            </p>
            <div className="mt-2 rounded-sm border border-neutral-200 bg-white/70 px-4 dark:border-neutral-700 dark:bg-neutral-900/50">
              {m.allocationBySymbol.slice(0, 10).map((s) => (
                <StatRow
                  key={s.key}
                  label={s.label}
                  value={`${pct(s.weight)} · ${money(s.value)}`}
                />
              ))}
            </div>
            {m.allocationByClass.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  Türlere göre
                </p>
                <div className="rounded-sm border border-neutral-200 bg-white/70 px-4 dark:border-neutral-700 dark:bg-neutral-900/50">
                  {m.allocationByClass.map((s) => (
                    <StatRow
                      key={s.key}
                      label={s.label}
                      value={`${pct(s.weight)} · ${money(s.value)}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {n?.topHoldingSpotlight && (
          <Section
            number="07"
            title={`En ağırlıklı ürün: ${n.topHoldingSpotlight.symbol}`}
          >
            <p className="text-sm text-neutral-500">
              {n.topHoldingSpotlight.name}
              {" · "}
              Portföy payı {pct(n.topHoldingSpotlight.weight)}
              {" · "}
              {money(n.topHoldingSpotlight.value)}
            </p>
            <p className="mt-3">{n.topHoldingSpotlight.summary}</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  Güncel durum
                </p>
                <p className="mt-1">{n.topHoldingSpotlight.currentSituation}</p>
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  İnsanlar ne diyor? (X / forum / haber)
                </p>
                <p className="mt-1">{n.topHoldingSpotlight.whatPeopleSay}</p>
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  Beklentiler
                </p>
                <p className="mt-1">{n.topHoldingSpotlight.expectations}</p>
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  Riskler ve neye bakılmalı
                </p>
                <p className="mt-1">{n.topHoldingSpotlight.risksAndWatch}</p>
              </div>
              <p className="text-xs text-neutral-500">
                Kaynaklar: {n.topHoldingSpotlight.sourcesNote}
              </p>
            </div>
          </Section>
        )}

        {n && n.worldEvents.length > 0 && (
          <Section number="08" title="Dünyada neler oldu, size etkisi">
            <ol className="list-decimal space-y-4 pl-5">
              {n.worldEvents.map((e, i) => (
                <li key={`${e.title}-${i}`} className="pl-1">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {e.title}
                  </p>
                  <p className="mt-1">{e.impact}</p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                    Sizin için: {e.implication}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {n && n.positionRecommendations.length > 0 && (
          <Section number="09" title="Ne yapılabilir?">
            <ol className="list-decimal space-y-4 pl-5">
              {n.positionRecommendations
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((r, i) => (
                  <li key={`${r.title}-${i}`} className="pl-1">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {actionTr(r.action)}
                      {r.symbol ? ` · ${r.symbol}` : ""} — {r.title}
                    </p>
                    <p className="mt-1">{r.rationale}</p>
                  </li>
                ))}
            </ol>
          </Section>
        )}

        {n && (
          <Section number="10" title="Gelecek aya bakış">
            <p>{n.outlook}</p>
          </Section>
        )}

        {!content && (
          <p className="text-sm text-neutral-600">{report.summary}</p>
        )}

        <footer className="mt-10 border-t border-neutral-300 pt-4 text-xs leading-relaxed text-neutral-500 dark:border-neutral-600">
          {n?.disclaimer ??
            "Bu yazı yatırım tavsiyesi değildir. Bilgi amaçlıdır."}
          <br />
          Oluşturulma: {formatDateTR(report.createdAt)}
        </footer>
      </article>
    </div>
  );
}
