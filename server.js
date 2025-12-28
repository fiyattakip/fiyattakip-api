const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== API ENDPOINT'LERİ ====================

// 1. ANA FİYAT ÇEKME
app.post('/api/fiyat-cek', async (req, res) => {
  try {
    const { urun, page = 1, sort = 'asc' } = req.body;
    
    if (!urun) {
      return res.json({ success: false, error: 'Ürün adı gerekli' });
    }
    
    // ÖRNEK VERİLER (senin ekran görüntülerindeki gibi)
    const allProducts = [
      {
        site: 'Trendyol',
        urun: 'Xiaomi pad 7 256gb Pro',
        fiyat: '2180 TL',
        link: 'https://www.trendyol.com/xiaomi-pad-7',
        numericPrice: 2180
      },
      {
        site: 'Hepsiburada',
        urun: 'Xiaomi pad 7 256gb 128GB',
        fiyat: '2762 TL',
        link: 'https://www.hepsiburada.com/xiaomi-pad-7',
        numericPrice: 2762
      },
      {
        site: 'n11',
        urun: 'Xiaomi pad 7 256gb Siyah',
        fiyat: '2450 TL',
        link: 'https://www.n11.com/xiaomi-pad-7',
        numericPrice: 2450
      },
      {
        site: 'Amazon TR',
        urun: 'Xiaomi pad 7 256gb',
        fiyat: '2890 TL',
        link: 'https://www.amazon.com.tr/xiaomi-pad-7',
        numericPrice: 2890
      },
      {
        site: 'Pazarama',
        urun: 'Xiaomi pad 7 256gb',
        fiyat: '2320 TL',
        link: 'https://www.pazarama.com/xiaomi-pad-7',
        numericPrice: 2320
      },
      {
        site: 'ÇiçekSepeti',
        urun: 'Xiaomi pad 7 256gb',
        fiyat: '2650 TL',
        link: 'https://www.ciceksepeti.com/xiaomi-pad-7',
        numericPrice: 2650
      }
    ];
    
    // Sıralama
    if (sort === 'asc') {
      allProducts.sort((a, b) => a.numericPrice - b.numericPrice);
    } else {
      allProducts.sort((a, b) => b.numericPrice - a.numericPrice);
    }
    
    // Sayfalama (4 ürün/sayfa)
    const pageSize = 4;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const fiyatlar = allProducts.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      query: urun,
      fiyatlar: fiyatlar,
      sayfa: parseInt(page),
      toplamSayfa: 2, // 2 sayfa var (6 ürün / 4 = 1.5 yuvarla = 2)
      toplamUrun: allProducts.length,
      siralama: sort,
      sites: 6,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.json({ 
      success: false, 
      error: 'API hatası',
      fiyatlar: [] 
    });
  }
});

// 2. AI YORUM
app.post('/api/ai-yorum', (req, res) => {
  res.json({
    success: true,
    aiYorum: "📊 Xiaomi Pad 7 için en iyi fiyat Trendyol'da (2180 TL). Ortalama fiyat 2542 TL. 🎯 İyi bir alım zamanı!",
    detay: {
      enUcuzFiyat: '2180 TL',
      enPahaliFiyat: '2890 TL',
      ortalamaFiyat: '2542 TL',
      indirimOrani: '%25'
    }
  });
});

// 3. KAMERA AI
app.post('/api/kamera-ai', (req, res) => {
  res.json({
    success: true,
    urunTahmini: 'Xiaomi pad 7 256gb',
    tespitEdilen: 'tablet',
    mesaj: "📸 Görsel tespit edildi"
  });
});

// 4. SAĞLIK KONTROLÜ
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    message: 'FiyatTakip API çalışıyor',
    version: '2.0.0'
  });
});

// Ana endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'success',
    message: 'FiyatTakip API çalışıyor!',
    endpoints: [
      'POST /api/fiyat-cek - Fiyat karşılaştırma',
      'POST /api/ai-yorum - AI analiz',
      'POST /api/kamera-ai - Kamera AI',
      'GET /health - Sistem durumu'
    ]
  });
});

// ==================== SERVER BAŞLATMA ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API ${PORT} portunda çalışıyor`);
  console.log(`🌐 API URL: http://localhost:${PORT}/api`);
});
