# Ağ büyüklüğü ve genelleme

- Eğitim: 60 nesil, nüfus 100; dönüşümlü koşulda pist her nesil değişir
- Koşul `hidden-4`: 4 gizli nöron
- Koşul `hidden-6`: 6 gizli nöron
- Koşul `hidden-12`: 12 gizli nöron
- Koşul `hidden-16`: 16 gizli nöron
- Şampiyon: her neslin elitleri arasından yalnızca kendi eğitim pistlerinde en iyi süren (test pistleri seçimde kullanılmaz)
- Test pistleri (hiçbir koşulda eğitimde yok): `triangle`, `horseshoe`, `square`, `snake`, `bean`
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Ölçüm: şampiyon her pisti öğrenmeden bir kez sürer (en fazla 3 tur, 60 sn); değerler ortalama ± standart sapma (örneklem)

| Koşul | Test pistlerinde ortalama tur | Bitirilen test pisti (koşu başına) | Eğitim pistlerinde ortalama tur |
|---|---|---|---|
| 4 gizli nöron | 1.80 ± 0.00 | 3.0 ± 0.0 / 5 | 3.00 ± 0.00 |
| 6 gizli nöron | 1.86 ± 0.19 | 3.1 ± 0.3 / 5 | 3.00 ± 0.00 |
| 12 gizli nöron | 1.86 ± 0.19 | 3.1 ± 0.3 / 5 | 3.00 ± 0.00 |
| 16 gizli nöron | 1.80 ± 0.00 | 3.0 ± 0.0 / 5 | 3.00 ± 0.00 |

| Test pisti | 4 gizli nöron | 6 gizli nöron | 12 gizli nöron | 16 gizli nöron |
|---|---|---|---|---|
| `triangle` | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.30 ± 0.95 tur, 1/10 bitirdi | 0.30 ± 0.95 tur, 1/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `horseshoe` | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `square` | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `snake` | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
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
| 4 gizli nöron vs 6 gizli nöron | −0.06 | 1.000 | 1.000 | −0.10 | ihmal edilebilir |
| 4 gizli nöron vs 12 gizli nöron | −0.06 | 1.000 | 1.000 | −0.10 | ihmal edilebilir |
| 4 gizli nöron vs 16 gizli nöron | 0.00 | 1.000 | 1.000 | 0.00 | ihmal edilebilir |
| 6 gizli nöron vs 12 gizli nöron | 0.00 | 1.000 | 1.000 | 0.00 | ihmal edilebilir |
| 6 gizli nöron vs 16 gizli nöron | +0.06 | 1.000 | 1.000 | +0.10 | ihmal edilebilir |
| 12 gizli nöron vs 16 gizli nöron | +0.06 | 1.000 | 1.000 | +0.10 | ihmal edilebilir |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.

## Yarış süresi (ikincil ölçüt)

Her koşunun her koşulda bitirdiği görülmemiş pistler: `square`, `snake`, `bean`. Bu pistlerde 3 turluk yarışın ortalama süresi (sn); düşük = daha hızlı sürüş.

| Koşul | Yarış süresi (sn) |
|---|---|
| 4 gizli nöron | 25.23 ± 0.14 |
| 6 gizli nöron | 25.20 ± 0.17 |
| 12 gizli nöron | 25.24 ± 0.17 |
| 16 gizli nöron | 25.20 ± 0.09 |

## Yarış süresinin anlamlılığı

Karşılaştırılan ölçüt: koşu başına ortak bitirilen pistlerdeki yarış süresi (sn). Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| 4 gizli nöron vs 6 gizli nöron | +0.03 | 0.691 | 1.000 | +0.26 | küçük |
| 4 gizli nöron vs 12 gizli nöron | −0.02 | 0.840 | 1.000 | +0.04 | ihmal edilebilir |
| 4 gizli nöron vs 16 gizli nöron | +0.03 | 0.587 | 1.000 | +0.20 | küçük |
| 6 gizli nöron vs 12 gizli nöron | −0.04 | 0.581 | 1.000 | −0.28 | küçük |
| 6 gizli nöron vs 16 gizli nöron | 0.00 | 0.985 | 1.000 | −0.25 | küçük |
| 12 gizli nöron vs 16 gizli nöron | +0.05 | 0.500 | 1.000 | +0.06 | ihmal edilebilir |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
