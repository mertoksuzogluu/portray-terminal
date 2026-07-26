import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  href,
  actionVariant = "default",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
  actionVariant?: "default" | "outline";
}) {
  const showAction = Boolean(actionLabel && (onAction || href));

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <div className="mb-4 rounded-full bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h3 className="font-display text-lg tracking-tight">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {showAction && href ? (
        <Link
          href={href}
          className={cn(buttonVariants({ variant: actionVariant }), "mt-4")}
        >
          {actionLabel}
        </Link>
      ) : null}
      {showAction && !href && onAction ? (
        <Button
          className="mt-4"
          variant={actionVariant}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
