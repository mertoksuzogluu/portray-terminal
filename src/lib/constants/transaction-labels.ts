export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  BUY: "Alış",
  SELL: "Satış",
  DIVIDEND: "Temettü",
  FUND_DISTRIBUTION: "Fon dağıtımı",
  COMMISSION: "Komisyon",
  TAX: "Vergi",
  CASH_DEPOSIT: "Nakit yatırma",
  CASH_WITHDRAWAL: "Nakit çekme",
  TRANSFER_IN: "Transfer giriş",
  TRANSFER_OUT: "Transfer çıkış",
  BONUS_ISSUE: "Bedelsiz",
  RIGHTS_ISSUE: "Rüçhan",
  SPLIT: "Bölünme",
  OTHER: "Diğer",
};

export const TRANSACTION_TYPE_OPTIONS = [
  { value: "BUY", label: "Alış" },
  { value: "SELL", label: "Satış" },
  { value: "DIVIDEND", label: "Temettü" },
  { value: "CASH_DEPOSIT", label: "Nakit yatırma" },
  { value: "CASH_WITHDRAWAL", label: "Nakit çekme" },
] as const;

export function transactionTypeLabel(type: string): string {
  return TRANSACTION_TYPE_LABELS[type] ?? type;
}
