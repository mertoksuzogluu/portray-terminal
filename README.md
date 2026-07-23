# Yatırım Portföyü

Türk yatırımcılar için kişisel portföy takip ve analiz uygulaması. Hisse, fon, döviz ve altın pozisyonlarınızı tek yerden izleyin; TWR, XIRR ve enflasyon düzeltmeli reel getiri hesaplarını görün.

> **Demo veri:** `npm run db:seed` komutu `demo@yatirim.local` / `demo1234` kullanıcısını ve 7 aylık örnek veriyi yükler. Tüm demo kayıtlar `[DEMO]` ile işaretlenir.

## Özellikler

- Çoklu portföy ve hesap yönetimi (Midas vb. aracı kurumlar)
- İşlem defteri: alış, satış, temettü, nakit giriş/çıkış
- Günlük snapshot'lar ve pozisyon takibi
- TWR (Time-Weighted Return) ve XIRR (Money-Weighted Return)
- TÜFE bazlı reel getiri hesabı
- BIST 100, USD/TRY, EUR/TRY, gram altın kıyaslamaları
- Uyarı kuralları ve otomatik analiz içgörüleri
- CSV ile toplu işlem içe aktarma
- Twelve Data (hisse/FX), TEFAS (fon), TCMB EVDS (enflasyon) entegrasyonları

## Gereksinimler

- Node.js 20+
- PostgreSQL (Supabase önerilir)
- npm veya pnpm

## Kurulum

```bash
git clone <repo-url> yatirim-portfoyu
cd yatirim-portfoyu
npm install
```

`.env` dosyasını oluşturun (`.env.example` yoksa aşağıdaki değişkenleri kullanın):

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL bağlantı URL'si |
| `DIRECT_URL` | Prisma migration için doğrudan bağlantı |
| `AUTH_SECRET` | Oturum JWT imzalama anahtarı |
| `CRON_SECRET` | Cron endpoint'leri için Bearer token |
| `TWELVE_DATA_API_KEY` | Hisse/FX fiyatları (opsiyonel) |
| `TCMB_EVDS_API_KEY` | TÜFE verisi (opsiyonel) |
| `NEXT_PUBLIC_APP_URL` | Uygulama URL'si |
| `DEMO_MODE` | `true` ise demo giriş aktif |

## Veritabanı

```bash
# Şemayı uygula
npm run db:push

# Demo veriyi yükle (idempotent — önce eski demo kullanıcıyı siler)
npm run db:seed
```

Formal migration klasörü: `prisma/migrations/20260101000000_init/`

## Geliştirme

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # TypeScript kontrolü
npm run test         # Vitest birim testleri
npm run test:watch   # Testleri izleme modunda
```

### Demo giriş bilgileri

| Alan | Değer |
|------|-------|
| E-posta | `demo@yatirim.local` |
| Şifre | `demo1234` |

Alternatif: `/api/auth/demo` endpoint'i ile tek tık demo oturumu.

## Build & Deploy

```bash
npm run build
npm start
```

Vercel'e deploy için `vercel.json` günlük cron görevlerini tanımlar:

| Cron | Saat (UTC) | Endpoint |
|------|------------|----------|
| Piyasa senkronizasyonu | 06:00 | `/api/cron/sync-market-data` |
| Snapshot oluşturma | 06:30 | `/api/cron/create-snapshots` |
| Rapor üretimi | 07:00 | `/api/cron/generate-reports` |

Cron istekleri şu header'lardan biriyle korunur:

```
Authorization: Bearer <CRON_SECRET>
# veya
x-cron-secret: <CRON_SECRET>
```

## Veri kaynakları

### Twelve Data
BIST hisseleri, USD/TRY, EUR/TRY ve altın fiyatları. **Ücretsiz (Basic) plan Türkiye/BIST borsasını kapsamaz** (Grow+ gerekir). Anahtar yoksa veya plan BIST’i desteklemiyorsa uygulama **Yahoo Finance** ile BIST/ABD hisse fiyatlarını çeker; FX/altın için Twelve Data anahtarı gerekir.

### TEFAS
Para piyasası ve yatırım fonları (ör. PBR). `tefasCode` alanı ile eşleştirilir.

### TCMB EVDS / TÜFE
Aylık TÜFE endeks değerleri enflasyon düzeltmesi için kullanılır. API anahtarı yoksa seed veya manuel veri kullanılır.

## Getiri metodolojisi (özet)

| Metrik | Açıklama |
|--------|----------|
| **TWR** | Dış nakit akışlarından arındırılmış günlük zincirleme getiri. Para yatırma/çekme günü Modified Dietz benzeri düzeltme uygulanır. |
| **XIRR** | Tüm nakit akışları + güncel portföy değeri üzerinden yıllıklandırılmış iç verim oranı (Newton-Raphson + bisection fallback). |
| **Reel getiri** | Her nakit girişi kendi tarihindeki TÜFE endeksinden bugüne taşınır; reel kâr = güncel değer − enflasyonlu sermaye. |

Detaylı formüller: [`docs/calculation-methodology.md`](docs/calculation-methodology.md)

## CSV içe aktarma

```bash
POST /api/import/csv/preview   # Önizleme + sütun eşleme önerisi
POST /api/import/csv/commit    # Onaylı içe aktarma
```

Desteklenen sütunlar: `tarih`, `sembol`, `tip`, `miktar`, `fiyat`, `komisyon`, `vergi`, `not`. Yinelenen işlemler SHA-256 hash ile tespit edilir.

## Proje yapısı

```
prisma/          Şema, migration, seed
src/
  app/api/       REST API (auth, cron, import, analytics)
  lib/
    calculations/  TWR, XIRR, risk, enflasyon (Decimal.js)
    services/      Snapshot, piyasa sync, CSV import
    insights/      Analiz kural motoru
    alerts/        Uyarı motoru
  tests/         Vitest birim testleri
docs/            Teknik metodoloji
```

## Lisans

Özel proje — ticari kullanım için izin gerekir.
