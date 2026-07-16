"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatDateTimeTR, formatNumber } from "@/lib/format/tr";

interface AlertRule {
  id: string;
  name: string;
  alertType: string;
  threshold: number;
  operator: string;
  isActive: boolean;
  asset: { symbol: string; name: string } | null;
}

interface AlertEvent {
  id: string;
  message: string;
  currentValue: number;
  triggeredAt: string;
  isRead: boolean;
  ruleName: string;
  asset: string | null;
}

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await clientFetch<{
        rules: AlertRule[];
        events: AlertEvent[];
        unreadCount: number;
      }>("/api/alerts");
      setRules(data.rules);
      setEvents(data.events);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(eventId: string) {
    await clientFetch("/api/alerts", {
      method: "PATCH",
      body: JSON.stringify({ eventId, isRead: true }),
    });
    await load();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Uyarılar</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Uyarılar</h1>
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Uyarılar</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} okunmamış uyarı` : "Tüm uyarılar okundu"}
          </p>
        </div>
        <BellRing className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Uyarı Kuralları</CardTitle>
            <CardDescription>Tanımlı eşik kuralları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Kural yok"
                description="Henüz uyarı kuralı tanımlanmamış."
              />
            ) : (
              rules.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.alertType} · {r.operator} {formatNumber(r.threshold, 2)}
                      {r.asset ? ` · ${r.asset.symbol}` : ""}
                    </p>
                  </div>
                  <Switch checked={r.isActive} onCheckedChange={() => {}} disabled />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uyarı Geçmişi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tetiklenen uyarı yok</p>
            ) : (
              events.map((e) => (
                <div
                  key={e.id}
                  className={`rounded-md border p-3 ${e.isRead ? "border-border opacity-70" : "border-warning/40 bg-warning-muted/30"}`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    {!e.isRead && <Badge variant="warning">Yeni</Badge>}
                    <span className="text-xs text-muted-foreground">{e.ruleName}</span>
                  </div>
                  <p className="text-sm">{e.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTimeTR(e.triggeredAt)} · Değer: {formatNumber(e.currentValue, 2)}
                  </p>
                  {!e.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 text-xs"
                      onClick={() => markRead(e.id)}
                    >
                      Okundu işaretle
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
