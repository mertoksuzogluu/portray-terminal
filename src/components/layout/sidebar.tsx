"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  Briefcase,
  FileText,
  GitCompare,
  LayoutDashboard,
  LineChart,
  Scale,
  Settings,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "@/lib/constants/nav";
import { ThemeToggle } from "./theme-toggle";
import type { SessionUser } from "@/lib/auth/session";

const ICONS = {
  LayoutDashboard,
  Briefcase,
  ArrowLeftRight,
  LineChart,
  Scale,
  GitCompare,
  FileText,
  Bell,
  Settings,
} as const;

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <TrendingUp className="h-5 w-5 text-accent" strokeWidth={1.75} />
        <div>
          <p className="font-display text-base leading-tight">Portföy Terminal</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            TRY · {user.isDemo ? "Demo" : "Canlı"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
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

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between rounded-md bg-sidebar-accent/50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{user.name ?? user.email}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
