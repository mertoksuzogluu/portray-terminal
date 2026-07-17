/**
 * Resmi TÜFE (2025=100) — TCMB/TÜİK aylık ve yıllık değişimlerden
 * geriye doğru endeks seviyesi türetildi (Haziran 2026 = 129,99).
 *
 * TCMB EVDS anahtarı yokken bootstrap / senkron fallback olarak kullanılır.
 * Anahtar eklendiğinde canlı EVDS serisi bunu geçersiz kılar.
 *
 * Kaynak: TCMB Tüketici Fiyatları tablosu (aylık % / yıllık %).
 */
export interface OfficialTufeRow {
  period: string; // YYYY-MM
  indexValue: number;
  monthlyRate: number; // oran, örn. 0.0099 = %0,99
  annualRate: number; // oran, örn. 0.3211 = %32,11
}

export const OFFICIAL_TUFE_SERIES: OfficialTufeRow[] = [
  { period: "2024-06", indexValue: 72.8607, monthlyRate: 0.0164, annualRate: 0.716 },
  { period: "2024-07", indexValue: 75.2141, monthlyRate: 0.0323, annualRate: 0.6178 },
  { period: "2024-08", indexValue: 77.0718, monthlyRate: 0.0247, annualRate: 0.5197 },
  { period: "2024-09", indexValue: 79.3609, monthlyRate: 0.0297, annualRate: 0.4938 },
  { period: "2024-10", indexValue: 81.6465, monthlyRate: 0.0288, annualRate: 0.4858 },
  { period: "2024-11", indexValue: 83.4754, monthlyRate: 0.0224, annualRate: 0.4709 },
  { period: "2024-12", indexValue: 84.3351, monthlyRate: 0.0103, annualRate: 0.4438 },
  { period: "2025-01", indexValue: 88.5772, monthlyRate: 0.0503, annualRate: 0.4212 },
  { period: "2025-02", indexValue: 90.5879, monthlyRate: 0.0227, annualRate: 0.3905 },
  { period: "2025-03", indexValue: 92.8164, monthlyRate: 0.0246, annualRate: 0.381 },
  { period: "2025-04", indexValue: 95.6009, monthlyRate: 0.03, annualRate: 0.3786 },
  { period: "2025-05", indexValue: 97.0636, monthlyRate: 0.0153, annualRate: 0.3541 },
  { period: "2025-06", indexValue: 98.3933, monthlyRate: 0.0137, annualRate: 0.3505 },
  { period: "2025-07", indexValue: 100.4202, monthlyRate: 0.0206, annualRate: 0.3352 },
  { period: "2025-08", indexValue: 102.4688, monthlyRate: 0.0204, annualRate: 0.3295 },
  { period: "2025-09", indexValue: 105.7785, monthlyRate: 0.0323, annualRate: 0.3329 },
  { period: "2025-10", indexValue: 108.4759, monthlyRate: 0.0255, annualRate: 0.3287 },
  { period: "2025-11", indexValue: 109.4196, monthlyRate: 0.0087, annualRate: 0.3107 },
  { period: "2025-12", indexValue: 110.3935, monthlyRate: 0.0089, annualRate: 0.3089 },
  { period: "2026-01", indexValue: 115.7365, monthlyRate: 0.0484, annualRate: 0.3065 },
  { period: "2026-02", indexValue: 119.1623, monthlyRate: 0.0296, annualRate: 0.3153 },
  { period: "2026-03", indexValue: 121.4741, monthlyRate: 0.0194, annualRate: 0.3087 },
  { period: "2026-04", indexValue: 126.5517, monthlyRate: 0.0418, annualRate: 0.3237 },
  { period: "2026-05", indexValue: 128.7157, monthlyRate: 0.0171, annualRate: 0.3261 },
  { period: "2026-06", indexValue: 129.99, monthlyRate: 0.0099, annualRate: 0.3211 },
];
