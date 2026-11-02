# Yüksek mutasyon oranları: fazlası zarar veriyor mu?

- Pist: `technical`, nüfus 100, 50 nesil
- Değişken: `mutationRate` ∈ {0.3, 0.5, 0.8}
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Değerler: ortalama ± standart sapma (örneklem)

| Koşul | İlk tura kadar nesil | Hiç tur atamayan koşu | En iyi tur (sn) | Son nesil en iyi fitness |
|---|---|---|---|---|
| oran 0.3 | 5.7 ± 2.2 | 0 / 10 | 8.73 ± 0.02 | 3.557 ± 0.001 |
| oran 0.5 | 6.3 ± 2.3 | 0 / 10 | 8.72 ± 0.02 | 3.557 ± 0.001 |
| oran 0.8 | 5.4 ± 2.4 | 0 / 10 | 8.73 ± 0.02 | 3.557 ± 0.001 |

## Anlamlılık

Karşılaştırılan ölçüt: ilk tura kadar geçen nesil. Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| oran 0.3 vs oran 0.5 | −0.6 | 0.624 | 1.000 | −0.17 | küçük |
| oran 0.3 vs oran 0.8 | +0.3 | 0.846 | 1.000 | +0.11 | ihmal edilebilir |
| oran 0.5 vs oran 0.8 | +0.9 | 0.452 | 1.000 | +0.29 | küçük |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
