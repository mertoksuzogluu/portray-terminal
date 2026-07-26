import {
  ArrowLeftRight,
  Bell,
  Brain,
  Briefcase,
  CandlestickChart,
  GitCompare,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  Scale,
  Settings,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { NAV_ITEMS } from "./nav";

export const NAV_ICONS: Record<(typeof NAV_ITEMS)[number]["icon"], LucideIcon> =
  {
    LayoutDashboard,
    Briefcase,
    Lightbulb,
    ArrowLeftRight,
    Trophy,
    CandlestickChart,
    LineChart,
    Scale,
    GitCompare,
    Brain,
    Bell,
    Settings,
  };

/** Mobil alt bar — en sık kullanılanlar */
export const MOBILE_TAB_HREFS = [
  "/dashboard",
  "/portfolio",
  "/transactions",
  "/reports",
  "/settings",
] as const;

/** Dar ekranda taşmayı önlemek için kısa etiketler */
export const MOBILE_TAB_SHORT_LABELS: Partial<
  Record<(typeof MOBILE_TAB_HREFS)[number], string>
> = {
  "/reports": "Analist",
};
