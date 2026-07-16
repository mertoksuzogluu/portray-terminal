import Decimal from "decimal.js";

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 21,
});

export { Decimal };

export type DecimalInput = Decimal.Value | null | undefined;

export function d(value: DecimalInput = 0): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }
  return value instanceof Decimal ? value : new Decimal(value);
}

export function toNumber(value: DecimalInput, places = 8): number {
  return d(value).toDecimalPlaces(places).toNumber();
}

export function toFixed(value: DecimalInput, places = 2): string {
  return d(value).toFixed(places);
}

export function sum(values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((acc, value) => acc.plus(d(value)), d(0));
}

export function isZero(value: DecimalInput): boolean {
  return d(value).isZero();
}

export function clampMinZero(value: DecimalInput): Decimal {
  const v = d(value);
  return v.isNegative() ? d(0) : v;
}
