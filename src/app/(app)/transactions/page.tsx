"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Plus, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { clientFetch } from "@/lib/api/client-fetch";
import { formatDateTR, formatMoney, formatNumber } from "@/lib/format/tr";

interface TransactionRow {
  id: string;
  type: string;
  date: string;
  symbol: string | null;
  assetId: string | null;
  assetName: string | null;
  accountId: string;
  account: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  commission: number;
  notes: string | null;
}

interface AssetMeta {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  exchange?: string | null;
  currency?: string | null;
}

interface Meta {
  accounts: { id: string; name: string }[];
  assets: AssetMeta[];
}

type AssetCategory = "FUND" | "BIST" | "US" | "FX" | "GOLD" | "CRYPTO";

const CATEGORIES: { id: AssetCategory; label: string; example: string }[] = [
  { id: "FUND", label: "Fon (TEFAS)", example: "PBR" },
  { id: "BIST", label: "BIST Hissesi", example: "THYAO" },
  { id: "US", label: "ABD Hissesi", example: "AAPL" },
  { id: "FX", label: "Döviz", example: "USDTRY" },
  { id: "GOLD", label: "Altın", example: "GRAMALTIN" },
  { id: "CRYPTO", label: "Kripto", example: "BTC" },
];

interface LookupResult {
  symbol: string;
  name: string;
  assetType: string;
  exchange: string | null;
  currency: string;
  price: string | null;
  priceDate: string | null;
}

