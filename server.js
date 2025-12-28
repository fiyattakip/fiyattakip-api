const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== GEMINI AI KURULUMU ====================
let geminiAI = null;
try {
  const GEMINI_API_KEY = "AIzaSyAXsalIAjY2rsnQecC3y0lhkxHZuiy1-JU";
  if (GEMINI_API_KEY && GEMINI_API_KEY.startsWith('AIza')) {
    geminiAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini AI başlatıldı');
  } else {
    console.log('⚠️ Gemini API anahtarı bulunamadı');
  }
} catch (error) {
  console.log('❌ Gemini AI başlatılamadı:', error.message);
}

// ==================== AKILLI ÜRÜN VERİTABANI ====================
const urunVeritabani = {
  'iphone': {
    anahtar: ['iphone', 'apple', 'ios', 'telefon'],
    modeller: [
      { model: 'iPhone 13 128GB', fiyatAraligi: [21000, 25000] },
      { model: 'iPhone 13 256GB', fiyatAraligi: [24000, 28000] },
      { model: 'iPhone 14 128GB', fiyatAraligi: [28000, 32000] },
      { model: 'iPhone 15 128GB', fiyatAraligi: [35000, 42000] },
      { model: 'iPhone 15 Pro 256GB', fiyatAraligi: [45000, 55000] }
    ]
  },
  'xiaomi': {
    anahtar: ['xiaomi', 'redmi', 'poco', 'pad', 'tablet'],
    modeller: [
      { model: 'Xiaomi Pad 7 256GB', fiyatAraligi: [2100, 2900] },
      { model: 'Xiaomi Redmi Note 13', fiyatAraligi: [7000, 9000] },
      { model: 'Xiaomi Poco X6', fiyatAraligi: [10000, 13000] },
      { model: 'Xiaomi 13T Pro', fiyatAraligi: [18000, 23000] }
    ]
  },
  'samsung': {
    anahtar: ['samsung', 'galaxy'],
    modeller: [
      { model: 'Samsung Galaxy S23', fiyatAraligi: [25000, 32000] },
      { model: 'Samsung Galaxy Tab S9', fiyatAraligi: [18000, 25000] },
      { model: 'Samsung Galaxy A54', fiyatAraligi: [9000, 13000] }
    ]
  },
  'televizyon': {
    anahtar: ['tv', 'televizyon', 'smart tv', 'led tv'],
    modeller: [
      { model: 'LG 55" Smart TV', fiyatAraligi: [15000, 22000] },
      { model: 'Samsung 65" 4K TV', fiyatAraligi: [25000, 35000] }
    ]
  },
  'laptop': {
    anahtar: ['laptop', 'dizüstü', 'notebook', 'macbook'],
    modeller: [
      { model: 'HP Pavilion 15', fiyatAraligi: [15000, 20000] },
      { model: 'MacBook Air M1', fiyatAraligi: [30000, 38000] },
      { model: 'Asus Zenbook', fiyatAraligi: [22000, 30000] }
    ]
  },
  'kulaklık': {
    anahtar: ['kulaklık', 'airpods', 'headphone', 'earphone'],
    modeller: [
      { model: 'AirPods Pro 2', fiyatAraligi: [5000, 8000] },
      { model: 'Samsung Galaxy Buds', fiyatAraligi: [1500, 3000] }
    ]
  },
  'oyun': {
    anahtar: ['oyun', 'playstation', 'xbox', 'nintendo'],
    modeller: [
      { model: 'PlayStation 5', fiyatAraligi: [15000, 22000] },
      { model: 'Xbox Series X', fiyatAraligi: [14000, 20000] }
    ]
  }
};

// ==================== SİTELER ====================
const SITELER = ['Trendyol', 'Hepsiburada', 'n11', 'Amazon TR', 'Pazarama', 'ÇiçekSepeti'];

// ==================== AKILLI ÜRÜN BULMA ====================
function akilliUrunBul(query) {
  const queryLower = query.toLowerCase().trim();
  
  // Önce tam eşleşme kontrol et
  for (const [kategori, data] of Object.entries(urunVeritabani)) {
    for (const keyword of data.anahtar) {
      if (queryLower === keyword || queryLower.includes(' ' + keyword + ' ') || 
          queryLower.startsWith(keyword + ' ') || queryLower.endsWith(' ' + keyword)) {
        const modeller = data.modeller;
        const secilenModel = modeller[Math.floor(Math.random() * modeller.length)];
        return {
          model: secilenModel.model,
          fiyatAraligi: secilenModel.fiyatAraligi,
          kategori: kategori
        };
      }
    }
  }
  
  // Eğer bulunamazsa, query'i direkt kullan
  const fiyatAraligi = queryLower.length < 10 ? [1000, 5000] : 
                       queryLower.includes('pro') || queryLower.includes('max') ? [5000, 20000] : [2000, 10000];
  
  return {
    model: query.charAt(0).toUpperCase() + query.slice(1),
    fiyatAraligi: fiyatAraligi,
    kategori: 'genel'
  };
}

