"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { clientFetch } from "@/lib/api/client-fetch";
import { DISCLAIMER } from "@/lib/constants/nav";

interface ProfileRow {
  id: string;
  label: string;
  weights: Record<string, number>;
}

const CLASSES = ["EQUITY", "FUND", "FX", "GOLD", "CASH"] as const;

export default function AdminTargetsPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [classLabels, setClassLabels] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState("BALANCED");
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [notes, setNotes] = useState<
    { id: string; title: string; body: string; isActive: boolean; publishedAt: string }[]
  >([]);

  useEffect(() => {
    Promise.all([
      clientFetch<{
        profiles: ProfileRow[];
        classLabels: Record<string, string>;
      }>("/api/admin/targets"),
      clientFetch<{
        notes: { id: string; title: string; body: string; isActive: boolean; publishedAt: string }[];
      }>("/api/admin/market-notes"),
    ])
      .then(([t, n]) => {
        setProfiles(t.profiles);
        setClassLabels(t.classLabels);
        setNotes(n.notes);
        const bal = t.profiles.find((p) => p.id === "BALANCED") ?? t.profiles[0];
        if (bal) {
          setSelected(bal.id);
          const w: Record<string, string> = {};
          for (const c of CLASSES) w[c] = String(((bal.weights[c] ?? 0) * 100).toFixed(1));
          setWeights(w);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Hata"))
      .finally(() => setLoading(false));
  }, []);

  function onSelectProfile(id: string) {
    setSelected(id);
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    const w: Record<string, string> = {};
    for (const c of CLASSES) w[c] = String(((p.weights[c] ?? 0) * 100).toFixed(1));
    setWeights(w);
  }

  async function saveWeights() {
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      for (const c of CLASSES) payload[c] = Number(weights[c] ?? 0) / 100;
      await clientFetch("/api/admin/targets", {
        method: "PUT",
        body: JSON.stringify({ riskProfile: selected, weights: payload }),
      });
      toast.success("Hedef dağılım kaydedildi");
      const t = await clientFetch<{ profiles: ProfileRow[] }>("/api/admin/targets");
      setProfiles(t.profiles);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function publishNote() {
    try {
      await clientFetch("/api/admin/market-notes", {
        method: "POST",
        body: JSON.stringify({ title: noteTitle, body: noteBody }),
      });
      toast.success("Piyasa notu yayınlandı");
      setNoteTitle("");
      setNoteBody("");
      const n = await clientFetch<{
        notes: { id: string; title: string; body: string; isActive: boolean; publishedAt: string }[];
      }>("/api/admin/market-notes");
      setNotes(n.notes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yayınlanamadı");
    }
  }

  async function toggleNote(id: string, isActive: boolean) {
    try {
      await clientFetch("/api/admin/market-notes", {
        method: "PATCH",
        body: JSON.stringify({ id, isActive }),
      });
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, isActive } : n)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Yönetici</h1>
        <LoadingSkeleton rows={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Yönetici</h1>
        <ErrorState message={error} />
        <Link href="/settings" className="text-sm text-primary hover:underline">
          Ayarlara dön
        </Link>
      </div>
    );
  }

  const sum = CLASSES.reduce((a, c) => a + Number(weights[c] ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Hedef Dağılım & Notlar</h1>
        <p className="text-sm text-muted-foreground">Yalnızca yönetici erişimi</p>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        {DISCLAIMER}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk profili hedef ağırlıkları (%)</CardTitle>
          <CardDescription>Toplam ≈ 100 olmalı (şimdi {sum.toFixed(1)})</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Profil</Label>
            <Select value={selected} onChange={(e) => onSelectProfile(e.target.value)}>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CLASSES.map((c) => (
              <div key={c} className="space-y-1.5">
                <Label>{classLabels[c] ?? c}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={weights[c] ?? "0"}
                  onChange={(e) => setWeights({ ...weights, [c]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <Button onClick={saveWeights} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Piyasa notu yayınla</CardTitle>
          <CardDescription>Yakın çevre üyelerinin öneriler sayfasında görünür</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Başlık</Label>
            <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>İçerik</Label>
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
          </div>
          <Button onClick={publishNote}>Yayınla</Button>

          <div className="space-y-2 pt-4">
            {notes.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleNote(n.id, !n.isActive)}
                >
                  {n.isActive ? "Pasifleştir" : "Aktifleştir"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
