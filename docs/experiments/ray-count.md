# Kaç sensör gerekli? Işın sayısı ve öğrenme hızı

- Pist: `technical`, nüfus 100, 50 nesil
- Değişken: `rayCount` ∈ {3, 5, 7, 9}
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Değerler: ortalama ± standart sapma (örneklem)

| Koşul | İlk tura kadar nesil | Hiç tur atamayan koşu | En iyi tur (sn) | Son nesil en iyi fitness |
|---|---|---|---|---|
| 3 ışın | 26.9 ± 9.8 | 3 / 10 | 12.28 ± 1.24 | 2.441 ± 1.495 |
| 5 ışın | 8.4 ± 3.0 | 0 / 10 | 9.00 ± 0.04 | 3.544 ± 0.002 |
| 7 ışın | 8.4 ± 4.2 | 0 / 10 | 8.74 ± 0.03 | 3.556 ± 0.001 |
| 9 ışın | 7.5 ± 4.5 | 0 / 10 | 8.71 ± 0.05 | 3.558 ± 0.002 |

## Anlamlılık

Karşılaştırılan ölçüt: ilk tura kadar geçen nesil (hiç tur atamayan koşular dışarıda). Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| 3 ışın vs 5 ışın | +18.5 | < 0.001 | < 0.001 | +0.99 | büyük |
| 3 ışın vs 7 ışın | +18.5 | < 0.001 | < 0.001 | +0.94 | büyük |
| 3 ışın vs 9 ışın | +19.4 | < 0.001 | < 0.001 | +1.00 | büyük |
| 5 ışın vs 7 ışın | 0.0 | 1.000 | 1.000 | +0.05 | ihmal edilebilir |
| 5 ışın vs 9 ışın | +0.9 | 0.642 | 1.000 | +0.07 | ihmal edilebilir |
| 7 ışın vs 9 ışın | +0.9 | 0.683 | 1.000 | +0.10 | ihmal edilebilir |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
