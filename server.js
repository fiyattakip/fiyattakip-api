const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// ÜRÜN VERİTABANI
const urunDB = {
  'iphone': ['iPhone 13 128GB', 'iPhone 14', 'iPhone 15 Pro'],
  'xiaomi': ['Xiaomi Pad 7 256GB', 'Redmi Note 13', 'Poco X6'],
  'samsung': ['Galaxy S23', 'Galaxy Tab S9'],
  'tv': ['LG 55" Smart TV', 'Samsung 4K TV'],
  'laptop': ['MacBook Air', 'HP Pavilion'],
  'kulaklık': ['AirPods Pro', 'Samsung Buds']
};

// FIYAT ARAMA
app.post('/api/fiyat-cek', (req, res) => {
  try {
    const { urun, page = 1, sort = 'asc' } = req.body;
    if (!urun) return res.json({ success: false, error: 'Ürün gerekli' });
    
    const query = urun.toLowerCase();
    let kategori = 'genel';
    let model = `${urun} 128GB`;
    
    // Kategori bul
    for (const [kat, modeller] of Object.entries(urunDB)) {
      if (query.includes(kat)) {
        kategori = kat;
        model = modeller[Math.floor(Math.random() * modeller.length)];
        break;
      }
    }
    
    // 6 siteden fiyat üret
    const siteler = ['Trendyol', 'Hepsiburada', 'n11', 'Amazon TR', 'Pazarama', 'ÇiçekSepeti'];
    const fiyatlar = siteler.map((site, index) => {
      const basePrice = 1000 + (Math.random() * 10000);
      const price = Math.round(basePrice + (index * 300));
      return {
        site: site,
        urun: model,
        fiyat: `${price.toLocaleString('tr-TR')} TL`,
        link: `https://${site.toLowerCase().replace(' ', '')}.com/ara?q=${encodeURIComponent(urun)}`,
        numericPrice: price,
        kategori: kategori
      };
    });
    
    // Sıralama
    if (sort === 'asc') {
      fiyatlar.sort((a, b) => a.numericPrice - b.numericPrice);
    } else {
      fiyatlar.sort((a, b) => b.numericPrice - a.numericPrice);
    }
    
    // Sayfalama (4'erli)
    const pageSize = 4;
    const startIndex = (page - 1) * pageSize;
    const pagedResults = fiyatlar.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.ceil(fiyatlar.length / pageSize);
    
    res.json({
      success: true,
      query: urun,
      fiyatlar: pagedResults,
      sayfa: parseInt(page),
      toplamSayfa: totalPages,
      toplamUrun: fiyatlar.length,
      siralama: sort,
      kategori: kategori
    });
    
  } catch (error) {
    res.json({ success: false, error: 'Sunucu hatası' });
  }
});

// AI YORUM
app.post('/api/ai-yorum', (req, res) => {
  const { urun, fiyatlar } = req.body;
  const yorumlar = [
    "🎯 Harika fırsat! Hemen almalısın.",
    "💰 İyi bir fiyat, düşünebilirsin.",
    "⭐ Süper teklif, kaçırma!",
    "🏆 En uygun seçenek burada.",
    "🚀 Fiyat/performans mükemmel!",
    "👍 Ortalama fiyat, bekleyebilirsin."
  ];
  
  res.json({
    success: true,
    aiYorum: yorumlar[Math.floor(Math.random() * yorumlar.length)],
    detay: {
      enUcuzFiyat: "2.180 TL",
      enPahaliFiyat: "2.890 TL",
      ortalamaFiyat: "2.500 TL"
    }
  });
});

// SAĞLIK
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'FiyatTakip API çalışıyor',
    version: '2.0.0',
    time: new Date().toLocaleString('tr-TR')
  });
});

// ANA SAYFA
app.get('/api', (req, res) => {
  res.json({
    message: 'FiyatTakip API',
    endpoints: [
      'POST /api/fiyat-cek - Fiyat karşılaştırma',
      'POST /api/ai-yorum - AI analiz',
      'GET /health - Sistem durumu'
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API ${PORT} portunda`);
});