// ==================== GERÇEKÇİ FİYAT ÜRET ====================
function gercekciFiyatUret(urunBilgisi, site, index) {
  const [min, max] = urunBilgisi.fiyatAraligi;
  
  // Her site için farklı fiyat (index'e göre)
  const siteCarpan = {
    'Trendyol': 0.95 + (index * 0.01),
    'Hepsiburada': 1.0 + (index * 0.02),
    'n11': 0.98 + (index * 0.015),
    'Amazon TR': 1.05 + (index * 0.025),
    'Pazarama': 0.97 + (index * 0.02),
    'ÇiçekSepeti': 1.02 + (index * 0.015)
  };
  
  const carpan = siteCarpan[site] || 1.0;
  const basePrice = min + Math.random() * (max - min);
  const price = Math.round(basePrice * carpan / 100) * 100; // 100'lük katları
  
  return {
    fiyat: `${price.toLocaleString('tr-TR')} TL`,
    numericPrice: price
  };
}

// ==================== API ENDPOINT'LERİ ====================

// 1. AKILLI FİYAT ARAMA
app.post('/api/fiyat-cek', async (req, res) => {
  try {
    const { urun, page = 1, sort = 'asc' } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.json({ success: false, error: 'En az 2 karakter girin' });
    }
    
    const query = urun.trim();
    const urunBilgisi = akilliUrunBul(query);
    
    // Tüm siteler için fiyat üret
    let allProducts = [];
    SITELER.forEach((site, index) => {
      const fiyatBilgisi = gercekciFiyatUret(urunBilgisi, site, index);
      allProducts.push({
        site: site,
        urun: urunBilgisi.model,
        fiyat: fiyatBilgisi.fiyat,
        link: `https://www.${site.toLowerCase().replace(' ', '').replace('ç', 'c').replace('ı', 'i').replace('ğ', 'g')}.com/ara?q=${encodeURIComponent(query)}`,
        numericPrice: fiyatBilgisi.numericPrice,
        kategori: urunBilgisi.kategori,
        siteIndex: index
      });
    });
    
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
    const totalPages = Math.ceil(allProducts.length / pageSize);
    
    res.json({
      success: true,
      query: query,
      fiyatlar: fiyatlar,
      sayfa: parseInt(page),
      toplamSayfa: totalPages,
      toplamUrun: allProducts.length,
      siralama: sort,
      sites: SITELER.length,
      timestamp: new Date().toISOString(),
      tespitEdilenKategori: urunBilgisi.kategori,
      urunModeli: urunBilgisi.model
    });
    
  } catch (error) {
    console.error('API hatası:', error);
    res.json({ 
      success: false, 
      error: 'Sunucu hatası',
      fiyatlar: [] 
    });
  }
});

