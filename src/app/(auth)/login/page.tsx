"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clientFetch } from "@/lib/api/client-fetch";
import { DISCLAIMER } from "@/lib/constants/nav";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await clientFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      toast.success("Giriş başarılı");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setLoading(true);
    try {
      await clientFetch("/api/auth/demo", { method: "POST" });
      toast.success("Demo oturumu açıldı");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo girişi başarısız");
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
          <p className="text-sm text-muted-foreground">Türk yatırımcılar için portföy takibi</p>
        </div>
      </div>

      <Card className="w-full max-w-md border-border/80 shadow-md">
        <CardHeader>
          <CardTitle>Giriş Yap</CardTitle>
          <CardDescription>E-posta ve şifrenizle oturum açın veya demo modunu deneyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">veya</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleDemo}
            disabled={loading}
          >
            Demo Hesap ile Giriş
          </Button>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            {DISCLAIMER}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
