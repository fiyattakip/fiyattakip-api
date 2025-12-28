const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// GEMINI AI KURULUMU
let geminiAI = null;
try {
  const GEMINI_API_KEY = "AIzaSyAXsalIAjY2rsnQecC3y0lhkxHZuiy1-JU";
  if (GEMINI_API_KEY && GEMINI_API_KEY.startsWith('AIza')) {
    geminiAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini AI başlatıldı');
  }
} catch (error) {
  console.log('❌ Gemini AI başlatılamadı');
}

// AKILLI ÜRÜN VERİTABANI
const urunDB = {
  'iphone': { modeller: ['iPhone 13 128GB', 'iPhone 14 128GB', 'iPhone 15 128GB'], fiyat: [20000, 45000] },
  'xiaomi': { modeller: ['Xiaomi Pad 7 256GB', 'Redmi Note 13', 'Poco X6'], fiyat: [2000, 15000] },
  'samsung': { modeller: ['Galaxy S23', 'Galaxy Tab S9', 'Galaxy A54'], fiyat: [15000, 35000] },
  'televizyon': { modeller: ['LG 55" Smart TV', 'Samsung 65" 4K TV'], fiyat: [10000, 30000] },
  'laptop': { modeller: ['HP Pavilion 15', 'MacBook Air M1', 'Asus Zenbook'], fiyat: [12000, 40000] },
  'kulaklık': { modeller: ['AirPods Pro', 'Samsung Galaxy Buds', 'JBL Tune'], fiyat: [500, 5000] }
};

const SITELER = ['Trendyol', 'Hepsiburada', 'n11', 'Amazon TR', 'Pazarama', 'ÇiçekSepeti'];

// ÜRÜN BULMA
function akilliUrunBul(query) {
  const queryLower = query.toLowerCase();
  for (const [kategori, data] of Object.entries(urunDB)) {
    if (queryLower.includes(kategori)) {
      const model = data.modeller[Math.floor(Math.random() * data.modeller.length)];
      return { model, fiyatAraligi: data.fiyat, kategori };
    }
  }
  return { model: query, fiyatAraligi: [1000, 10000], kategori: 'genel' };
}

// FİYAT ÜRET
function fiyatUret(urunBilgisi, site) {
  const [min, max] = urunBilgisi.fiyatAraligi;
  const siteCarpan = { 'Trendyol': 0.95, 'Hepsiburada': 1.0, 'n11': 0.98, 'Amazon TR': 1.05, 'Pazarama': 0.97, 'ÇiçekSepeti': 1.02 };
  const carpan = siteCarpan[site] || 1.0;
  const price = Math.round((min + Math.random() * (max - min)) * carpan);
  return { fiyat: `${price.toLocaleString('tr-TR')} TL`, numericPrice: price };
}

// API: FİYAT ÇEK
app.post('/api/fiyat-cek', async (req, res) => {
  try {
    const { urun, page = 1, sort = 'asc' } = req.body;
    if (!urun || urun.trim().length < 2) return res.json({ success: false, error: 'En az 2 karakter' });
    
    const query = urun.trim();
    const urunBilgisi = akilliUrunBul(query);
    
    let allProducts = SITELER.map(site => {
      const fiyat = fiyatUret(urunBilgisi, site);
      return {
        site, urun: urunBilgisi.model, fiyat: fiyat.fiyat,
        link: `https://${site.toLowerCase().replace(' ', '').replace('ç', 'c')}.com/ara?q=${encodeURIComponent(query)}`,
        numericPrice: fiyat.numericPrice, kategori: urunBilgisi.kategori
      };
    });
    
    if (sort === 'asc') allProducts.sort((a, b) => a.numericPrice - b.numericPrice);
    else allProducts.sort((a, b) => b.numericPrice - a.numericPrice);
    
    const pageSize = 4;
    const startIndex = (page - 1) * pageSize;
    const fiyatlar = allProducts.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.ceil(allProducts.length / pageSize);
    
    res.json({
      success: true, query, fiyatlar, sayfa: parseInt(page), toplamSayfa: totalPages,
      toplamUrun: allProducts.length, siralama: sort, sites: SITELER.length,
      timestamp: new Date().toISOString(), tespitEdilenKategori: urunBilgisi.kategori
    });
    
  } catch (error) {
    res.json({ success: false, error: 'API hatası', fiyatlar: [] });
  }
});

