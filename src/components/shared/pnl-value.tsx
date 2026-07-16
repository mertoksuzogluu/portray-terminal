import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPercent, formatSignedMoney } from "@/lib/format/tr";

export function PnlValue({
  value,
  type = "money",
  currency = "TRY",
  className,
  showIcon = true,
}: {
  value: number | string | null | undefined;
  type?: "money" | "percent";
  currency?: string;
  className?: string;
  showIcon?: boolean;
}) {
  const num = value == null ? 0 : Number(value);
  const isPositive = num > 0;
  const isNegative = num < 0;
  const isZero = num === 0;

  const formatted =
    type === "percent"
      ? formatPercent(num, 2, false)
      : formatSignedMoney(num, currency);

  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        isPositive && "text-positive",
        isNegative && "text-negative",
        isZero && "text-muted-foreground",
        className
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />}
      {formatted}
    </span>
  );
}
