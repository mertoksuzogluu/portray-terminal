import { Suspense } from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ApiError, serverFetch } from "@/lib/api/server-fetch";
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

async function ReportsContent() {
  let reports: Report[] = [];
  try {
    const data = await serverFetch<{ reports: Report[] }>("/api/reports");
    reports = data.reports;
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Raporlar yüklenemedi.";
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">{message}</CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Rapor bulunamadı"
        description="Dönemsel raporlar henüz oluşturulmamış. Anlık görüntüler oluştukça raporlar üretilecektir."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reports.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{r.title}</CardTitle>
              <Badge variant="outline">{r.reportType}</Badge>
            </div>
            <CardDescription>
              {formatDateTR(r.periodStart)} – {formatDateTR(r.periodEnd)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{r.summary}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Oluşturulma: {formatDateTR(r.createdAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Raporlar</h1>
        <p className="text-sm text-muted-foreground">Dönemsel portföy raporları</p>
      </div>
      <Suspense fallback={<LoadingSkeleton />}>
        <ReportsContent />
      </Suspense>
    </div>
  );
}
