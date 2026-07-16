"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPercentPlain } from "@/lib/format/tr";

export interface BenchmarkSeriesPoint {
  date: string;
  portfolio: number;
  benchmark: number;
}

export function BenchmarkChart({ data }: { data: BenchmarkSeriesPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Karşılaştırma verisi yok
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatPercentPlain(v, 1, false)}
          width={56}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: 12,
          }}
          formatter={(value, name) => [
            formatPercentPlain(Number(value), 2, false),
            name === "portfolio" ? "Portföy" : "Endeks",
          ]}
        />
        <Legend
          formatter={(value) => (value === "portfolio" ? "Portföy" : "Endeks")}
        />
        <Line
          type="monotone"
          dataKey="portfolio"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="benchmark"
          stroke="var(--chart-3)"
          strokeWidth={2}
          dot={false}
          strokeDasharray="4 4"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
