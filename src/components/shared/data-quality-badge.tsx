import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const LABELS: Record<string, string> = {
  LIVE: "Canlı",
  DELAYED: "Gecikmeli",
  END_OF_DAY: "Gün sonu",
  STALE: "Eski",
  MANUAL: "Manuel",
  ERROR: "Hata",
};

const VARIANTS: Record<string, "positive" | "warning" | "muted" | "negative"> = {
  LIVE: "positive",
  DELAYED: "warning",
  END_OF_DAY: "muted",
  STALE: "negative",
  MANUAL: "muted",
  ERROR: "negative",
};

export function DataQualityBadge({
  quality,
  className,
}: {
  quality: string;
  className?: string;
}) {
  const label = LABELS[quality] ?? quality;
  const variant = VARIANTS[quality] ?? "muted";

  return (
    <Badge variant={variant} className={cn("font-normal", className)}>
      {label}
    </Badge>
  );
}
