"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { clientFetch } from "@/lib/api/client-fetch";
import { DISCLAIMER } from "@/lib/constants/nav";

interface SettingsData {
  user: {
    id: string;
    email: string;
    name: string | null;
    baseCurrency: string;
    timezone: string;
    riskFreeRateAnnual: number;
    role?: string;
    riskProfile?: string;
    isDemo: boolean;
  };
  portfolio: {
    id: string;
    name: string;
    baseCurrency: string;
    accounts: { id: string; name: string; institution: string | null }[];
  } | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    baseCurrency: "TRY",
    timezone: "Europe/Istanbul",
    riskFreeRateAnnual: "45",
    riskProfile: "BALANCED",
  });

  useEffect(() => {
    clientFetch<SettingsData>("/api/settings")
      .then((res) => {
        setData(res);
        setForm({
          name: res.user.name ?? "",
          baseCurrency: res.user.baseCurrency,
          timezone: res.user.timezone,
          riskFreeRateAnnual: String(res.user.riskFreeRateAnnual * 100),
          riskProfile: res.user.riskProfile ?? "BALANCED",
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Hata"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await clientFetch<{ user: SettingsData["user"] }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          baseCurrency: form.baseCurrency,
          timezone: form.timezone,
          riskFreeRateAnnual: Number(form.riskFreeRateAnnual) / 100,
          riskProfile: form.riskProfile,
        }),
      });
      setData((d) => (d ? { ...d, user: updated.user } : d));
      toast.success("Ayarlar kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await clientFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Ayarlar</h1>
        <LoadingSkeleton rows={3} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Ayarlar</h1>
        <ErrorState message={error ?? "Ayarlar yüklenemedi"} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Ayarlar</h1>
        <p className="text-sm text-muted-foreground">Hesap ve portföy tercihleri</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Profil
          </CardTitle>
          <CardDescription>
            {data.user.email}
            {data.user.isDemo && " · Demo hesap"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Görünen Ad</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="currency">Ana Para Birimi</Label>
                <Input
                  id="currency"
                  value={form.baseCurrency}
                  onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rf">Risksiz Faiz (% yıllık)</Label>
                <Input
                  id="rf"
                  type="number"
                  step="0.01"
                  value={form.riskFreeRateAnnual}
                  onChange={(e) => setForm({ ...form, riskFreeRateAnnual: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz">Saat Dilimi</Label>
              <Input
                id="tz"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="riskProfile">Risk Profili</Label>
              <Select
                id="riskProfile"
                value={form.riskProfile}
                onChange={(e) => setForm({ ...form, riskProfile: e.target.value })}
              >
                <SelectItem value="CONSERVATIVE">Muhafazakâr</SelectItem>
                <SelectItem value="BALANCED">Dengeli</SelectItem>
                <SelectItem value="GROWTH">Büyüme</SelectItem>
                <SelectItem value="AGGRESSIVE">Agresif</SelectItem>
              </Select>
              <p className="text-xs text-muted-foreground">
                Öneri motoru hedef varlık dağılımını bu profile göre dönüştürür.{" "}
                <Link href="/recommendations" className="text-primary hover:underline">
                  Önerilere git
                </Link>
              </p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {data.user.role === "ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle>Yönetici</CardTitle>
            <CardDescription>Hedef dağılımlar ve piyasa notları</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/targets"
              className="text-sm font-medium text-primary hover:underline"
            >
              Hedef dağılım & piyasa notu yönetimi →
            </Link>
          </CardContent>
        </Card>
      )}

      {data.portfolio && (
        <Card>
          <CardHeader>
            <CardTitle>Portföy</CardTitle>
            <CardDescription>{data.portfolio.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.portfolio.accounts.map((a) => (
                <li key={a.id} className="flex justify-between border-b border-border py-2">
                  <span>{a.name}</span>
                  <span className="text-muted-foreground">{a.institution ?? "—"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Oturum</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Hesabınızdan çıkış yapın</p>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-[11px] text-muted-foreground">{DISCLAIMER}</p>
    </div>
  );
}