// 2. GEMINI AI YORUM - DÜZELTİLMİŞ
app.post('/api/ai-yorum', async (req, res) => {
  try {
    const { urun, fiyatlar } = req.body;
    
    // AI kontrolü
    if (!geminiAI) {
      return res.json({
        success: false,
        error: 'AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
      });
    }
    
    if (!urun || !fiyatlar || !Array.isArray(fiyatlar) || fiyatlar.length === 0) {
      return res.json({
        success: false,
        error: 'Geçerli ürün ve fiyat bilgisi gerekli'
      });
    }
    
    // Fiyatları analiz et
    const prices = fiyatlar.map(f => {
      const priceStr = f.fiyat.replace(/[^\d]/g, '');
      const price = parseInt(priceStr) || 0;
      return { 
        site: f.site, 
        price: price,
        urun: f.urun || urun
      };
    }).filter(p => p.price > 0);
    
    if (prices.length === 0) {
      return res.json({
        success: false,
        error: 'Geçerli fiyat bulunamadı'
      });
    }
    
    // Gemini AI'ya sor
    const model = geminiAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const fiyatListesi = prices.map(p => `${p.site}: ${p.price.toLocaleString('tr-TR')} TL`).join('\n');
    const minPrice = Math.min(...prices.map(p => p.price));
    const maxPrice = Math.max(...prices.map(p => p.price));
    const avgPrice = Math.round(prices.reduce((sum, p) => sum + p.price, 0) / prices.length);
    
    const prompt = `Aşağıdaki ürün için kısa ve net Türkçe fiyat analizi yap (en fazla 2 cümle, maksimum 100 karakter):

Ürün: ${urun}

Fiyatlar:
${fiyatListesi}

En düşük fiyat: ${minPrice.toLocaleString('tr-TR')} TL
En yüksek fiyat: ${maxPrice.toLocaleString('tr-TR')} TL
Ortalama fiyat: ${avgPrice.toLocaleString('tr-TR')} TL

Analizinde:
1. En uygun fiyatı belirt
2. Fiyatların uygun olup olmadığını söyle
3. Kısa bir tavsiye ver

Cevabında emoji kullan. Çok kısa ve net olsun.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text().trim();
    
    // AI yanıtını temizle (fazla boşlukları kaldır)
    const cleanedAiText = aiText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    
    res.json({
      success: true,
      urun: urun,
      aiYorum: cleanedAiText || "🤖 Fiyatlar makul görünüyor. En uygun seçeneği tercih edin.",
      detay: {
        enUcuzFiyat: `${minPrice.toLocaleString('tr-TR')} TL`,
        enPahaliFiyat: `${maxPrice.toLocaleString('tr-TR')} TL`,
        ortalamaFiyat: `${avgPrice.toLocaleString('tr-TR')} TL`,
        farkYuzde: `${Math.round(((maxPrice - minPrice) / maxPrice) * 100)}%`,
        siteSayisi: prices.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('AI hatası:', error);
    
    // Hata durumunda basit bir yorum döndür
    res.json({
      success: true,
      urun: req.body.urun || 'Ürün',
      aiYorum: "🤖 Fiyat analizi yapılamadı. Fiyatları karşılaştırarak en uygun seçeneği bulabilirsiniz.",
      detay: {
        enUcuzFiyat: 'Bilgi yok',
        enPahaliFiyat: 'Bilgi yok',
        ortalamaFiyat: 'Bilgi yok',
        siteSayisi: req.body.fiyatlar?.length || 0
      }
    });
  }
});

// 3. SEPET İŞLEMLERİ
let sepetDB = [];

app.post('/api/sepet-ekle', (req, res) => {
  try {
    const { urun, site, fiyat, link, tip = 'otomatik', urunAdi } = req.body;
    
    if ((!urun && !urunAdi) || !fiyat) {
      return res.json({ success: false, error: 'Ürün adı ve fiyat gerekli' });
    }
    
    const numericPrice = parseInt(fiyat.toString().replace(/[^\d]/g, '')) || 0;
    const sepetUrunu = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      urun: urunAdi || urun || 'Ürün',
      site: site || 'Manuel',
      fiyat: fiyat.toString().includes('TL') ? fiyat : `${numericPrice.toLocaleString('tr-TR')} TL`,
      numericPrice: numericPrice,
      link: link || '#',
      tip: tip,
      eklenmeTarihi: new Date().toISOString(),
      urunOrijinal: urun
    };
    
    sepetDB.push(sepetUrunu);
    
    res.json({
      success: true,
      urun: sepetUrunu,
      sepetAdet: sepetDB.length,
      mesaj: 'Sepete eklendi'
    });
    
  } catch (error) {
    console.error('Sepet ekleme hatası:', error);
    res.json({ success: false, error: 'Sepete eklenemedi' });
  }
});

app.get('/api/sepet', (req, res) => {
  try {
    // Fiyata göre sırala (artan)
    const siralanmisSepet = [...sepetDB].sort((a, b) => a.numericPrice - b.numericPrice);
    
    const toplam = siralanmisSepet.reduce((sum, item) => sum + item.numericPrice, 0);
    const ortalama = sepetDB.length > 0 ? Math.round(toplam / sepetDB.length) : 0;
    
    res.json({
      success: true,
      sepet: siralanmisSepet,
      toplamUrun: siralanmisSepet.length,
      toplamFiyat: `${toplam.toLocaleString('tr-TR')} TL`,
      ortalamaFiyat: `${ortalama.toLocaleString('tr-TR')} TL`,
      enUcuz: sepetDB.length > 0 ? Math.min(...sepetDB.map(item => item.numericPrice)) : 0,
      enPahali: sepetDB.length > 0 ? Math.max(...sepetDB.map(item => item.numericPrice)) : 0
    });
    
  } catch (error) {
    res.json({ success: false, error: 'Sepet getirilemedi' });
  }
});

app.delete('/api/sepet/:id', (req, res) => {
  try {
    const { id } = req.params;
    const baslangicAdet = sepetDB.length;
    
    sepetDB = sepetDB.filter(item => item.id !== id);
    
    res.json({
      success: true,
      silinen: baslangicAdet - sepetDB.length,
      kalan: sepetDB.length,
      mesaj: 'Ürün sepetten kaldırıldı'
    });
    
  } catch (error) {
    res.json({ success: false, error: 'Silinemedi' });
  }
});

// 4. GRAFİK VERİSİ
app.get('/api/grafik', (req, res) => {
  try {
    // Sepet verisinden grafik için veri üret
    const kategoriler = {};
    sepetDB.forEach(item => {
      const kategori = item.kategori || 'Diğer';
      if (!kategoriler[kategori]) {
        kategoriler[kategori] = { toplam: 0, adet: 0 };
      }
      kategoriler[kategori].toplam += item.numericPrice;
      kategoriler[kategori].adet += 1;
    });
    
    const grafikVerisi = Object.keys(kategoriler).map(kategori => ({
      kategori: kategori,
      toplamFiyat: kategoriler[kategori].toplam,
      ortalamaFiyat: Math.round(kategoriler[kategori].toplam / kategoriler[kategori].adet),
      urunSayisi: kategoriler[kategori].adet
    }));
    
    // Fiyat dağılımı
    const fiyatAraliklari = [
      { aralik: '0-1000 TL', sayi: 0 },
      { aralik: '1001-5000 TL', sayi: 0 },
      { aralik: '5001-10000 TL', sayi: 0 },
      { aralik: '10001-20000 TL', sayi: 0 },
      { aralik: '20000+ TL', sayi: 0 }
    ];
    
    sepetDB.forEach(item => {
      const fiyat = item.numericPrice;
      if (fiyat <= 1000) fiyatAraliklari[0].sayi++;
      else if (fiyat <= 5000) fiyatAraliklari[1].sayi++;
      else if (fiyat <= 10000) fiyatAraliklari[2].sayi++;
      else if (fiyat <= 20000) fiyatAraliklari[3].sayi++;
      else fiyatAraliklari[4].sayi++;
    });
    
    res.json({
      success: true,
      grafik: {
        kategoriler: grafikVerisi,
        fiyatAraliklari: fiyatAraliklari,
        toplamUrun: sepetDB.length,
        toplamFiyat: sepetDB.reduce((sum, item) => sum + item.numericPrice, 0),
        ortalamaFiyat: sepetDB.length > 0 ? Math.round(sepetDB.reduce((sum, item) => sum + item.numericPrice, 0) / sepetDB.length) : 0
      }
    });
    
  } catch (error) {
    res.json({ success: false, error: 'Grafik verisi getirilemedi' });
  }
});

// 5. SAĞLIK KONTROLÜ
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    zaman: new Date().toLocaleString('tr-TR'),
    versiyon: '3.1.0',
    ozellikler: [
      'Akıllı ürün tanıma',
      'Gerçekçi fiyatlandırma',
      'Gemini AI analiz',
      'Sepet yönetimi',
      'Grafik analiz'
    ],
    ai: geminiAI ? 'Aktif' : 'Pasif',
    sepet: sepetDB.length,
    urunVeritabani: Object.keys(urunVeritabani).length + ' kategori'
  });
});

// Ana endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'success',
    message: 'FiyatTakip API v3.1 çalışıyor!',
    endpoints: [
      'POST /api/fiyat-cek - Akıllı fiyat karşılaştırma',
      'POST /api/ai-yorum - AI analiz (Gemini)',
      'POST /api/sepet-ekle - Sepete ürün ekle',
      'GET /api/sepet - Sepeti getir',
      'GET /api/grafik - Grafik verisi',
      'DELETE /api/sepet/:id - Sepetten sil'
    ]
  });
});

// ==================== SERVER BAŞLATMA ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API v3.1 ${PORT} portunda`);
  console.log(`🔗 Endpoint: http://localhost:${PORT}/api`);
  console.log(`🤖 AI: ${geminiAI ? 'AKTİF' : 'PASİF'}`);
  console.log(`📊 Ürün Veritabanı: ${Object.keys(urunVeritabani).length} kategori`);
});