// API: AI YORUM
app.post('/api/ai-yorum', async (req, res) => {
  try {
    const { urun, fiyatlar } = req.body;
    if (!geminiAI || !urun || !fiyatlar) return res.json({ success: false, error: 'Geçersiz veri' });
    
    const prices = fiyatlar.map(f => {
      const price = parseInt(f.fiyat.replace(/[^\d]/g, '')) || 0;
      return { site: f.site, price };
    }).filter(p => p.price > 0);
    
    if (prices.length === 0) return res.json({ success: false, error: 'Fiyat bulunamadı' });
    
    const model = geminiAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Kısa Türkçe fiyat analizi (max 80 karakter):
    Ürün: ${urun}
    Fiyatlar: ${prices.map(p => `${p.site}: ${p.price} TL`).join(', ')}
    En düşük: ${Math.min(...prices.map(p => p.price))} TL
    En yüksek: ${Math.max(...prices.map(p => p.price))} TL
    2 cümleyle analiz yap, emoji kullan:`;
    
    const result = await model.generateContent(prompt);
    const aiText = (await result.response).text().trim();
    
    res.json({
      success: true, urun, aiYorum: aiText,
      detay: {
        enUcuzFiyat: `${Math.min(...prices.map(p => p.price)).toLocaleString('tr-TR')} TL`,
        enPahaliFiyat: `${Math.max(...prices.map(p => p.price)).toLocaleString('tr-TR')} TL`,
        ortalamaFiyat: `${Math.round(prices.reduce((a, b) => a + b.price, 0) / prices.length).toLocaleString('tr-TR')} TL`,
        siteSayisi: prices.length
      }
    });
    
  } catch (error) {
    res.json({ success: false, error: 'AI yorum yapılamadı' });
  }
});

// API: MANUEL FİYAT
app.post('/api/manuel-fiyat-ekle', (req, res) => {
  try {
    const { urun, site, fiyat, link } = req.body;
    if (!urun || !fiyat) return res.json({ success: false, error: 'Ürün ve fiyat gerekli' });
    
    const numericPrice = parseInt(fiyat.replace(/[^\d]/g, '')) || 0;
    res.json({
      success: true,
      urun: { site: site || 'Manuel', urun, fiyat: `${numericPrice.toLocaleString('tr-TR')} TL`, link: link || '#', numericPrice, tip: 'manuel' },
      mesaj: 'Manuel fiyat eklendi'
    });
  } catch (error) {
    res.json({ success: false, error: 'Fiyat eklenemedi' });
  }
});

// API: SEPET
let sepetDB = [];
app.post('/api/sepet-ekle', (req, res) => {
  try {
    const { urun, site, fiyat, link, tip = 'otomatik' } = req.body;
    if (!urun || !fiyat) return res.json({ success: false, error: 'Ürün ve fiyat gerekli' });
    
    const numericPrice = parseInt(fiyat.replace(/[^\d]/g, '')) || 0;
    const sepetUrunu = {
      id: Date.now().toString(), urun, site: site || 'Manuel', fiyat, numericPrice,
      link: link || '#', tip, eklenmeTarihi: new Date().toISOString()
    };
    
    sepetDB.push(sepetUrunu);
    res.json({ success: true, urun: sepetUrunu, sepetAdet: sepetDB.length, mesaj: 'Sepete eklendi' });
  } catch (error) {
    res.json({ success: false, error: 'Sepete eklenemedi' });
  }
});

app.get('/api/sepet', (req, res) => {
  try {
    const siralanmisSepet = [...sepetDB].sort((a, b) => a.numericPrice - b.numericPrice);
    const toplam = siralanmisSepet.reduce((sum, item) => sum + item.numericPrice, 0);
    
    res.json({
      success: true, sepet: siralanmisSepet, toplamUrun: siralanmisSepet.length,
      toplamFiyat: `${toplam.toLocaleString('tr-TR')} TL`,
      ortalamaFiyat: `${Math.round(toplam / siralanmisSepet.length || 0).toLocaleString('tr-TR')} TL`
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
    res.json({ success: true, silinen: baslangicAdet - sepetDB.length, kalan: sepetDB.length, mesaj: 'Ürün silindi' });
  } catch (error) {
    res.json({ success: false, error: 'Silinemedi' });
  }
});

// SAĞLIK KONTROLÜ
app.get('/health', (req, res) => {
  res.json({
    status: 'online', zaman: new Date().toLocaleString('tr-TR'), versiyon: '3.0.0',
    ozellikler: ['Akıllı ürün tanıma', 'Gemini AI', 'Sepet yönetimi', 'Manuel fiyat'],
    ai: geminiAI ? 'Aktif' : 'Pasif', sepet: sepetDB.length
  });
});

app.get('/api', (req, res) => {
  res.json({
    status: 'success', message: 'FiyatTakip API v3.0 çalışıyor!',
    endpoints: ['POST /api/fiyat-cek', 'POST /api/ai-yorum', 'POST /api/manuel-fiyat-ekle', 'POST /api/sepet-ekle', 'GET /api/sepet', 'DELETE /api/sepet/:id']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API v3.0 ${PORT} portunda`);
  console.log(`🔗 http://localhost:${PORT}/api`);
});
