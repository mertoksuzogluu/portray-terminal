import { createHash } from "node:crypto";
import Papa from "papaparse";
import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const CSV_FIELD_ALIASES = {
  date: ["tarih", "date", "transactiondate", "islem_tarihi"],
  symbol: ["sembol", "symbol", "ticker", "hisse"],
  type: ["tip", "type", "transactiontype", "islem_tipi"],
  quantity: ["miktar", "quantity", "adet", "qty"],
  price: ["fiyat", "price", "unitprice", "birim_fiyat"],
  commission: ["komisyon", "commission", "fee"],
  tax: ["vergi", "tax"],
  notes: ["not", "notes", "aciklama", "description"],
} as const;

export type CsvFieldKey = keyof typeof CSV_FIELD_ALIASES;

export interface CsvColumnMapping {
  date: string;
  symbol: string;
  type: string;
  quantity: string;
  price: string;
  commission?: string;
  tax?: string;
  notes?: string;
}

export interface CsvImportRow {
  rowNumber: number;
  date: string;
  symbol: string;
  type: string;
  quantity: string;
  price: string;
  commission: string;
  tax: string;
  notes: string;
  raw: Record<string, string>;
}

export interface CsvValidationIssue {
  rowNumber: number;
  field?: string;
  message: string;
  severity: "error" | "warning";
}

export interface CsvPreviewRow {
  rowNumber: number;
  date: string;
  symbol: string;
  transactionType: TransactionType;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  commission: number;
  tax: number;
  notes: string | null;
  assetId: string | null;
  assetFound: boolean;
  importHash: string;
  isDuplicate: boolean;
  issues: CsvValidationIssue[];
}

export interface CsvPreviewResult {
  headers: string[];
  suggestedMapping: Partial<CsvColumnMapping>;
  rows: CsvPreviewRow[];
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  skippedCount: number;
}

export interface CsvCommitResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: CsvValidationIssue[];
}

const TYPE_MAP: Record<string, TransactionType> = {
  BUY: "BUY",
  ALIS: "BUY",
  ALIŞ: "BUY",
  SELL: "SELL",
  SAT: "SELL",
  SATIS: "SELL",
  SATIŞ: "SELL",
  DIVIDEND: "DIVIDEND",
  TEMETTU: "DIVIDEND",
  TEMETTÜ: "DIVIDEND",
  CASH_DEPOSIT: "CASH_DEPOSIT",
  PARA_YATIRMA: "CASH_DEPOSIT",
  CASH_WITHDRAWAL: "CASH_WITHDRAWAL",
  PARA_CEKME: "CASH_WITHDRAWAL",
  COMMISSION: "COMMISSION",
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function findColumn(headers: string[], aliases: readonly string[]): string | undefined {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const alias of aliases) {
    const match = normalized.find((h) => h.norm === alias);
    if (match) return match.raw;
  }
  return undefined;
}

export function suggestColumnMapping(headers: string[]): Partial<CsvColumnMapping> {
  return {
    date: findColumn(headers, CSV_FIELD_ALIASES.date),
    symbol: findColumn(headers, CSV_FIELD_ALIASES.symbol),
    type: findColumn(headers, CSV_FIELD_ALIASES.type),
    quantity: findColumn(headers, CSV_FIELD_ALIASES.quantity),
    price: findColumn(headers, CSV_FIELD_ALIASES.price),
    commission: findColumn(headers, CSV_FIELD_ALIASES.commission),
    tax: findColumn(headers, CSV_FIELD_ALIASES.tax),
    notes: findColumn(headers, CSV_FIELD_ALIASES.notes),
  };
}

