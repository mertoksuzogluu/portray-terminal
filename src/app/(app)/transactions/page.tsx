"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
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
import {
  TRANSACTION_TYPE_OPTIONS,
  transactionTypeLabel,
} from "@/lib/constants/transaction-labels";
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

type FormState = {
  accountId: string;
  assetId: string;
  transactionType: string;
  transactionDate: string;
  quantity: string;
  unitPrice: string;
  commission: string;
  notes: string;
};

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

function emptyForm(accountId = ""): FormState {
  return {
    accountId,
    assetId: "",
    transactionType: "BUY",
    transactionDate: new Date().toISOString().slice(0, 10),
    quantity: "",
    unitPrice: "",
    commission: "0",
    notes: "",
  };
}

function typeBadgeVariant(type: string): "positive" | "negative" | "secondary" | "outline" {
  if (type === "BUY" || type === "CASH_DEPOSIT" || type === "DIVIDEND") return "positive";
  if (type === "SELL" || type === "CASH_WITHDRAWAL") return "negative";
  return "outline";
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ accounts: [], assets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<TransactionRow | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      if (!q) return true;
      return (
        (t.symbol ?? "").toLowerCase().includes(q) ||
        (t.assetName ?? "").toLowerCase().includes(q) ||
        t.account.toLowerCase().includes(q) ||
        transactionTypeLabel(t.type).toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [transactions, query, typeFilter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await clientFetch<{ transactions: TransactionRow[] } & Meta>(
        "/api/transactions"
      );
      setTransactions(res.transactions);
      setMeta({ accounts: res.accounts, assets: res.assets });
      const defaultAccount = res.accounts[0]?.id ?? "";
      setForm((f) => ({ ...f, accountId: f.accountId || defaultAccount }));
      setBuyAccountId((prev) => prev || defaultAccount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyForm(meta.accounts[0]?.id ?? ""));
    setCreateOpen(true);
  }

  function openEdit(tx: TransactionRow) {
    setEditing(tx);
    setEditForm({
      accountId: tx.accountId,
      assetId: tx.assetId ?? "",
      transactionType: tx.type,
      transactionDate: tx.date,
      quantity: String(tx.quantity),
      unitPrice: String(tx.unitPrice),
      commission: String(tx.commission ?? 0),
      notes: tx.notes ?? "",
    });
    setEditOpen(true);
  }

  function openDelete(tx: TransactionRow) {
    setDeleting(tx);
    setDeleteOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await clientFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          assetId: form.assetId || null,
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice),
          commission: Number(form.commission || 0),
        }),
      });
      toast.success("İşlem eklendi");
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      await clientFetch(`/api/transactions/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          assetId: editForm.assetId || null,
          quantity: Number(editForm.quantity),
          unitPrice: Number(editForm.unitPrice),
          commission: Number(editForm.commission || 0),
        }),
      });
      toast.success("İşlem güncellendi");
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncelleme başarısız");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await clientFetch(`/api/transactions/${deleting.id}`, { method: "DELETE" });
      toast.success("İşlem silindi");
      setDeleteOpen(false);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setDeletingBusy(false);
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
      const res = await clientFetch<{ asset: AssetMeta; created: boolean }>("/api/assets", {
        method: "POST",
        body: JSON.stringify({ category: assetCategory, code: assetCode.trim() }),
      });

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
    const accountId = form.accountId || meta.accounts[0]?.id;
    if (!file || !accountId) {
      toast.error("Önce bir hesap seçin.");
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("accountId", accountId);
      const res = await fetch("/api/transactions/import", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "İçe aktarma başarısız");
      toast.success(`${body.imported} işlem içe aktarıldı (${body.skipped} atlandı)`);
      setImportOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İçe aktarma hatası");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  function renderFormFields(
    value: FormState,
    onChange: (next: FormState) => void,
    idPrefix: string
  ) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-account`}>Hesap</Label>
            <Select
              id={`${idPrefix}-account`}
              value={value.accountId}
              onChange={(e) => onChange({ ...value, accountId: e.target.value })}
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
            <Label htmlFor={`${idPrefix}-type`}>İşlem tipi</Label>
            <Select
              id={`${idPrefix}-type`}
              value={value.transactionType}
              onChange={(e) => onChange({ ...value, transactionType: e.target.value })}
            >
              {TRANSACTION_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${idPrefix}-asset`}>Varlık</Label>
            <button
              type="button"
              onClick={openAssetDialog}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Yeni fon/hisse bul
            </button>
          </div>
          <Select
            id={`${idPrefix}-asset`}
            value={value.assetId}
            onChange={(e) => onChange({ ...value, assetId: e.target.value })}
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
            <Label htmlFor={`${idPrefix}-date`}>Tarih</Label>
            <Input
              id={`${idPrefix}-date`}
              type="date"
              value={value.transactionDate}
              onChange={(e) => onChange({ ...value, transactionDate: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-qty`}>Miktar</Label>
            <Input
              id={`${idPrefix}-qty`}
              type="number"
              step="any"
              value={value.quantity}
              onChange={(e) => onChange({ ...value, quantity: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-price`}>Birim fiyat</Label>
            <Input
              id={`${idPrefix}-price`}
              type="number"
              step="any"
              value={value.unitPrice}
              onChange={(e) => onChange({ ...value, unitPrice: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-commission`}>Komisyon</Label>
            <Input
              id={`${idPrefix}-commission`}
              type="number"
              step="any"
              value={value.commission}
              onChange={(e) => onChange({ ...value, commission: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-notes`}>Not</Label>
            <Input
              id={`${idPrefix}-notes`}
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
              placeholder="İsteğe bağlı"
            />
          </div>
        </div>

        {value.quantity && value.unitPrice && (
          <p className="text-sm text-muted-foreground">
            Tahmini tutar:{" "}
            <span className="font-medium text-foreground">
              {formatMoney(Number(value.quantity) * Number(value.unitPrice))}
            </span>
          </p>
        )}
      </div>
    );
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
          <p className="text-sm text-muted-foreground">
            Yanlış eklediğiniz alımı buradan düzenleyebilir veya silebilirsiniz.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />
            CSV
          </Button>
          <Button type="button" variant="secondary" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Yeni işlem
          </Button>
          <Button type="button" onClick={openAssetDialog}>
            <Plus className="mr-1 h-4 w-4" />
            Hızlı alış
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="cursor-pointer transition-colors hover:bg-muted/30" onClick={openAssetDialog}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fon / hisse al</CardTitle>
            <CardDescription>Sembol bul, adet gir, tek adımda kaydet</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-muted/30" onClick={openCreate}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Manuel işlem</CardTitle>
            <CardDescription>Alış, satış, temettü, nakit hareketi</CardDescription>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer transition-colors hover:bg-muted/30"
          onClick={() => setImportOpen(true)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CSV yükle</CardTitle>
            <CardDescription>Toplu işlemleri dosyadan aktar</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>İşlem geçmişi</CardTitle>
            <CardDescription>
              {filtered.length} kayıt
              {filtered.length !== transactions.length
                ? ` (filtreli · toplam ${transactions.length})`
                : ""}
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Sembol, hesap veya not ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="sm:w-44"
            >
              <SelectItem value="ALL">Tüm tipler</SelectItem>
              {TRANSACTION_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title={transactions.length === 0 ? "Henüz işlem yok" : "Sonuç bulunamadı"}
              description={
                transactions.length === 0
                  ? "Hızlı alış veya yeni işlem ile başlayın. Yanlış kayıtları sonra silebilirsiniz."
                  : "Arama veya filtreyi değiştirin."
              }
              actionLabel={transactions.length === 0 ? "İlk işlemi ekle" : undefined}
              onAction={transactions.length === 0 ? openAssetDialog : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Varlık</TableHead>
                    <TableHead>Adet</TableHead>
                    <TableHead>Fiyat</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Hesap</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTR(t.date)}</TableCell>
                      <TableCell>
                        <Badge variant={typeBadgeVariant(t.type)}>
                          {transactionTypeLabel(t.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[8rem]">
                          <p className="font-medium">{t.symbol ?? "Nakit"}</p>
                          {t.assetName && (
                            <p className="truncate text-xs text-muted-foreground">{t.assetName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(t.quantity, 2)}</TableCell>
                      <TableCell>{formatMoney(t.unitPrice)}</TableCell>
                      <TableCell>{formatMoney(t.grossAmount)}</TableCell>
                      <TableCell className="text-muted-foreground">{t.account}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(t)}
                            aria-label="Düzenle"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openDelete(t)}
                            aria-label="Sil"
                          >
                            <Trash2 className="h-4 w-4 text-negative" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yeni işlem */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl" onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>Yeni işlem</DialogTitle>
            <DialogDescription>
              Alış, satış, temettü veya nakit hareketi ekleyin. Sonra listeden düzenleyebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {renderFormFields(form, setForm, "create")}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Düzenle */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl" onClose={() => setEditOpen(false)}>
          <DialogHeader>
            <DialogTitle>İşlemi düzenle</DialogTitle>
            <DialogDescription>
              {editing
                ? `${transactionTypeLabel(editing.type)} · ${editing.symbol ?? "Nakit"} · ${formatDateTR(editing.date)}`
                : "Kayıt güncelle"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {renderFormFields(editForm, setEditForm, "edit")}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sil */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent onClose={() => setDeleteOpen(false)}>
          <DialogHeader>
            <DialogTitle>İşlemi sil?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `${formatDateTR(deleting.date)} tarihli ${transactionTypeLabel(deleting.type)} kaydı (${deleting.symbol ?? "Nakit"}) kalıcı olarak silinecek. Portföy hesapları bu tarihten itibaren yeniden hesaplanır.`
                : "Bu işlem geri alınamaz."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingBusy}
            >
              {deletingBusy ? "Siliniyor…" : "Evet, sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent onClose={() => setImportOpen(false)}>
          <DialogHeader>
            <DialogTitle>CSV içe aktar</DialogTitle>
            <DialogDescription>
              Sütunlar: tarih, sembol, tip, miktar, fiyat, komisyon
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Hesap</Label>
              <Select
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              >
                {meta.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <span className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-card px-4 text-sm hover:bg-muted">
                {importing ? "Aktarılıyor…" : "CSV dosyası seç"}
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
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {`tarih,sembol,tip,miktar,fiyat,komisyon\n2024-01-15,THYAO,BUY,100,285.50,2.50`}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hızlı alış */}
      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="max-w-xl" onClose={() => setAssetDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Hızlı alış</DialogTitle>
            <DialogDescription>
              Türü seçip kodunu girin; isim ve fiyat otomatik gelir. Adet girerseniz alış kaydı oluşur.
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
                  {lookupLoading ? "…" : "Getir"}
                </Button>
              </div>
            </div>

            {lookupResult && (
              <>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">{lookupResult.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{lookupResult.symbol}</span>
                    {lookupResult.exchange && <span>{lookupResult.exchange}</span>}
                    <span>{lookupResult.currency}</span>
                    {lookupResult.price && (
                      <span>
                        {lookupResult.price} {lookupResult.currency}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Hesap</Label>
                    <Select value={buyAccountId} onChange={(e) => setBuyAccountId(e.target.value)}>
                      {meta.accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tarih</Label>
                    <Input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
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
                    <Label>Birim fiyat ({lookupResult.currency})</Label>
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
                    <Label>Toplam</Label>
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
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAssetDialogOpen(false)}>
              İptal
            </Button>
            <Button type="button" onClick={handleAddAsset} disabled={!lookupResult || addingAsset}>
              {addingAsset
                ? "Ekleniyor…"
                : buyQty.trim() !== "" && Number(buyQty) > 0
                  ? "Alışı kaydet"
                  : "Varlığı ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
