import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { DISCLAIMER } from "@/lib/constants/nav";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} />
      <div className="flex min-h-screen flex-1 flex-col pb-16 lg:pb-0">
        <MobileNav />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
        <footer className="hidden border-t border-border px-6 py-3 lg:block">
          <p className="text-center text-[11px] text-muted-foreground">{DISCLAIMER}</p>
        </footer>
      </div>
    </div>
  );
}