export function parseCsvText(text: string): { headers: string[]; data: Record<string, string>[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV ayrıştırma hatası (satır ${first.row ?? "?"}): ${first.message}`);
  }

  const headers = parsed.meta.fields ?? [];
  return { headers, data: parsed.data };
}

function getMappedValue(
  row: Record<string, string>,
  mapping: Partial<CsvColumnMapping>,
  key: CsvFieldKey
): string {
  const column = mapping[key];
  if (!column) return "";
  return (row[column] ?? "").trim();
}

export function sanitizeNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const cleaned = notes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 500);
  return cleaned.length > 0 ? cleaned : null;
}

function parseTransactionType(raw: string): TransactionType | null {
  const key = raw.trim().toUpperCase().replace(/\s+/g, "_");
  return TYPE_MAP[key] ?? null;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const tr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;
  if (iso.test(value)) {
    const d = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = value.match(tr);
  if (m) {
    const [, day, month, year] = m;
    const d = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function buildImportHash(params: {
  portfolioId: string;
  accountId: string;
  symbol: string;
  date: string;
  type: string;
  quantity: string;
  price: string;
}): string {
  const payload = [
    params.portfolioId,
    params.accountId,
    params.symbol,
    params.date,
    params.type,
    params.quantity,
    params.price,
  ].join(":");
  return createHash("sha256").update(payload).digest("hex");
}

function validateRow(
  row: CsvImportRow,
  mapping: Partial<CsvColumnMapping>
): { issues: CsvValidationIssue[]; txType: TransactionType | null; parsedDate: Date | null } {
  const issues: CsvValidationIssue[] = [];

  if (!mapping.date || !mapping.symbol || !mapping.type || !mapping.quantity || !mapping.price) {
    issues.push({
      rowNumber: row.rowNumber,
      message: "Zorunlu sütun eşlemesi eksik.",
      severity: "error",
    });
    return { issues, txType: null, parsedDate: null };
  }

  const txType = parseTransactionType(row.type);
  if (!txType) {
    issues.push({
      rowNumber: row.rowNumber,
      field: "type",
      message: `Geçersiz işlem tipi: ${row.type}`,
      severity: "error",
    });
  }

  const parsedDate = parseDate(row.date);
  if (!parsedDate) {
    issues.push({
      rowNumber: row.rowNumber,
      field: "date",
      message: `Geçersiz tarih: ${row.date}`,
      severity: "error",
    });
  }

  const qty = Number(row.quantity.replace(",", "."));
  if (!Number.isFinite(qty) || qty <= 0) {
    if (txType !== "CASH_DEPOSIT" && txType !== "CASH_WITHDRAWAL") {
      issues.push({
        rowNumber: row.rowNumber,
        field: "quantity",
        message: "Miktar sıfırdan büyük olmalı.",
        severity: "error",
      });
    }
  }

  const price = Number(row.price.replace(",", "."));
  if (!Number.isFinite(price) || price < 0) {
    issues.push({
      rowNumber: row.rowNumber,
      field: "price",
      message: "Fiyat geçersiz.",
      severity: "error",
    });
  }

  return { issues, txType, parsedDate };
}

export async function previewCsvImport(params: {
  portfolioId: string;
  accountId: string;
  csvText: string;
  columnMapping?: Partial<CsvColumnMapping>;
}): Promise<CsvPreviewResult> {
  const { headers, data } = parseCsvText(params.csvText);
  const mapping = { ...suggestColumnMapping(headers), ...params.columnMapping };

  const assets = await prisma.asset.findMany({
    where: { isActive: true },
    select: { id: true, symbol: true },
  });
  const assetMap = new Map(assets.map((a) => [a.symbol.toUpperCase(), a.id]));

  const existingHashes = new Set(
    (
      await prisma.transaction.findMany({
        where: { portfolioId: params.portfolioId, importHash: { not: null } },
        select: { importHash: true },
      })
    )
      .map((t) => t.importHash)
      .filter((h): h is string => Boolean(h))
  );

  const rows: CsvPreviewRow[] = [];
  let validCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  let skippedCount = 0;

  data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const importRow: CsvImportRow = {
      rowNumber,
      date: getMappedValue(raw, mapping, "date"),
      symbol: getMappedValue(raw, mapping, "symbol").toUpperCase(),
      type: getMappedValue(raw, mapping, "type"),
      quantity: getMappedValue(raw, mapping, "quantity"),
      price: getMappedValue(raw, mapping, "price"),
      commission: getMappedValue(raw, mapping, "commission"),
      tax: getMappedValue(raw, mapping, "tax"),
      notes: getMappedValue(raw, mapping, "notes"),
      raw,
    };

    if (!importRow.date && !importRow.symbol && !importRow.quantity) {
      skippedCount += 1;
      return;
    }

    const { issues, txType, parsedDate } = validateRow(importRow, mapping);
    const assetId = importRow.symbol ? assetMap.get(importRow.symbol) ?? null : null;

    if (importRow.symbol && !assetId && txType !== "CASH_DEPOSIT" && txType !== "CASH_WITHDRAWAL") {
      issues.push({
        rowNumber,
        field: "symbol",
        message: `Varlık bulunamadı: ${importRow.symbol}`,
        severity: "error",
      });
    }

    const qty = Number(importRow.quantity.replace(",", ".")) || 0;
    const unitPrice = Number(importRow.price.replace(",", ".")) || 0;
    const commission = Number(importRow.commission.replace(",", ".")) || 0;
    const tax = Number(importRow.tax.replace(",", ".")) || 0;
    const grossAmount =
      txType === "CASH_DEPOSIT" || txType === "CASH_WITHDRAWAL"
        ? unitPrice || qty
        : qty * unitPrice;

    const importHash = buildImportHash({
      portfolioId: params.portfolioId,
      accountId: params.accountId,
      symbol: importRow.symbol || "CASH",
      date: parsedDate ? parsedDate.toISOString().slice(0, 10) : importRow.date,
      type: txType ?? importRow.type,
      quantity: String(qty),
      price: String(unitPrice),
    });

    const isDuplicate = existingHashes.has(importHash);
    if (isDuplicate) duplicateCount += 1;

    const hasErrors = issues.some((i) => i.severity === "error") || !txType || !parsedDate;
    if (hasErrors) {
      errorCount += 1;
    } else if (!isDuplicate) {
      validCount += 1;
    }

    rows.push({
      rowNumber,
      date: parsedDate ? parsedDate.toISOString().slice(0, 10) : importRow.date,
      symbol: importRow.symbol,
      transactionType: txType ?? "OTHER",
      quantity: qty,
      unitPrice,
      grossAmount,
      commission,
      tax,
      notes: sanitizeNotes(importRow.notes),
      assetId,
      assetFound: Boolean(assetId),
      importHash,
      isDuplicate,
      issues,
    });
  });

  return {
    headers,
    suggestedMapping: mapping,
    rows,
    validCount,
    errorCount,
    duplicateCount,
    skippedCount,
  };
}

export async function commitCsvImport(params: {
  portfolioId: string;
  accountId: string;
  csvText: string;
  columnMapping?: Partial<CsvColumnMapping>;
  skipDuplicates?: boolean;
}): Promise<CsvCommitResult> {
  const preview = await previewCsvImport(params);
  const skipDuplicates = params.skipDuplicates ?? true;

  let imported = 0;
  let skipped = preview.skippedCount;
  let duplicates = 0;
  const errors: CsvValidationIssue[] = [];

  for (const row of preview.rows) {
    if (row.issues.some((i) => i.severity === "error")) {
      errors.push(...row.issues.filter((i) => i.severity === "error"));
      skipped += 1;
      continue;
    }

    if (row.isDuplicate && skipDuplicates) {
      duplicates += 1;
      skipped += 1;
      continue;
    }

    const txDate = new Date(`${row.date}T00:00:00.000Z`);
    const isCash =
      row.transactionType === "CASH_DEPOSIT" ||
      row.transactionType === "CASH_WITHDRAWAL";

    await prisma.transaction.create({
      data: {
        portfolioId: params.portfolioId,
        accountId: params.accountId,
        assetId: isCash ? null : row.assetId,
        transactionType: row.transactionType,
        transactionDate: txDate,
        quantity: new Prisma.Decimal(isCash ? 1 : row.quantity),
        unitPrice: new Prisma.Decimal(isCash ? row.grossAmount : row.unitPrice),
        grossAmount: new Prisma.Decimal(row.grossAmount),
        commission: new Prisma.Decimal(row.commission),
        tax: new Prisma.Decimal(row.tax),
        currency: "TRY",
        notes: row.notes,
        importHash: row.importHash,
      },
    });
    imported += 1;
  }

  return { imported, skipped, duplicates, errors };
}
