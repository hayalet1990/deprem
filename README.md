# Buradayım Projesi

Bu proje, kullanıcıların konumlarını paylaşabildiği ve çevrelerindeki diğer kullanıcıları görebildiği bir web uygulamasıdır.

## Özellikler

- **Konum Paylaşma**: Kullanıcılar konumlarını paylaşabilir
- **Gerçek Zamanlı Harita**: Leaflet haritası üzerinde konumları görüntüleme
- **Kullanıcı Paneli**: Profil yönetimi ve kullanıcı listesi
- **Gerçek Zamanlı İletişim**: Socket.IO ile anlık güncellemeler
- **Veritabanı**: SQLite ile kullanıcı verilerini saklama

## Kurulum

1. Proje dosyalarını bir dizine kopyalayın
2. Terminali açıp proje dizinine gidin
3. `npm install` komutuyla gerekli paketleri yükleyin
4. `npm start` komutuyla sunucuyu başlatın
5. Tarayıcınızda `http://localhost:3000` adresine gidin

## Kullanım

### Ana Sayfa
1. Uygulamaya girdiğinizde bir kullanıcı adı girin
2. "Konumumu Paylaş" butonuna tıklayarak konumunuzu paylaşın
3. Haritada kendi konumunuzu ve çevrenizdeki diğer kullanıcıları görebilirsiniz

### Kullanıcı Paneli
1. Ana sayfadaki "Kullanıcı Paneli" bağlantısına tıklayın
2. Profil bilgilerinizi düzenleyin
3. Diğer kullanıcıları görüntüleyin
4. Hesap ayarlarınızı yapın

## Teknolojiler

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO
- **Veritabanı**: SQLite
- **Frontend**: HTML5, CSS3, JavaScript
- **Harita**: Leaflet
- **Konum**: HTML5 Geolocation API

## Proje Yapısı

```
buradayim-projesi/
├── index.html          # Ana sayfa
├── user-panel.html     # Kullanıcı paneli
├── style.css           # Stil dosyası
├── app.js              # İstemci tarafı JavaScript
├── server.js           # Sunucu tarafı
├── package.json        # Bağımlılıklar
└── README.md           # Proje açıklaması
```

## Geliştirme

Geliştirme modunda çalıştırmak için:
```bash
npm run dev
```

## Lisans

MIT Lisansı

