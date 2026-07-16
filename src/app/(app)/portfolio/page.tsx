"use client";

import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataQualityBadge } from "@/components/shared/data-quality-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PnlValue } from "@/components/shared/pnl-value";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatMoney, formatNumber, formatPercentPlain } from "@/lib/format/tr";

interface PositionRow {
  assetId: string;
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  totalReturn: number;
  weight: number;
  dataQuality: string;
}

export default function PortfolioPage() {
  const [data, setData] = useState<PositionRow[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "marketValue", desc: true }]);

  useEffect(() => {
    clientFetch<{ positions: PositionRow[]; totalValue: number }>("/api/portfolio/positions")
      .then((res) => {
        setData(res.positions);
        setTotalValue(res.totalValue);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Hata"))
      .finally(() => setLoading(false));
  }, []);

  const columns = useMemo<ColumnDef<PositionRow>[]>(
    () => [
      {
        accessorKey: "symbol",
        header: "Sembol",
        cell: ({ row }) => (
          <Link
            href={`/portfolio/${row.original.assetId}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {row.original.symbol}
          </Link>
        ),
      },
      {
        accessorKey: "name",
        header: "Ad",
        cell: ({ getValue }) => (
          <span className="max-w-[160px] truncate text-muted-foreground">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "assetType",
        header: "Tür",
        cell: ({ getValue }) => <Badge variant="outline">{String(getValue())}</Badge>,
      },
      {
        accessorKey: "quantity",
        header: "Adet",
        cell: ({ getValue }) => formatNumber(getValue() as number, 2),
      },
      {
        accessorKey: "marketPrice",
        header: "Fiyat",
        cell: ({ getValue }) => formatMoney(getValue() as number),
      },
      {
        accessorKey: "marketValue",
        header: "Değer",
        cell: ({ getValue }) => formatMoney(getValue() as number),
      },
      {
        accessorKey: "weight",
        header: "Ağırlık",
        cell: ({ getValue }) => formatPercentPlain(getValue() as number, 1),
      },
      {
        accessorKey: "unrealizedPnl",
        header: "Gerç. K/Z",
        cell: ({ getValue }) => <PnlValue value={getValue() as number} />,
      },
      {
        accessorKey: "totalReturn",
        header: "Getiri",
        cell: ({ getValue }) => (
          <PnlValue value={(getValue() as number) * 100} type="percent" />
        ),
      },
      {
        accessorKey: "dataQuality",
        header: "Veri",
        cell: ({ getValue }) => <DataQualityBadge quality={String(getValue())} />,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Portföy</h1>
        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Portföy</h1>
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Portföy</h1>
        <EmptyState
          icon={Briefcase}
          title="Pozisyon bulunamadı"
          description="Henüz açık pozisyonunuz yok. İşlem ekleyerek başlayın."
          actionLabel="İşlem Ekle"
          onAction={() => (window.location.href = "/transactions")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Portföy</h1>
          <p className="text-sm text-muted-foreground">
            {data.length} pozisyon · Toplam {formatMoney(totalValue)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pozisyonlar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="cursor-pointer select-none"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? null}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
