export const NAV_ITEMS = [
  { href: "/dashboard", label: "Özet", icon: "LayoutDashboard" as const },
  { href: "/portfolio", label: "Portföy", icon: "Briefcase" as const },
  { href: "/recommendations", label: "Öneriler", icon: "Lightbulb" as const },
  { href: "/transactions", label: "İşlemler", icon: "ArrowLeftRight" as const },
  { href: "/funds", label: "Fonlar", icon: "Trophy" as const },
  { href: "/market", label: "Piyasa", icon: "CandlestickChart" as const },
  { href: "/analytics", label: "Analiz", icon: "LineChart" as const },
  { href: "/real-return", label: "Reel Getiri", icon: "Scale" as const },
  { href: "/benchmarks", label: "Karşılaştırma", icon: "GitCompare" as const },
  { href: "/reports", label: "Raporlar", icon: "FileText" as const },
  { href: "/alerts", label: "Uyarılar", icon: "Bell" as const },
  { href: "/settings", label: "Ayarlar", icon: "Settings" as const },
] as const;

export const DISCLAIMER =
  "Bu uygulama yatırım tavsiyesi değildir. Veriler bilgilendirme amaçlıdır.";
