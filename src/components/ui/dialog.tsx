"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-lg">{children}</div>
    </div>
  );
}

export function DialogContent({
  className,
  children,
  onClose,
}: {
  className?: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-6 shadow-md",
        className
      )}
      role="dialog"
      aria-modal="true"
    >
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 h-8 w-8"
          onClick={onClose}
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      {children}
    </div>
  );
}

export function DialogHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("mb-4 flex flex-col gap-1.5 pr-8", className)}>{children}</div>;
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h2 className={cn("font-display text-lg font-normal tracking-tight", className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}

export function DialogFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>
      {children}
    </div>
  );
}
