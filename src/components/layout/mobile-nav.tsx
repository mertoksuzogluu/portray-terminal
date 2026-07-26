"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "@/lib/constants/nav";
import {
  MOBILE_TAB_HREFS,
  MOBILE_TAB_SHORT_LABELS,
  NAV_ICONS,
} from "@/lib/constants/nav-icons";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const tabItems = MOBILE_TAB_HREFS.map(
    (href) => NAV_ITEMS.find((i) => i.href === href)!
  ).filter(Boolean);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" strokeWidth={1.75} />
          <span className="font-display text-base tracking-tight">
            Portföy Terminal
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-md">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
              <span className="font-display text-lg tracking-tight">Menü</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {tabItems.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2 : 1.75}
              />
              <span className={cn("font-medium", active && "text-primary")}>
                {MOBILE_TAB_SHORT_LABELS[
                  item.href as (typeof MOBILE_TAB_HREFS)[number]
                ] ?? item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
