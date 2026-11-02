# Işın sayısı mı, ışın sıklığı mı?

- Eğitim: 60 nesil, nüfus 100; dönüşümlü koşulda pist her nesil değişir
- Koşul `r7-135`: 7 ışın, 135° (aralık 22,5°)
- Koşul `r9-135`: 9 ışın, 135° (aralık 16,9°)
- Koşul `r9-180`: 9 ışın, 180° (aralık 22,5°)
- Koşul `r7-101`: 7 ışın, 101,25° (aralık 16,9°)
- Şampiyon: her neslin elitleri arasından yalnızca kendi eğitim pistlerinde en iyi süren (test pistleri seçimde kullanılmaz)
- Test pistleri (hiçbir koşulda eğitimde yok): `triangle`, `horseshoe`, `square`, `snake`, `bean`
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Ölçüm: şampiyon her pisti öğrenmeden bir kez sürer (en fazla 3 tur, 60 sn); değerler ortalama ± standart sapma (örneklem)

| Koşul | Test pistlerinde ortalama tur | Bitirilen test pisti (koşu başına) | Eğitim pistlerinde ortalama tur |
|---|---|---|---|
| 7 ışın, 135° (aralık 22,5°) | 1.86 ± 0.19 | 3.1 ± 0.3 / 5 | 3.00 ± 0.00 |
| 9 ışın, 135° (aralık 16,9°) | 1.36 ± 0.23 | 2.1 ± 0.3 / 5 | 3.00 ± 0.00 |
| 9 ışın, 180° (aralık 22,5°) | 1.80 ± 0.00 | 3.0 ± 0.0 / 5 | 3.00 ± 0.00 |
| 7 ışın, 101,25° (aralık 16,9°) | 1.52 ± 0.23 | 2.3 ± 0.5 / 5 | 3.00 ± 0.00 |

| Test pisti | 7 ışın, 135° (aralık 22,5°) | 9 ışın, 135° (aralık 16,9°) | 9 ışın, 180° (aralık 22,5°) | 7 ışın, 101,25° (aralık 16,9°) |
|---|---|---|---|---|
| `triangle` | 0.30 ± 0.95 tur, 1/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `horseshoe` | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `square` | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `snake` | 3.00 ± 0.00 tur, 10/10 bitirdi | 0.80 ± 1.14 tur, 1/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 1.60 ± 1.17 tur, 3/10 bitirdi |
| `bean` | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |

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
| 7 ışın, 135° (aralık 22,5°) vs 9 ışın, 135° (aralık 16,9°) | +0.50 | < 0.001 | < 0.001 | +0.91 | büyük |
| 7 ışın, 135° (aralık 22,5°) vs 9 ışın, 180° (aralık 22,5°) | +0.06 | 1.000 | 1.000 | +0.10 | ihmal edilebilir |
| 7 ışın, 135° (aralık 22,5°) vs 7 ışın, 101,25° (aralık 16,9°) | +0.34 | 0.002 | 0.010 | +0.73 | büyük |
| 9 ışın, 135° (aralık 16,9°) vs 9 ışın, 180° (aralık 22,5°) | −0.44 | < 0.001 | < 0.001 | −0.90 | büyük |
| 9 ışın, 135° (aralık 16,9°) vs 7 ışın, 101,25° (aralık 16,9°) | −0.16 | 0.192 | 0.384 | −0.40 | orta |
| 9 ışın, 180° (aralık 22,5°) vs 7 ışın, 101,25° (aralık 16,9°) | +0.28 | 0.003 | 0.010 | +0.70 | büyük |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.

## Yarış süresi (ikincil ölçüt)

Her koşunun her koşulda bitirdiği görülmemiş pistler: `square`, `bean`. Bu pistlerde 3 turluk yarışın ortalama süresi (sn); düşük = daha hızlı sürüş.

| Koşul | Yarış süresi (sn) |
|---|---|
| 7 ışın, 135° (aralık 22,5°) | 25.20 ± 0.18 |
| 9 ışın, 135° (aralık 16,9°) | 25.17 ± 0.05 |
| 9 ışın, 180° (aralık 22,5°) | 25.22 ± 0.16 |
| 7 ışın, 101,25° (aralık 16,9°) | 25.20 ± 0.07 |

## Yarış süresinin anlamlılığı

Karşılaştırılan ölçüt: koşu başına ortak bitirilen pistlerdeki yarış süresi (sn). Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| 7 ışın, 135° (aralık 22,5°) vs 9 ışın, 135° (aralık 16,9°) | +0.03 | 0.614 | 1.000 | −0.14 | ihmal edilebilir |
| 7 ışın, 135° (aralık 22,5°) vs 9 ışın, 180° (aralık 22,5°) | −0.02 | 0.764 | 1.000 | −0.14 | ihmal edilebilir |
| 7 ışın, 135° (aralık 22,5°) vs 7 ışın, 101,25° (aralık 16,9°) | 0.00 | 1.000 | 1.000 | −0.24 | küçük |
| 9 ışın, 135° (aralık 16,9°) vs 9 ışın, 180° (aralık 22,5°) | −0.06 | 0.319 | 1.000 | +0.04 | ihmal edilebilir |
| 9 ışın, 135° (aralık 16,9°) vs 7 ışın, 101,25° (aralık 16,9°) | −0.03 | 0.278 | 1.000 | −0.32 | küçük |
| 9 ışın, 180° (aralık 22,5°) vs 7 ışın, 101,25° (aralık 16,9°) | +0.02 | 0.686 | 1.000 | −0.01 | ihmal edilebilir |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
