# Kaç eğitim pisti gerekli?

- Eğitim: 60 nesil, nüfus 100; dönüşümlü koşulda pist her nesil değişir
- Koşul `tracks-1`: 1 pist (classic)
- Koşul `tracks-2`: 2 pist (+ technical)
- Koşul `tracks-3`: 3 pist (+ oval)
- Koşul `tracks-4`: 4 pist (+ yumuşak)
- Şampiyon: her neslin elitleri arasından yalnızca kendi eğitim pistlerinde en iyi süren (test pistleri seçimde kullanılmaz)
- Test pistleri (hiçbir koşulda eğitimde yok): `triangle`, `horseshoe`, `square`, `snake`, `bean`
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu)
- Ölçüm: şampiyon her pisti öğrenmeden bir kez sürer (en fazla 3 tur, 60 sn); değerler ortalama ± standart sapma (örneklem)

| Koşul | Test pistlerinde ortalama tur | Bitirilen test pisti (koşu başına) | Eğitim pistlerinde ortalama tur |
|---|---|---|---|
| 1 pist (classic) | 0.44 ± 0.67 | 0.7 ± 1.1 / 5 | 3.00 ± 0.00 |
| 2 pist (+ technical) | 1.86 ± 0.19 | 3.1 ± 0.3 / 5 | 3.00 ± 0.00 |
| 3 pist (+ oval) | 1.86 ± 0.19 | 3.1 ± 0.3 / 5 | 3.00 ± 0.00 |
| 4 pist (+ yumuşak) | 1.80 ± 0.00 | 3.0 ± 0.0 / 5 | 3.00 ± 0.00 |

| Test pisti | 1 pist (classic) | 2 pist (+ technical) | 3 pist (+ oval) | 4 pist (+ yumuşak) |
|---|---|---|---|---|
| `triangle` | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.30 ± 0.95 tur, 1/10 bitirdi | 0.30 ± 0.95 tur, 1/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `horseshoe` | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi | 0.00 ± 0.00 tur, 0/10 bitirdi |
| `square` | 0.90 ± 1.45 tur, 3/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `snake` | 0.60 ± 1.26 tur, 2/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |
| `bean` | 0.70 ± 1.25 tur, 2/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi | 3.00 ± 0.00 tur, 10/10 bitirdi |

En keskin virajlar (≈ 480 birimlik yayda toplam yön değişimi, radyan; sağ +, sol −):

| Pist | Kullanım | En keskin sağ | En keskin sol |
|---|---|---|---|
| `classic` | eğitim | 1.15 | -0.82 |
| `technical` | eğitim | 1.67 | -1.38 |
| `oval` | eğitim | 1.26 | 0.00 |
| `mild` | eğitim | 1.12 | -0.37 |
| `triangle` | test | 1.76 | -0.05 |
| `horseshoe` | test | 1.17 | -2.17 |
| `square` | test | 1.09 | -0.05 |
| `snake` | test | 1.25 | -1.22 |
| `bean` | test | 1.06 | -0.87 |

## Anlamlılık

Karşılaştırılan ölçüt: koşu başına görülmemiş pistlerdeki ortalama tur. Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| 1 pist (classic) vs 2 pist (+ technical) | −1.42 | < 0.001 | < 0.001 | −0.91 | büyük |
| 1 pist (classic) vs 3 pist (+ oval) | −1.42 | < 0.001 | < 0.001 | −0.91 | büyük |
| 1 pist (classic) vs 4 pist (+ yumuşak) | −1.36 | < 0.001 | < 0.001 | −0.90 | büyük |
| 2 pist (+ technical) vs 3 pist (+ oval) | 0.00 | 1.000 | 1.000 | 0.00 | ihmal edilebilir |
| 2 pist (+ technical) vs 4 pist (+ yumuşak) | +0.06 | 1.000 | 1.000 | +0.10 | ihmal edilebilir |
| 3 pist (+ oval) vs 4 pist (+ yumuşak) | +0.06 | 1.000 | 1.000 | +0.10 | ihmal edilebilir |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
