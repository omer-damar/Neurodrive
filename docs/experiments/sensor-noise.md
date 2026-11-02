# Gürültülü sensörlere dayanıklılık

- Eğitim: 60 nesil, nüfus 100, pistler dönüşümlü
- Koşul `exact`: Gürültüsüz eğitim
- Koşul `noisy`: Gürültüyle eğitim (±0.1)
- Test: şampiyon her pisti her gürültü seviyesinde öğrenmeden bir kez sürer; seviyeler ±0, ±0.05, ±0.1, ±0.2 (okuma 0–1 ölçeğinde, eşit dağılımlı)
- Tohumlar: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (koşul başına 10 koşu); değerler ortalama ± standart sapma (örneklem)

| Test gürültüsü | Gürültüsüz eğitim: eğitim pistleri | Gürültüyle eğitim (±0.1): eğitim pistleri | Gürültüsüz eğitim: görülmemiş pistler | Gürültüyle eğitim (±0.1): görülmemiş pistler |
|---|---|---|---|---|
| ±0 | 3.00 ± 0.00 tur (30/30 bitti) | 3.00 ± 0.00 tur (30/30 bitti) | 1.86 ± 0.19 tur (31/50 bitti) | 1.86 ± 0.13 tur (30/50 bitti) |
| ±0.05 | 2.90 ± 0.22 tur (28/30 bitti) | 2.93 ± 0.21 tur (29/30 bitti) | 1.82 ± 0.06 tur (30/50 bitti) | 1.82 ± 0.06 tur (30/50 bitti) |
| ±0.1 | 2.80 ± 0.32 tur (27/30 bitti) | 3.00 ± 0.00 tur (30/30 bitti) | 1.80 ± 0.09 tur (29/50 bitti) | 1.72 ± 0.33 tur (28/50 bitti) |
| ±0.2 | 2.47 ± 0.57 tur (23/30 bitti) | 2.60 ± 0.41 tur (24/30 bitti) | 1.64 ± 0.35 tur (25/50 bitti) | 1.74 ± 0.13 tur (28/50 bitti) |

## Gürültünün etkisi (eşli karşılaştırma)

Karşılaştırılan ölçüt: koşu başına eğitim pistlerindeki ortalama tur, gürültüsüz ve gürültülü sürüş. Aynı koşular iki kez ölçüldü (eşli veri).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Eşli δ | Etki |
|---|---|---|---|---|---|
| Gürültüsüz eğitim @ ±0 vs @ ±0.05 | +0.10 | 0.500 | 1.000 | +0.20 | küçük |
| Gürültüsüz eğitim @ ±0 vs @ ±0.1 | +0.20 | 0.250 | 1.000 | +0.30 | küçük |
| Gürültüsüz eğitim @ ±0 vs @ ±0.2 | +0.53 | 0.031 | 0.188 | +0.60 | büyük |
| Gürültüyle eğitim (±0.1) @ ±0 vs @ ±0.05 | +0.07 | 1.000 | 1.000 | +0.10 | ihmal edilebilir |
| Gürültüyle eğitim (±0.1) @ ±0 vs @ ±0.1 | +0.00 | 1.000 | 1.000 | +0.00 | ihmal edilebilir |
| Gürültüyle eğitim (±0.1) @ ±0 vs @ ±0.2 | +0.40 | 0.031 | 0.188 | +0.60 | büyük |

Nasıl okunur: *p*, eşli işaret çevirme permütasyon testinden gelir: etki yoksa her koşunun farkı eşit olasılıkla artı ya da eksidir, tüm işaret düzenleri sayıldı. *p (Holm)* bu tablodaki karşılaştırmalar için düzeltilmiştir. *Eşli δ*, A'nın B'den büyük olduğu koşuların oranı eksi küçük olduğu koşuların oranıdır (−1…+1).

## Gürültüyle eğitmenin etkisi

Karşılaştırılan ölçüt: her test gürültüsünde, koşu başına eğitim pistlerindeki ortalama tur. Her koşu bir gözlem (koşul başına bir değer listesi).

| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff's δ | Etki |
|---|---|---|---|---|---|
| Gürültüsüz eğitim @ ±0 vs Gürültüyle eğitim (±0.1) @ ±0 | +0.00 | 1.000 | 1.000 | +0.00 | ihmal edilebilir |
| Gürültüsüz eğitim @ ±0.05 vs Gürültüyle eğitim (±0.1) @ ±0.05 | −0.03 | 1.000 | 1.000 | −0.09 | ihmal edilebilir |
| Gürültüsüz eğitim @ ±0.1 vs Gürültüyle eğitim (±0.1) @ ±0.1 | −0.20 | 0.211 | 0.842 | −0.30 | küçük |
| Gürültüsüz eğitim @ ±0.2 vs Gürültüyle eğitim (±0.1) @ ±0.2 | −0.13 | 0.662 | 1.000 | −0.10 | ihmal edilebilir |

Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla görülme olasılığıdır (iki yönlü permütasyon testi; koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; 0.05'in altı geleneksel olarak anlamlı sayılır. *Cliff's δ*, A'dan rastgele bir koşunun B'den rastgele bir koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.
