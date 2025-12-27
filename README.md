# FiyatTakip API v4.0

Tüm e-ticaret sitelerinde akıllı fiyat karşılaştırma.

## Özellikler
- 13+ site (Trendyol, Hepsiburada, n11, Amazon, Çiçek Sepeti, İdefix...)
- En düşük fiyat sıralaması 🥇🥈🥉
- Kamera ile ürün tarama (Google Lens gibi)
- AI yorumlama (OpenAI)
- İndirim bildirimleri (%10, %20, %30 seviyeleri)
- Favoriler (en ucuz üstte)

## API Endpoints
- `POST /api/fiyat-cek` - Fiyat karşılaştırma
- `POST /api/kamera-tara` - Resimle ürün bulma
- `POST /api/favori-ekle` - Favorilere ekle
- `GET /api/favoriler/:userId` - Favorileri getir (en ucuz üstte)
- `POST /api/ai-yorum` - AI analiz
- `GET /health` - Sistem durumu

## Kurulum
```bash
npm install
npm start
