"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "@/lib/constants/nav";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" />
          <span className="font-display text-base">Portföy Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Menü">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-sidebar p-4 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-lg">Menü</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-md px-3 py-2.5 text-sm",
                      active
                        ? "bg-sidebar-accent font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent/60"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card lg:hidden">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center py-2 text-[10px]",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
