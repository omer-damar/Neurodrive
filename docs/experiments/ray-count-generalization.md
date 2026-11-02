# Kaç sensör gerekli? Işın sayısı ve genelleme

- Eğitim: 60 nesil, nüfus 100; dönüşümlü koşulda pist her nesil değişir
- Koşul `rays-3`: 3 ışın
- Koşul `rays-5`: 5 ışın
- Koşul `rays-7`: 7 ışın
- Koşul `rays-9`: 9 ışın
- Şampiyon: her neslin elitleri arasından yalnızca kendi eğitim pistlerinde en iyi süren (test pistleri seçimde kullanılmaz)
- Test pistleri (hiçbir koşulda eğitimde yok): `triangle`, `horseshoe`, `square`, `snake`, `bean`
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Ölçüm: şampiyon her pisti öğrenmeden bir kez sürer (en fazla 3 tur, 60 sn); değerler ortalama ± standart sapma (örneklem)

| Koşul | Test pistlerinde ortalama tur | Bitirilen test pisti (koşu başına) | Eğitim pistlerinde ortalama tur |
|---|---|---|---|
| 3 ışın | 1.18 ± 1.12 | 1.4 ± 1.9 / 5 | 1.83 ± 0.76 |
| 5 ışın | 1.80 ± 0.00 | 3.0 ± 0.0 / 5 | 3.00 ± 0.00 |
| 7 ışın | 1.86 ± 0.19 | 3.1 ± 0.3 / 5 | 3.00 ± 0.00 |
| 9 ışın | 1.36 ± 0.23 | 2.1 ± 0.3 / 5 | 3.00 ± 0.00 |

| Test pisti | 3 ışın | 5 ışın | 7 ışın | 9 ışın |
|---|---|---|---|---|
| `triangle` | 1.00 ± 1.33 tur, 2/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.30 ± 0.95 tur, 1/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `horseshoe` | 1.00 ± 1.25 tur, 2/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `square` | 1.50 ± 1.43 tur, 4/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `snake` | 1.20 ± 1.40 tur, 3/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 0.80 ± 1.14 tur, 1/10 bitirdi |
| `bean` | 1.20 ± 1.40 tur, 3/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |

En keskin virajlar (≈ 480 birimlik yayda toplam yön değişimi, radyan; sağ +, sol −):

| Pist | Kullanım | En keskin sağ | En keskin sol |
|---|---|---|---|
| `oval` | eğitim | 1.26 | 0.00 |
| `classic` | eğitim | 1.15 | -0.82 |
| `technical` | eğitim | 1.67 | -1.38 |
| `triangle` | test | 1.76 | -0.05 |
| `horseshoe` | test | 1.17 | -2.17 |
| `square` | test | 1.09 | -0.05 |
| `snake` | test | 1.25 | -1.22 |
| `bean` | test | 1.06 | -0.87 |

## Anlamlılık

Karşılaştırılan ölçüt: koşu başına görülmemiş pistlerdeki ortalama tur. Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| 3 ışın vs 5 ışın | −0.62 | 0.093 | 0.297 | −0.20 | küçük |
| 3 ışın vs 7 ışın | −0.68 | 0.074 | 0.297 | −0.24 | küçük |
| 3 ışın vs 9 ışın | −0.18 | 0.659 | 1.000 | −0.08 | ihmal edilebilir |
| 5 ışın vs 7 ışın | −0.06 | 1.000 | 1.000 | −0.10 | ihmal edilebilir |
| 5 ışın vs 9 ışın | +0.44 | < 0.001 | < 0.001 | +0.90 | büyük |
| 7 ışın vs 9 ışın | +0.50 | < 0.001 | < 0.001 | +0.91 | büyük |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
