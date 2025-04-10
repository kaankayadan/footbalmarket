# Tahmin Piyasası Mekanizması

Bu belge, platformumuzdaki tahmin piyasası mekanizmasının nasıl çalıştığını açıklamaktadır.

## 1. Temel Çalışma Prensibi

Platformumuz, kullanıcıların gelecekteki olayların sonuçlarına dair tahminlerini paylaşarak sanal para kazanabilecekleri bir tahmin piyasası platformudur. Her kullanıcı, kaydolduğunda 1000 birim sanal para ile başlar ve bu parayı çeşitli piyasalarda bahis oynamak için kullanabilir.

## 2. Piyasa Mekanizması

### Hisse Sistemi ve Fiyatlandırma

- Kullanıcılar, belirli sonuçların gerçekleşme olasılığını temsil eden hisseler satın alırlar.
- Her sonuç için hisse fiyatı daima 0.01 ile 0.99 arasındadır.
- Fiyat = Olasılık: Örneğin, bir olayın gerçekleşme olasılığı için hisseler 0.60'dan işlem görüyorsa, bu o olayın gerçekleşme olasılığının %60 olduğunu gösterir.
- Bir piyasadaki tüm sonuçların olasılıkları toplamı her zaman 1.00'dir (%100).

### Eşler Arası (P2P) Ticaret

- Platformumuz, klasik bahis sitelerinden farklıdır çünkü kullanıcılar "bahisçi kuruluşa" karşı değil, diğer kullanıcılara karşı ticaret yaparlar.
- Platform, kullanıcılar arasında eşleşen emirleri (karşıt görüşleri) bir araya getirerek çalışır.
- Fiyatları ve oranları platform belirlemez; bunlar tamamen kullanıcıların alım-satım isteklerine göre arz ve talep dinamikleriyle belirlenir.

## 3. Piyasa Oluşumu ve Fiyat Belirleme Süreci

### Piyasa Oluşumu

- Piyasalar yöneticiler (admin) tarafından oluşturulur.
- Her piyasa, bir soru/başlık, açıklama, kategori ve sonlanma tarihi içerir.
- Her piyasa için en az iki olası sonuç tanımlanır.

### İlk Fiyatın Belirlenmesi

- Bir piyasa oluşturulduğunda, başlangıçta her sonucun olasılığı eşit olarak ayarlanır (örn. iki sonuç için %50-%50).
- "Limit Emirleri" veren ilk tüccarlar (piyasa yapıcılar), hisseleri almak veya satmak istedikleri fiyatı belirlerler.

### Canlı Fiyatlandırma

- Platformumuzda gösterilen fiyatlar, emir defterindeki alış-satış farkının orta noktasıdır.
- Borsa gibi, fiyatlar gerçek zamanlı arz ve talebin bir fonksiyonudur.
- Kullanıcılar gösterilen olasılık/fiyatta hisse alamayabilirler çünkü her zaman alış-satış farkı vardır.

## 4. Ticaret Mekanizması

### Emir Türleri

1. **Piyasa Emri**: Kullanıcının mevcut piyasa fiyatından hemen alım veya satım yapmasını sağlar.
2. **Limit Emri**: Kullanıcının belirlediği bir fiyattan alım veya satım yapmasını sağlar. Emir, belirtilen fiyata ulaşılıncaya kadar emir defterinde bekler.

### Pozisyonlar ve Kâr Potansiyeli

- Eğer bir olayın gerçekleşeceğine inanıyorsanız ve mevcut fiyatın gerçek olasılıktan düşük olduğunu düşünüyorsanız, o sonuç için hisseler alırsınız.
- Eğer bir olayın gerçekleşmeyeceğine inanıyorsanız ve mevcut fiyatın gerçek olasılıktan yüksek olduğunu düşünüyorsanız, o sonuç için hisseleri satarsınız.
- Örnek: Bir takımın maçı kazanma olasılığı %18 (0.18) gösteriliyorsa ve siz bunun daha yüksek olduğunu düşünüyorsanız, "EVET" hisseleri alırsınız. Eğer takım kazanırsa, her hisse 1.00 değerinde olur, bu da hisse başına 0.82 kâr elde etmenizi sağlar.

### Erken Çıkış İmkanı

- Pozisyonunuza kilitli kalmazsınız; hisselerinizi event sonuçlanmadan önce herhangi bir zamanda mevcut piyasa fiyatından satabilirsiniz.
- Haberler değiştikçe, hisseler için arz ve talep dalgalanır, bu da hisse fiyatını olay için yeni olasılıkları yansıtacak şekilde değiştirir.

## 5. Piyasa Çözümü (Resolution)

### Piyasa Sonuçlandırma

- Bir olayın sonucu netleştiğinde, piyasa çözüme kavuşturulur (kalıcı olarak sonuçlandırılır).
- Piyasalar, yöneticiler tarafından manuel olarak çözüme kavuşturulur.
- Piyasa çözüme kavuştuğunda, kazanan sonucun hisse sahipleri her hisse için 1.00 birim alır, kaybeden hisseler değersiz hale gelir.

### Ödeme Mekanizması

- Kazanan sonuçların sahipleri, sahip oldukları hisse miktarı kadar ödül alırlar.
- Kaybeden sonuçların sahipleri herhangi bir ödül almazlar.
- Tüm açık emirler iptal edilir ve alıcı emirleri için rezerve edilen fonlar iade edilir.

## 6. Avantajlar

### Tahmin Piyasalarının Doğruluğu

- Araştırmalar, tahmin piyasalarının genellikle uzmanlardan, anketlerden ve yorumculardan daha doğru olduğunu gösteriyor.
- Tüccarlar haberleri, anketleri ve uzman görüşlerini birleştirerek bilinçli ticaretler yaparlar.
- Ekonomik teşvikler, daha bilgili katılımcılar katıldıkça piyasa fiyatlarının gerçek olasılıkları yansıtacak şekilde ayarlanmasını sağlar.
- Bu, tahmin piyasalarını gerçek zamanlı olay olasılıklarının en iyi kaynağı haline getirir.

### Kullanıcı İçin Değeri

- Belirli bir konuda uzmansanız, platformumuz bilginize dayalı ticaret yaparak sanal para kazanma ve aynı zamanda piyasanın doğruluğunu artırma fırsatınızdır.
- Kullanıcılar, gelecekte bilinçli kararlar vermek için en doğru olasılıkları elde etmek amacıyla platformu kullanırlar.

## Özet

Platformumuz, kullanıcılara gelecek olayların sonuçlarına dair tahminlerini paylaşarak sanal para kazanma imkanı sunan eşler arası bir tahmin piyasası platformudur. Olayların gerçekleşme olasılıkları hisse fiyatları olarak ifade edilir ve bu fiyatlar tamamen kullanıcı arz ve talebine göre belirlenir. Kazanan tahminler 1.00 birim değerinde ödenir ve kullanıcılar olaylar sonuçlanmadan önce pozisyonlarını satarak kâr elde edebilir veya zararlarını sınırlayabilirler. Bu sistem, kolektif bilgeliği bir araya getirerek gelecek olayların olasılıkları hakkında son derece doğru tahminler üretir.