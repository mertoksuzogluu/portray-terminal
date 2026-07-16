# Hesaplama Metodolojisi

Bu belge `src/lib/calculations/` altındaki finansal hesaplama modüllerinin teknik tanımını içerir. Tüm hesaplamalar [Decimal.js](https://mikemcl.github.io/decimal.js/) ile yapılır; `number` yalnızca test ve API sınırında kullanılır.

## 1. Pozisyon ve maliyet (Weighted Average)

### Ortalama maliyet

Alış işleminde:

```
tradeCost = quantity × unitPrice + commission + tax + otherCost
newQuantity = prevQuantity + quantity
newTotalCost = prevTotalCost + tradeCost
averageCost = newTotalCost / newQuantity
```

Satışta maliyet bazı:

```
costBasis = averageCost × sellQuantity
proceeds = sellQuantity × unitPrice − commission − tax − otherCost
realizedAmount = proceeds − costBasis
```

Kalan pozisyon maliyeti ağırlıklı ortalama yöntemiyle düşülür. **Kısa pozisyon (negatif adet) desteklenmez.**

### Kurumsal olaylar

| Olay | Etki |
|------|------|
| Bedelsiz (bonus) | Adet artar, toplam maliyet sabit → ortalama maliyet düşer |
| Split | `newQty = oldQty × ratio`, maliyet sabit |
| Temettü | Nakit akışı; pozisyon adedi değişmez |

## 2. Time-Weighted Return (TWR)

Günlük TWR faktörü (Modified Dietz benzeri, nakit akışı gün başında):

```
factor_d = endValue / (beginValue + externalCashFlow_d)
dailyReturn_d = factor_d − 1
```

- `externalCashFlow > 0`: para girişi (yatırma)
- `externalCashFlow < 0`: para çıkışı (çekme)
- `beginValue = 0` ve `externalCashFlow > 0`: ilk gün faktörü `endValue / externalCashFlow`

Kümülatif TWR:

```
TWR_cumulative = ∏(1 + dailyReturn_d) − 1
```

`chainTwr(dailyFactors)` fonksiyonu günlük faktörleri doğrudan çarpar.

### Ne zaman kullanılır?

TWR, portföy yöneticisinin performansını ölçer; yatırımcının para giriş/çıkış zamanlamasından bağımsızdır.

## 3. XIRR (Money-Weighted Return)

Nakit akışları `(t_i, CF_i)` için NPV:

```
NPV(r) = Σ CF_i / (1 + r)^(yearFraction(t_0, t_i))
```

`yearFraction` = gerçek gün farkı / 365.25.

Çözüm: Newton-Raphson (max 100 iterasyon, tolerans 1e-7). Türev sıfıra yakınsa veya yakınsama başarısızsa **bisection fallback** (−0.9999 … 10 aralığı, genişletme ile).

Portföy akışları (`buildPortfolioXirrFlows`):

| Olay | İşaret |
|------|--------|
| Yatırma / alış finansmanı | Negatif |
| Çekme / satış tahsilatı | Pozitif |
| Güncel portföy değeri (son akış) | Pozitif |

Sonuç yıllıklandırılmış orandır (0.25 = %25).

## 4. Enflasyon ve reel getiri

### Endeks taşıma

```
inflatedAmount = amount × (toIndex / fromIndex)
```

Her pozitif nakit girişi, işlem ayındaki TÜFE endeksinden (`findIndexAtPeriod`) değerlendirme ayına taşınır. Eksik ay için son bilinen endeks kullanılır (`isEstimated = true`).

### Reel getiri

```
inflationAdjustedCapital = Σ inflated(cashFlow_i)
realProfit = currentValue − inflationAdjustedCapital
realReturn = realProfit / inflationAdjustedCapital
```

`purchasingPowerGap = inflationAdjustedCapital − nominalContributions` nominal ile reel sermaye farkını gösterir.

## 5. Risk metrikleri

Tüm günlük getiri serileri TWR veya basit günlük getiriden türetilir.

| Metrik | Formül |
|--------|--------|
| Günlük volatilite | Örnek std. sapma (n−1) |
| Yıllık volatilite | `σ_daily × √252` |
| Sharpe | `(μ_daily × 252 − rf_annual) / σ_annual` |
| Sortino | `(μ_daily × 252 − rf_annual) / σ_downside_annual` |
| Max drawdown | `max((peak − value) / peak)` |
| Beta | `Cov(r_p, r_b) / Var(r_b)` |
| HHI | `Σ w_i²` (yoğunlaşma) |

Minimum gözlem: 5 işlem günü (`MIN_OBS`).

## 6. Katkı analizi

Varlık `i` nin portföy getirisine katkısı:

```
contribution_i = weight_i × return_i
```

Yüzde puan cinsinden: `weight × return × 100`.

`analyzeContributions` varlıkları katkıya göre sıralar; en iyi ve en kötü katkı sağlayıcıları belirler.

## 7. Aylık getiri istatistikleri

| Metrik | Tanım |
|--------|-------|
| Aritmetik ortalama | `Σ r_m / n` |
| Geometrik ortalama | `(∏(1 + r_m))^(1/n) − 1` |
| Bileşik toplam | `∏(1 + r_m) − 1` |

Geometrik ortalama, herhangi bir `1 + r_m ≤ 0` ise `null` döner.

## 8. Veri kalitesi ve eksik fiyat

- Snapshot oluşturulurken fiyat yoksa **ortalama maliyet** piyasa fiyatı yerine geçer.
- `totalReturnRatio`: maliyet sıfır ve realize kazanç yoksa `null`.
- Sıfır portföyde konsantrasyon ve TWR metrikleri `null` döner.

## 9. Test kapsamı

`src/tests/calculations.test.ts` dosyası yukarıdaki modüllerin birim testlerini içerir. Çalıştırma:

```bash
npm run test
```

## Referanslar

- CFA Institute — Global Investment Performance Standards (GIPS), TWR vs MWR
- Modified Dietz method (simplified daily TWR)
- XIRR: Microsoft Excel `XIRR` eşdeğeri
