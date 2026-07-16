"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Veri yüklenemedi",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-negative/30 bg-negative-muted px-6 py-10 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-negative" strokeWidth={1.5} />
      <h3 className="font-display text-lg">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Tekrar dene
        </Button>
      )}
    </div>
  );
}
