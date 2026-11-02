# Aynı bütçede nüfus mu, nesil mi?

- Eğitim: nesil ve nüfus koşula göre (koşul adlarında); dönüşümlü koşulda pist her nesil değişir
- Koşul `pop-50`: 50 araba × 120 nesil
- Koşul `pop-100`: 100 araba × 60 nesil
- Koşul `pop-200`: 200 araba × 30 nesil
- Şampiyon: her neslin elitleri arasından yalnızca kendi eğitim pistlerinde en iyi süren (test pistleri seçimde kullanılmaz)
- Test pistleri (hiçbir koşulda eğitimde yok): `triangle`, `horseshoe`, `square`, `snake`, `bean`
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Ölçüm: şampiyon her pisti öğrenmeden bir kez sürer (en fazla 3 tur, 60 sn); değerler ortalama ± standart sapma (örneklem)

| Koşul | Test pistlerinde ortalama tur | Bitirilen test pisti (koşu başına) | Eğitim pistlerinde ortalama tur |
|---|---|---|---|
| 50 araba × 120 nesil | 1.74 ± 0.19 | 2.9 ± 0.3 / 5 | 3.00 ± 0.00 |
| 100 araba × 60 nesil | 1.86 ± 0.19 | 3.1 ± 0.3 / 5 | 3.00 ± 0.00 |
| 200 araba × 30 nesil | 1.86 ± 0.19 | 3.1 ± 0.3 / 5 | 3.00 ± 0.00 |

| Test pisti | 50 araba × 120 nesil | 100 araba × 60 nesil | 200 araba × 30 nesil |
|---|---|---|---|
| `triangle` | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.30 ± 0.95 tur, 1/10 bitirdi | 0.30 ± 0.95 tur, 1/10 bitirdi |
| `horseshoe` | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `square` | 2.70 ± 0.95 tur, 9/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `snake` | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `bean` | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |

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
| 50 araba × 120 nesil vs 100 araba × 60 nesil | −0.12 | 0.526 | 1.000 | −0.19 | küçük |
| 50 araba × 120 nesil vs 200 araba × 30 nesil | −0.12 | 0.526 | 1.000 | −0.19 | küçük |
| 100 araba × 60 nesil vs 200 araba × 30 nesil | 0.00 | 1.000 | 1.000 | 0.00 | ihmal edilebilir |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.

## Yarış süresi (ikincil ölçüt)

Her koşunun her koşulda bitirdiği görülmemiş pistler: `snake`, `bean`. Bu pistlerde 3 turluk yarışın ortalama süresi (sn); düşük = daha hızlı sürüş.

| Koşul | Yarış süresi (sn) |
|---|---|
| 50 araba × 120 nesil | 24.62 ± 0.03 |
| 100 araba × 60 nesil | 24.76 ± 0.18 |
| 200 araba × 30 nesil | 25.03 ± 0.17 |

## Yarış süresinin anlamlılığı

Karşılaştırılan ölçüt: koşu başına ortak bitirilen pistlerdeki yarış süresi (sn). Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| 50 araba × 120 nesil vs 100 araba × 60 nesil | −0.14 | 0.016 | 0.016 | −0.54 | büyük |
| 50 araba × 120 nesil vs 200 araba × 30 nesil | −0.41 | < 0.001 | < 0.001 | −1.00 | büyük |
| 100 araba × 60 nesil vs 200 araba × 30 nesil | −0.27 | 0.004 | 0.009 | −0.73 | büyük |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
