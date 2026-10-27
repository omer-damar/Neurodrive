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
