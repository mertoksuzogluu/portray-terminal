"use client";

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export interface PriceBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceLinePoint {
  time: string;
  value: number;
}

export function PriceChart({
  data,
  mode = "area",
  height = 320,
}: {
  data: PriceLinePoint[] | PriceBar[];
  mode?: "area" | "candle";
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Candlestick"> | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = resolvedTheme === "dark";
    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#9a9488" : "#5c564c",
      },
      grid: {
        vertLines: { color: isDark ? "#2a2620" : "#d4cdc0" },
        horzLines: { color: isDark ? "#2a2620" : "#d4cdc0" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    chartRef.current = chart;

    if (mode === "candle" && data.length > 0 && "open" in data[0]) {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#52b788",
        downColor: "#e5383b",
        borderVisible: false,
        wickUpColor: "#52b788",
        wickDownColor: "#e5383b",
      });
      series.setData(
        (data as PriceBar[]).map((d) => ({
          time: d.time as `${number}-${number}-${number}`,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      );
      seriesRef.current = series;
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor: isDark ? "#52b788" : "#1b4332",
        topColor: isDark ? "rgba(82, 183, 136, 0.35)" : "rgba(27, 67, 50, 0.25)",
        bottomColor: "transparent",
        lineWidth: 2,
      });
      series.setData(
        (data as PriceLinePoint[]).map((d) => ({
          time: d.time as `${number}-${number}-${number}`,
          value: d.value,
        }))
      );
      seriesRef.current = series;
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [data, mode, height, resolvedTheme]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground"
        style={{ height }}
      >
        Fiyat geçmişi bulunamadı
      </div>
    );
  }

  return <div ref={containerRef} className="w-full rounded-lg" />;
}
