"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clientFetch } from "@/lib/api/client-fetch";
import { DISCLAIMER } from "@/lib/constants/nav";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await clientFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, inviteCode }),
      });
      toast.success("Hesap oluşturuldu");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 terminal-grid">
      <div className="mb-8 flex items-center gap-3">
        <TrendingUp className="h-8 w-8 text-accent" strokeWidth={1.5} />
        <div>
          <h1 className="font-display text-3xl tracking-tight">Portföy Terminal</h1>
          <p className="text-sm text-muted-foreground">Davetli kayıt</p>
        </div>
      </div>

      <Card className="w-full max-w-md border-border/80 shadow-md">
        <CardHeader>
          <CardTitle>Hesap Oluştur</CardTitle>
          <CardDescription>
            Kayıt için davet kodu gereklidir. Kod sizde yoksa panel sahibiyle iletişime geçin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite">Davet Kodu</Label>
              <Input
                id="invite"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Ad (opsiyonel)</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre (en az 8 karakter)</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Oluşturuluyor…" : "Hesap Oluştur"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Zaten hesabın var mı?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Giriş yap
            </Link>
          </p>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            {DISCLAIMER}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
