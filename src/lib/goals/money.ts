/** TR binlik ayraçlı tutar girişi yardımcıları */

export function formatTryInput(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

/** "25.000.000" veya "25000000" → sayı */
export function parseTryInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return NaN;
  return Number(digits);
}

export function describeTryAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1_000_000_000) {
    const b = value / 1_000_000_000;
    return `≈ ${trimNum(b)} milyar TL`;
  }
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `≈ ${trimNum(m)} milyon TL`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `≈ ${trimNum(k)} bin TL`;
  }
  return `${formatTryInput(value)} TL`;
}

function trimNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace(".", ",");
}
