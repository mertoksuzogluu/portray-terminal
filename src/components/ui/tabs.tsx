"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs bileşenleri Tabs içinde kullanılmalıdır.");
  return ctx;
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const value = controlledValue ?? internal;
  const setValue = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-md border border-border bg-muted p-1",
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const { value: active, setValue } = useTabsContext();
  const isActive = active === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => setValue(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition-colors",
        isActive
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const { value: active } = useTabsContext();
  if (active !== value) return null;

  return (
    <div role="tabpanel" className={cn("focus-visible:outline-none", className)}>
      {children}
    </div>
  );
}
