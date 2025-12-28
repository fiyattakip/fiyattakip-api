# FiyatTakip API v4.1

13+ e-ticaret sitesinde akıllı fiyat karşılaştırma.

## Özellikler
- 13+ site (Trendyol, Hepsiburada, n11, Amazon, Çiçek Sepeti, İdefix...)
- En düşük fiyat sıralaması 🥇🥈🥉
- Favori yönetimi (en ucuz üstte)
- AI yorumlama (basit)
- İndirim bildirim sistemi

## API Endpoints
- `POST /api/fiyat-cek` - Fiyat karşılaştırma
- `POST /api/favori-ekle` - Favorilere ekle
- `GET /api/favoriler/:userId` - Favorileri getir (en ucuz üstte)
- `POST /api/ai-yorum` - AI analiz
- `POST /api/indirim-bildirim-ayarla` - İndirim bildirimi ayarla
- `GET /health` - Sistem durumu

## Kurulum
```bash
npm install
npm start
