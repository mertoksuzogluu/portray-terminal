"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import {
  describeTryAmount,
  formatTryInput,
  parseTryInput,
} from "@/lib/goals/money";

export function MoneyInput({
  value,
  onChange,
  className,
  id,
  placeholder,
}: {
  value: number;
  onChange: (next: number) => void;
  className?: string;
  id?: string;
  placeholder?: string;
}) {
  const display = Number.isFinite(value) && value > 0 ? formatTryInput(value) : "";
  const hint = describeTryAmount(value);

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder ?? "Örn. 25.000.000"}
          className={cn("pr-10 font-display text-lg tabular-nums", className)}
          value={display}
          onChange={(e) => {
            const parsed = parseTryInput(e.target.value);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          TL
        </span>
      </div>
      {hint ? (
        <p className="mt-1.5 text-xs font-medium text-primary/90">{hint}</p>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Binlik ayraç otomatik eklenir
        </p>
      )}
    </div>
  );
}
