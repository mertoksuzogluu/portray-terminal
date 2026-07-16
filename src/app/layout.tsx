import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Portföy Terminal | Yatırım Takibi",
  description: "Türk yatırımcılar için premium portföy terminali. Yatırım tavsiyesi değildir.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${dmSans.variable} ${instrumentSerif.variable} h-full`}>
      <body
        suppressHydrationWarning
        className="min-h-full bg-background font-sans text-foreground antialiased"
      >
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast: "border border-border bg-card text-foreground",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
