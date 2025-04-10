# Emir Defteri Sistemi Kullanım Kılavuzu

Bu belge, platformumuzdaki Emir Defteri (Order Book) sisteminin nasıl kullanılacağını açıklamaktadır.

## Emir Defteri Nedir?

Emir defteri, alıcılar ve satıcılar tarafından verilen aktif emirlerin listelendiği bir sistemdir. Bu sistem, kullanıcıların kendi belirledikleri fiyatlarda alım satım yapabilmelerine olanak tanır. Platformumuzda iki tür emir bulunmaktadır:

1. **Piyasa Emri (Market Order)**: Mevcut en iyi fiyattan anında gerçekleşen emirlerdir.
2. **Limit Emri (Limit Order)**: Kullanıcının belirlediği bir fiyattan gerçekleşmesini istediği emirlerdir. Bu emirler, belirtilen fiyata ulaşılana kadar emir defterinde bekler.

## API Kullanımı

### 1. Emir Oluşturma

Yeni bir emir oluşturmak için:

```
POST /api/orders

{
  "marketId": "market-id",
  "outcomeId": "outcome-id", 
  "type": "BUY" veya "SELL",
  "orderType": "LIMIT" veya "MARKET",
  "amount": 10,
  "price": 0.65 // Sadece LIMIT emirleri için gereklidir
}
```

#### Parametreler:

- `marketId`: Emirde işlem yapmak istediğiniz piyasanın ID'si
- `outcomeId`: İşlem yapmak istediğiniz sonucun ID'si
- `type`: "BUY" (Alım) veya "SELL" (Satım)
- `orderType`: "LIMIT" (belirli bir fiyattan) veya "MARKET" (mevcut piyasa fiyatından)
- `amount`: İşlem yapmak istediğiniz miktar
- `price`: Limit emirleri için talep ettiğiniz fiyat (0.01 - 0.99 arasında)

#### Örnek Yanıt:

```json
{
  "success": true,
  "order": {
    "id": "order-id",
    "type": "BUY",
    "orderType": "LIMIT",
    "price": 0.65,
    "amount": 10,
    "filled": 0,
    "status": "OPEN"
  },
  "matchedOrders": [],
  "fullyFilled": false
}
```

### 2. Emirleri Listeleme

Piyasadaki emirleri listelemek için:

```
GET /api/orders?marketId=market-id&outcomeId=outcome-id
```

#### Parametre Seçenekleri:

- `marketId`: Belirli bir piyasadaki emirleri filtrelemek için
- `outcomeId`: Belirli bir sonuçtaki emirleri filtrelemek için
- `userOnly=true`: Sadece kendi emirlerinizi görmek için
- `page=1&limit=10`: Sayfalama için parameterler

#### Örnek Yanıt:

```json
{
  "orders": [
    {
      "id": "order-id",
      "type": "BUY",
      "orderType": "LIMIT",
      "price": 0.65,
      "amount": 10,
      "filled": 0,
      "status": "OPEN",
      "user": {
        "id": "user-id",
        "name": "Kullanıcı Adı"
      }
    }
  ],
  "orderBook": {
    "bids": [
      { "price": 0.65, "volume": 10 },
      { "price": 0.64, "volume": 5 }
    ],
    "asks": [
      { "price": 0.67, "volume": 8 },
      { "price": 0.70, "volume": 12 }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalOrders": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 3. Emir Detaylarını Görüntüleme

Belirli bir emrin detaylarını görüntülemek için:

```
GET /api/orders/[id]
```

#### Örnek Yanıt:

```json
{
  "order": {
    "id": "order-id",
    "type": "BUY",
    "orderType": "LIMIT",
    "price": 0.65,
    "amount": 10,
    "filled": 2,
    "status": "OPEN",
    "market": {
      "id": "market-id",
      "title": "Piyasa Başlığı"
    },
    "outcome": {
      "id": "outcome-id",
      "title": "Sonuç Başlığı",
      "probability": 0.66
    }
  }
}
```

### 4. Emir İptali

Açık bir emri iptal etmek için:

```
DELETE /api/orders/[id]
```

#### Örnek Yanıt:

```json
{
  "success": true,
  "message": "Emir başarıyla iptal edildi",
  "order": {
    "id": "order-id",
    "status": "CANCELLED"
  }
}
```

## Emir Durumları

- `OPEN`: Emir açık ve bekliyor
- `FILLED`: Emir tamamen gerçekleşti
- `PARTIALLY_FILLED`: Emir kısmen gerçekleşti
- `CANCELLED`: Emir iptal edildi

## Emirlerle İlgili Püf Noktaları

1. **Piyasa Emirleri vs. Limit Emirleri:**
   - Piyasa emirleri anında gerçekleşir, ancak fiyat garantisi yoktur.
   - Limit emirleri istediğiniz fiyatta gerçekleşir, ancak gerçekleşme garantisi yoktur.

2. **Alış-Satış Farkı (Spread):**
   - En iyi alım teklifi ve en iyi satım teklifi arasındaki fark "spread" olarak adlandırılır.
   - Dar spread, daha likit bir piyasayı gösterir.

3. **Likidite Sağlama:**
   - Limit emirleri vererek piyasada likidite sağlayabilir ve böylece platformun işleyişine katkıda bulunabilirsiniz.
   - Likidite sağlayıcıları genellikle alım-satım farkından yararlanırlar.

4. **İptal ve Değişiklikler:**
   - Açık emirlerinizi istediğiniz zaman iptal edebilirsiniz.
   - Bir emri değiştirmek için önce iptal edip yeni bir emir oluşturmanız gerekir.

Bu kılavuz, emir defteri sistemimizin temel kullanımını açıklamaktadır. Herhangi bir sorunuz veya geri bildiriminiz varsa, lütfen bizimle iletişime geçin.