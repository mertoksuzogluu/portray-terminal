import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { PriceChart } from "@/components/charts/price-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartSkeleton } from "@/components/shared/loading-skeleton";
import { PnlValue } from "@/components/shared/pnl-value";
import { ApiError, serverFetch } from "@/lib/api/server-fetch";
import { formatDateTR, formatMoney, formatNumber, formatPercentPlain } from "@/lib/format/tr";

interface AssetDetail {
  asset: {
    id: string;
    symbol: string;
    name: string;
    assetType: string;
    currency: string;
    exchange: string | null;
  };
  position: {
    quantity: number;
    averageCost: number;
    marketPrice: number;
    marketValue: number;
    unrealizedPnl: number;
    dailyPnl: number;
    weight: number | null;
    snapshotDate: string;
  } | null;
  priceHistory: { time: string; value: number; open: number; high: number; low: number; close: number }[];
  transactions: {
    id: string;
    type: string;
    date: string;
    quantity: number;
    unitPrice: number;
    grossAmount: number;
    account: string;
  }[];
}

async function AssetDetailContent({ assetId }: { assetId: string }) {
  let data: AssetDetail;
  try {
    data = await serverFetch<AssetDetail>(`/api/portfolio/${assetId}`);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Varlık detayı yüklenemedi.";
    return (
      <div className="rounded-lg border border-negative/30 p-8 text-center">
        <p className="font-display text-lg">{message}</p>
        <Link
          href="/portfolio"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm hover:bg-muted"
        >
          Portföye dön
        </Link>
      </div>
    );
  }

  const { asset, position, priceHistory, transactions } = data;
  const lineData = priceHistory.map((p) => ({ time: p.time, value: p.close }));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link
          href="/portfolio"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl">{asset.symbol}</h1>
            <Badge variant="outline">{asset.assetType}</Badge>
          </div>
          <p className="text-muted-foreground">{asset.name}</p>
          {asset.exchange && (
            <p className="text-xs text-muted-foreground">{asset.exchange}</p>
          )}
        </div>
      </div>

      {position ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Piyasa Değeri" value={formatMoney(position.marketValue, asset.currency)} />
          <Metric label="Adet" value={formatNumber(position.quantity, 2)} />
          <Metric
            label="Gerçekleşmemiş K/Z"
            value={<PnlValue value={position.unrealizedPnl} currency={asset.currency} />}
          />
          <Metric
            label="Günlük K/Z"
            value={<PnlValue value={position.dailyPnl} currency={asset.currency} />}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Bu varlık için açık pozisyon bulunamadı.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fiyat Grafiği</CardTitle>
          <CardDescription>
            {priceHistory.length > 0
              ? `${priceHistory[0]?.time} – ${priceHistory.at(-1)?.time}`
              : "Veri yok"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ChartSkeleton />}>
            <PriceChart data={lineData} mode="area" height={360} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Son İşlemler</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">İşlem kaydı yok</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Adet</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Hesap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDateTR(t.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.type}</Badge>
                    </TableCell>
                    <TableCell>{formatNumber(t.quantity, 2)}</TableCell>
                    <TableCell>{formatMoney(t.unitPrice)}</TableCell>
                    <TableCell>{formatMoney(t.grossAmount)}</TableCell>
                    <TableCell className="text-muted-foreground">{t.account}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {position?.weight != null && (
        <p className="text-xs text-muted-foreground">
          Portföy ağırlığı: {formatPercentPlain(position.weight, 2)} · Anlık görüntü:{" "}
          {formatDateTR(position.snapshotDate)}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <AssetDetailContent assetId={assetId} />
    </Suspense>
  );
}
