# Hiç görmediği pistlere genelleme

- Eğitim: 60 nesil, nüfus 100; dönüşümlü koşulda pist her nesil değişir
- Koşul `single`: Tek pist (classic)
- Koşul `rotating`: Dönüşümlü (oval, classic, technical)
- Şampiyon: her neslin elitleri arasından yalnızca kendi eğitim pistlerinde en iyi süren (test pistleri seçimde kullanılmaz)
- Test pistleri (hiçbir koşulda eğitimde yok): `triangle`, `horseshoe`, `square`, `snake`, `bean`
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Ölçüm: şampiyon her pisti öğrenmeden bir kez sürer (en fazla 3 tur, 60 sn); değerler ortalama ± standart sapma (örneklem)

| Koşul | Test pistlerinde ortalama tur | Bitirilen test pisti (koşu başına) | Eğitim pistlerinde ortalama tur |
|---|---|---|---|
| Tek pist (classic) | 0.44 ± 0.67 | 0.7 ± 1.1 / 5 | 3.00 ± 0.00 |
| Dönüşümlü (oval, classic, technical) | 1.86 ± 0.19 | 3.1 ± 0.3 / 5 | 3.00 ± 0.00 |

| Test pisti | Tek pist (classic) | Dönüşümlü (oval, classic, technical) |
|---|---|---|
| `triangle` | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.30 ± 0.95 tur, 1/10 bitirdi |
| `horseshoe` | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `square` | 0.90 ± 1.45 tur, 3/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `snake` | 0.60 ± 1.26 tur, 2/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `bean` | 0.70 ± 1.25 tur, 2/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |

En keskin virajlar (≈ 480 birimlik yayda toplam yön değişimi, radyan; sağ +, sol −):

| Pist | Kullanım | En keskin sağ | En keskin sol |
|---|---|---|---|
| `classic` | eğitim | 1.15 | -0.82 |
| `oval` | eğitim | 1.26 | 0.00 |
| `technical` | eğitim | 1.67 | -1.38 |
| `triangle` | test | 1.76 | -0.05 |
| `horseshoe` | test | 1.17 | -2.17 |
| `square` | test | 1.09 | -0.05 |
| `snake` | test | 1.25 | -1.22 |
| `bean` | test | 1.06 | -0.87 |
