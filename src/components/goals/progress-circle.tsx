"use client";

import { formatMoney, formatPercentPlain } from "@/lib/format/tr";

export function ProgressCircle({
  targetAmount,
  currentValue,
  progressPct,
}: {
  targetAmount: number;
  currentValue: number;
  progressPct: number;
}) {
  const size = 220;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, progressPct));
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(255 255 255 / 0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#goalGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="goalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#52b788" />
            <stop offset="100%" stopColor="#d4a72c" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-xl tracking-tight text-foreground sm:text-2xl">
          {formatMoney(targetAmount, "TRY", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </p>
        <p className="mt-1 text-2xl font-medium text-primary">
          {formatPercentPlain(pct / 100, 1)}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatMoney(currentValue, "TRY", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </p>
      </div>
    </div>
  );
}
