# Mutasyon oranının öğrenmeye etkisi

- Pist: `technical`, nüfus 100, 50 nesil
- Değişken: `mutationRate` ∈ {0.05, 0.1, 0.3}
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Değerler: ortalama ± standart sapma (örneklem)

| Koşul | İlk tura kadar nesil | Hiç tur atamayan koşu | En iyi tur (sn) | Son nesil en iyi fitness |
|---|---|---|---|---|
| oran 0.05 | 10.1 ± 4.6 | 0 / 10 | 8.75 ± 0.03 | 3.556 ± 0.002 |
| oran 0.1 | 8.4 ± 4.2 | 0 / 10 | 8.74 ± 0.03 | 3.556 ± 0.001 |
| oran 0.3 | 5.7 ± 2.2 | 0 / 10 | 8.73 ± 0.02 | 3.557 ± 0.001 |

## Anlamlılık

Karşılaştırılan ölçüt: ilk tura kadar geçen nesil. Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| oran 0.05 vs oran 0.1 | +1.7 | 0.424 | 0.424 | +0.23 | küçük |
| oran 0.05 vs oran 0.3 | +4.4 | 0.015 | 0.044 | +0.61 | büyük |
| oran 0.1 vs oran 0.3 | +2.7 | 0.106 | 0.211 | +0.36 | orta |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
