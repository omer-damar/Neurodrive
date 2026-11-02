# Keskin viraj görmek genellemeyi değiştiriyor mu?

- Eğitim: 60 nesil, nüfus 100; dönüşümlü koşulda pist her nesil değişir
- Koşul `mild`: Presetler + yumuşak virajlı pist
- Koşul `sharp`: Presetler + keskin virajlı pist
- Şampiyon: her neslin elitleri arasından yalnızca kendi eğitim pistlerinde en iyi süren (test pistleri seçimde kullanılmaz)
- Test pistleri (hiçbir koşulda eğitimde yok): `triangle`, `horseshoe`, `square`, `snake`, `bean`
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Ölçüm: şampiyon her pisti öğrenmeden bir kez sürer (en fazla 3 tur, 60 sn); değerler ortalama ± standart sapma (örneklem)

| Koşul | Test pistlerinde ortalama tur | Bitirilen test pisti (koşu başına) | Eğitim pistlerinde ortalama tur |
|---|---|---|---|
| Presetler + yumuşak virajlı pist | 1.80 ± 0.00 | 3.0 ± 0.0 / 5 | 3.00 ± 0.00 |
| Presetler + keskin virajlı pist | 2.54 ± 0.68 | 4.2 ± 1.2 / 5 | 2.92 ± 0.24 |

| Test pisti | Presetler + yumuşak virajlı pist | Presetler + keskin virajlı pist |
|---|---|---|
| `triangle` | 0.00 ± 0.00 tur, 0/10 bitirdi | 2.50 ± 1.08 tur, 8/10 bitirdi |
| `horseshoe` | 0.00 ± 0.00 tur, 0/10 bitirdi | 1.80 ± 1.55 tur, 6/10 bitirdi |
| `square` | 3.00 ± 0.00 tur, 10/10 bitirdi | 2.70 ± 0.95 tur, 9/10 bitirdi |
| `snake` | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `bean` | 3.00 ± 0.00 tur, 10/10 bitirdi | 2.70 ± 0.95 tur, 9/10 bitirdi |

En keskin virajlar (≈ 480 birimlik yayda toplam yön değişimi, radyan; sağ +, sol −):

| Pist | Kullanım | En keskin sağ | En keskin sol |
|---|---|---|---|
| `oval` | eğitim | 1.26 | 0.00 |
| `classic` | eğitim | 1.15 | -0.82 |
| `technical` | eğitim | 1.67 | -1.38 |
| `mild` | eğitim | 1.12 | -0.37 |
| `sharp` | eğitim | 1.73 | -2.18 |
| `triangle` | test | 1.76 | -0.05 |
| `horseshoe` | test | 1.17 | -2.17 |
| `square` | test | 1.09 | -0.05 |
| `snake` | test | 1.25 | -1.22 |
| `bean` | test | 1.06 | -0.87 |

## Anlamlılık

Karşılaştırılan ölçüt: koşu başına görülmemiş pistlerdeki ortalama tur. Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| Presetler + yumuşak virajlı pist vs Presetler + keskin virajlı pist | −0.74 | 0.002 | 0.002 | −0.80 | büyük |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.

## Yarış süresi (ikincil ölçüt)

Her koşunun her koşulda bitirdiği görülmemiş pistler: `snake`. Bu pistlerde 3 turluk yarışın ortalama süresi (sn); düşük = daha hızlı sürüş.

| Koşul | Yarış süresi (sn) |
|---|---|
| Presetler + yumuşak virajlı pist | 25.20 ± 0.13 |
| Presetler + keskin virajlı pist | 31.51 ± 6.00 |

## Yarış süresinin anlamlılığı

Karşılaştırılan ölçüt: koşu başına ortak bitirilen pistlerdeki yarış süresi (sn). Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| Presetler + yumuşak virajlı pist vs Presetler + keskin virajlı pist | −6.31 | < 0.001 | < 0.001 | −1.00 | büyük |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