/** Varlıkları açılır listede türe/borsaya göre gruplar. */
function groupAssets(assets: AssetMeta[]): { label: string; items: AssetMeta[] }[] {
  const groups = new Map<string, AssetMeta[]>();
  const labelFor = (a: AssetMeta): string => {
    switch (a.assetType) {
      case "MUTUAL_FUND":
        return "Fonlar";
      case "STOCK":
        return (a.currency ?? "TRY") === "TRY" ? "BIST Hisseleri" : "ABD Hisseleri";
      case "ETF":
        return "ETF";
      case "FX":
        return "Döviz";
      case "GOLD":
        return "Altın";
      case "CRYPTO":
        return "Kripto";
      default:
        return "Diğer";
    }
  };
  for (const a of assets) {
    const key = labelFor(a);
    const arr = groups.get(key) ?? [];
    arr.push(a);
    groups.set(key, arr);
  }
  const order = ["Fonlar", "BIST Hisseleri", "ABD Hisseleri", "ETF", "Döviz", "Altın", "Kripto", "Diğer"];
  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, items: groups.get(label)! }));
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ accounts: [], assets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("FUND");
  const [assetCode, setAssetCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [addingAsset, setAddingAsset] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [buyAccountId, setBuyAccountId] = useState("");
  const [buyDate, setBuyDate] = useState(todayStr);
  const [buyQty, setBuyQty] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [buyCommission, setBuyCommission] = useState("0");

  const [form, setForm] = useState({
    accountId: "",
    assetId: "",
    transactionType: "BUY",
    transactionDate: new Date().toISOString().slice(0, 10),
    quantity: "",
    unitPrice: "",
    commission: "0",
    notes: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await clientFetch<{ transactions: TransactionRow[] } & Meta>(
        "/api/transactions"
      );
      setTransactions(res.transactions);
      setMeta({ accounts: res.accounts, assets: res.assets });
      if (!form.accountId && res.accounts[0]) {
        setForm((f) => ({ ...f, accountId: res.accounts[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await clientFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice),
          commission: Number(form.commission),
        }),
      });
      toast.success("İşlem eklendi");
      setForm((f) => ({ ...f, quantity: "", unitPrice: "", notes: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLookup() {
    if (!assetCode.trim()) {
      toast.error("Kod/sembol girin.");
      return;
    }
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await clientFetch<{ result: LookupResult }>("/api/assets/lookup", {
        method: "POST",
        body: JSON.stringify({ category: assetCategory, code: assetCode.trim() }),
      });
      setLookupResult(res.result);
      // Güncel fiyatı birim fiyat alanına ön-doldur
      if (res.result.price) setBuyPrice(res.result.price);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulunamadı");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleAddAsset() {
    if (!lookupResult) return;
    const qty = Number(buyQty);
    const willBuy = buyQty.trim() !== "" && qty > 0;
    if (willBuy && !buyAccountId) {
      toast.error("Hesap seçin.");
      return;
    }
    setAddingAsset(true);
    try {
      // 1) Varlığı oluştur/güncelle
      const res = await clientFetch<{ asset: AssetMeta; created: boolean }>("/api/assets", {
        method: "POST",
        body: JSON.stringify({ category: assetCategory, code: assetCode.trim() }),
      });

      // 2) Adet girildiyse alış işlemini de kaydet
      if (willBuy) {
        await clientFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify({
            accountId: buyAccountId,
            assetId: res.asset.id,
            transactionType: "BUY",
            transactionDate: buyDate,
            quantity: qty,
            unitPrice: Number(buyPrice),
            commission: Number(buyCommission || 0),
          }),
        });
        toast.success(`${res.asset.symbol} alışı portföye eklendi`);
      } else {
        toast.success(res.created ? "Varlık eklendi" : "Varlık güncellendi");
      }

      await load();
      setForm((f) => ({ ...f, assetId: res.asset.id }));
      setAssetDialogOpen(false);
      setAssetCode("");
      setLookupResult(null);
      setBuyQty("");
      setBuyPrice("");
      setBuyCommission("0");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setAddingAsset(false);
    }
  }

  function openAssetDialog() {
    setLookupResult(null);
    setAssetCode("");
    setBuyQty("");
    setBuyPrice("");
    setBuyCommission("0");
    setBuyDate(todayStr);
    setBuyAccountId((prev) => prev || meta.accounts[0]?.id || "");
    setAssetDialogOpen(true);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !form.accountId) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("accountId", form.accountId);
      const res = await fetch("/api/transactions/import", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "İçe aktarma başarısız");
      toast.success(`${body.imported} işlem içe aktarıldı (${body.skipped} atlandı)`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İçe aktarma hatası");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">İşlemler</h1>
        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">İşlemler</h1>
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-tight">İşlemler</h1>
          <p className="text-sm text-muted-foreground">Alım-satım kayıtları ve CSV içe aktarma</p>
        </div>
        <Button onClick={openAssetDialog}>
          <Plus className="mr-1 h-4 w-4" /> Fon / Hisse Al
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Yeni İşlem</CardTitle>
            <CardDescription>Manuel işlem girişi</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Hesap</Label>
                  <Select
                    value={form.accountId}
                    onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                    required
                  >
                    {meta.accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>İşlem Tipi</Label>
                  <Select
                    value={form.transactionType}
                    onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
                  >
                    <SelectItem value="BUY">Alış</SelectItem>
                    <SelectItem value="SELL">Satış</SelectItem>
                    <SelectItem value="DIVIDEND">Temettü</SelectItem>
                    <SelectItem value="CASH_DEPOSIT">Nakit Yatırma</SelectItem>
                    <SelectItem value="CASH_WITHDRAWAL">Nakit Çekme</SelectItem>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Varlık</Label>
                  <button
                    type="button"
                    onClick={openAssetDialog}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Fon / Hisse Al
                  </button>
                </div>
                <Select
                  value={form.assetId}
                  onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                >
                  <option value="">— Nakit / Yok —</option>
                  {groupAssets(meta.assets).map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.items.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.symbol} · {a.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Tarih</Label>
                  <Input
                    type="date"
                    value={form.transactionDate}
                    onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Miktar</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Birim Fiyat (TRY)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Kaydediliyor…" : "İşlemi Kaydet"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              CSV İçe Aktarma
            </CardTitle>
            <CardDescription>
              Sütunlar: tarih, sembol, tip, miktar, fiyat, komisyon
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                Önce hesap seçin, ardından CSV dosyanızı yükleyin.
              </p>
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm hover:bg-muted">
                  {importing ? "Aktarılıyor…" : "CSV Seç"}
                </span>
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImport}
                disabled={importing || !form.accountId}
              />
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {`tarih,sembol,tip,miktar,fiyat,komisyon\n2024-01-15,THYAO,BUY,100,285.50,2.50`}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>İşlem Geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="İşlem yok"
              description="Henüz kayıtlı işlem bulunmuyor."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Sembol</TableHead>
                  <TableHead>Adet</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Hesap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDateTR(t.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.type}</Badge>
                    </TableCell>
                    <TableCell>{t.symbol ?? "—"}</TableCell>
                    <TableCell>{formatNumber(t.quantity, 2)}</TableCell>
                    <TableCell>{formatMoney(t.unitPrice)}</TableCell>
                    <TableCell>{formatMoney(t.grossAmount)}</TableCell>
                    <TableCell className="text-muted-foreground">{t.account}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent onClose={() => setAssetDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Portföye Fon / Hisse Ekle</DialogTitle>
            <DialogDescription>
              Türü seçip kodunu girin; isim ve güncel fiyat otomatik gelir. Adet + fiyat girip tek
              adımda alış kaydedebilirsiniz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tür</Label>
              <Select
                value={assetCategory}
                onChange={(e) => {
                  setAssetCategory(e.target.value as AssetCategory);
                  setLookupResult(null);
                }}
              >
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Kod / Sembol</Label>
              <div className="flex gap-2">
                <Input
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
                  placeholder={`örn. ${CATEGORIES.find((c) => c.id === assetCategory)?.example ?? ""}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLookup}
                  disabled={lookupLoading}
                >
                  <Search className="mr-1 h-4 w-4" />
                  {lookupLoading ? "Aranıyor…" : "Getir"}
                </Button>
              </div>
            </div>

            {lookupResult && (
              <>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">{lookupResult.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Sembol: {lookupResult.symbol}</span>
                    {lookupResult.exchange && <span>Borsa: {lookupResult.exchange}</span>}
                    <span>Para Birimi: {lookupResult.currency}</span>
                    {lookupResult.price && (
                      <span>
                        Güncel: {lookupResult.price} {lookupResult.currency}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-dashed border-border p-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Alış bilgilerini girin (adet boş bırakılırsa sadece varlık listeye eklenir).
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Hesap</Label>
                      <Select
                        value={buyAccountId}
                        onChange={(e) => setBuyAccountId(e.target.value)}
                      >
                        {meta.accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tarih</Label>
                      <Input
                        type="date"
                        value={buyDate}
                        onChange={(e) => setBuyDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Adet</Label>
                      <Input
                        type="number"
                        step="any"
                        value={buyQty}
                        onChange={(e) => setBuyQty(e.target.value)}
                        placeholder="örn. 100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Birim Fiyat ({lookupResult.currency})</Label>
                      <Input
                        type="number"
                        step="any"
                        value={buyPrice}
                        onChange={(e) => setBuyPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Komisyon</Label>
                      <Input
                        type="number"
                        step="any"
                        value={buyCommission}
                        onChange={(e) => setBuyCommission(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Toplam Tutar</Label>
                      <Input
                        readOnly
                        value={
                          buyQty && buyPrice
                            ? formatMoney(Number(buyQty) * Number(buyPrice))
                            : "—"
                        }
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssetDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleAddAsset} disabled={!lookupResult || addingAsset}>
              {addingAsset
                ? "Ekleniyor…"
                : buyQty.trim() !== "" && Number(buyQty) > 0
                  ? "Portföye Ekle (Alış)"
                  : "Varlığı Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
