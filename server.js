const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// ==================== CORS DÜZELTMESİ ====================
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OPTIONS istekleri için
app.options('*', cors(corsOptions));

// ==================== GEMINI AI ====================
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

// ==================== VERİTABANI ====================
const urunVeritabani = {
  'iphone': {
    modeller: ['iPhone 13 128GB', 'iPhone 14 128GB', 'iPhone 15 Pro', 'iPhone 15 Pro Max'],
    fiyat: [20000, 50000],
    kategoriler: ['telefon', 'apple']
  },
  'samsung': {
    modeller: ['Samsung Galaxy S23', 'Galaxy S24 Ultra', 'Galaxy Tab S9', 'Galaxy Z Fold 5'],
    fiyat: [15000, 45000],
    kategoriler: ['telefon', 'android']
  },
  'xiaomi': {
    modeller: ['Xiaomi 13T Pro', 'Redmi Note 13', 'Poco X6 Pro', 'Xiaomi Pad 7'],
    fiyat: [5000, 20000],
    kategoriler: ['telefon', 'android']
  },
  'televizyon': {
    modeller: ['LG OLED 65"', 'Samsung QLED 55"', 'Philips Ambilight', 'Vestel Smart TV'],
    fiyat: [10000, 40000],
    kategoriler: ['tv', 'televizyon']
  },
  'laptop': {
    modeller: ['MacBook Air M2', 'HP Pavilion', 'Asus ROG', 'Lenovo ThinkPad'],
    fiyat: [15000, 35000],
    kategoriler: ['bilgisayar', 'dizüstü']
  },
  'kulaklık': {
    modeller: ['AirPods Pro 2', 'Samsung Galaxy Buds', 'JBL Tune', 'Sony WH-1000XM5'],
    fiyat: [500, 5000],
    kategoriler: ['kulaklık', 'aksesuar']
  },
  'oyun': {
    modeller: ['PlayStation 5', 'Xbox Series X', 'Nintendo Switch', 'Gaming PC'],
    fiyat: [8000, 30000],
    kategoriler: ['oyun', 'konsol']
  },
  'tablet': {
    modeller: ['iPad Air', 'Samsung Galaxy Tab S9', 'Xiaomi Pad 7', 'Lenovo Tab'],
    fiyat: [7000, 25000],
    kategoriler: ['tablet', 'elektronik']
  },
  'akıllı saat': {
    modeller: ['Apple Watch Series 9', 'Samsung Galaxy Watch 6', 'Xiaomi Mi Band 8', 'Garmin'],
    fiyat: [1000, 15000],
    kategoriler: ['saat', 'giyilebilir']
  },
  'monitör': {
    modeller: ['Asus 27" 144Hz', 'LG UltraWide', 'Samsung Curved', 'Dell Ultrasharp'],
    fiyat: [3000, 15000],
    kategoriler: ['monitör', 'bilgisayar']
  }
};

// ==================== SEPET VERİTABANI ====================
let sepetDB = [];
let fiyatGecmisiDB = {};
let favoriDB = {};

// ==================== OTOMATİK TAMAMLAMA ====================
app.get('/api/otomatik-tamamlama', (req, res) => {
  console.log('🔍 Otomatik tamamlama isteği:', req.query.q);
  
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ sonuclar: [] });
  }
  
  const query = q.toLowerCase();
  const sonuclar = [];
  
  // Kategori eşleştirme
  Object.entries(urunVeritabani).forEach(([kategori, data]) => {
    if (kategori.includes(query) || data.kategoriler.some(k => k.includes(query))) {
      data.modeller.forEach(model => {
        sonuclar.push({
          text: model,
          kategori: kategori,
          tip: 'model'
        });
      });
    }
  });
  
  // Model eşleştirme
  Object.values(urunVeritabani).forEach(data => {
    data.modeller.forEach(model => {
      if (model.toLowerCase().includes(query)) {
        sonuclar.push({
          text: model,
          kategori: data.kategoriler[0],
          tip: 'model'
        });
      }
    });
  });
  
  // Genel öneriler
  const genelOneriler = [
    'iPhone 13 128GB', 'iPhone 15 Pro', 'Samsung Galaxy S23', 'MacBook Air M2',
    'LG OLED TV', 'AirPods Pro', 'PlayStation 5', 'Xiaomi 13T Pro',
    'Televizyon', 'Laptop', 'Kulaklık', 'Tablet', 'Akıllı Saat'
  ];
  
  genelOneriler.forEach(oner => {
    if (oner.toLowerCase().includes(query)) {
      sonuclar.push({
        text: oner,
        kategori: 'genel',
        tip: 'oneri'
      });
    }
  });
  
  // Benzersiz sonuçlar
  const benzersizSonuclar = [];
  const gorulenler = new Set();
  
  sonuclar.forEach(sonuc => {
    const key = sonuc.text;
    if (!gorulenler.has(key)) {
      gorulenler.add(key);
      benzersizSonuclar.push(sonuc);
    }
  });
  
  res.json({ 
    success: true,
    sonuclar: benzersizSonuclar.slice(0, 8),
    query: q
  });
});

// ==================== FİYAT ARAMA ====================
app.post('/api/fiyat-cek', (req, res) => {
  console.log('💰 Fiyat çekme isteği:', req.body);
  
  try {
    const { urun, page = 1, sort = 'asc' } = req.body;
    
    if (!urun) {
      return res.json({ success: false, error: 'Ürün gerekli' });
    }
    
    const query = urun.toLowerCase();
    let secilenModel = urun;
    let kategori = 'genel';
    let fiyatAraligi = [1000, 10000];
    
    // Kategori ve model bul
    Object.entries(urunVeritabani).forEach(([kat, data]) => {
      if (query.includes(kat) || data.kategoriler.some(k => query.includes(k))) {
        kategori = kat;
        secilenModel = data.modeller[Math.floor(Math.random() * data.modeller.length)];
        fiyatAraligi = data.fiyat;
      }
    });
    
    // 6 site için fiyat üret
    const siteler = ['Trendyol', 'Hepsiburada', 'n11', 'Amazon TR', 'Pazarama', 'ÇiçekSepeti'];
    const fiyatlar = siteler.map((site, index) => {
      const [min, max] = fiyatAraligi;
      const siteCarpan = [0.95, 1.0, 0.98, 1.05, 0.97, 1.02][index] || 1.0;
      const basePrice = min + Math.random() * (max - min);
      const price = Math.round(basePrice * siteCarpan / 100) * 100;
      
      return {
        site: site,
        urun: secilenModel,
        fiyat: `${price.toLocaleString('tr-TR')} TL`,
        link: `https://www.${site.toLowerCase().replace(/ /g, '').replace('ç', 'c')}.com/ara?q=${encodeURIComponent(urun)}`,
        numericPrice: price,
        kategori: kategori,
        tarih: new Date().toISOString(),
        kargo: ['Ücretsiz', '50 TL', '100 TL', 'Ücretsiz (150 TL+)'][Math.floor(Math.random() * 4)],
        degerlendirme: (Math.random() * 2 + 3).toFixed(1),
        yorumSayisi: Math.floor(Math.random() * 1000) + 50
      };
    });
    
    // Sıralama
    if (sort === 'asc') fiyatlar.sort((a, b) => a.numericPrice - b.numericPrice);
    else fiyatlar.sort((a, b) => b.numericPrice - a.numericPrice);
    
    // Sayfalama
    const pageSize = 4;
    const start = (page - 1) * pageSize;
    const sonuclar = fiyatlar.slice(start, start + pageSize);
    
    // Fiyat geçmişine kaydet
    const urunKey = `${kategori}_${secilenModel.replace(/\s+/g, '_')}`;
    if (!fiyatGecmisiDB[urunKey]) {
      fiyatGecmisiDB[urunKey] = [];
    }
    
    const enUcuzFiyat = Math.min(...fiyatlar.map(f => f.numericPrice));
    fiyatGecmisiDB[urunKey].push({
      tarih: new Date().toISOString(),
      fiyat: enUcuzFiyat,
      site: fiyatlar.find(f => f.numericPrice === enUcuzFiyat)?.site || 'Trendyol'
    });
    
    res.json({
      success: true,
      query: urun,
      fiyatlar: sonuclar,
      sayfa: page,
      toplamSayfa: Math.ceil(fiyatlar.length / pageSize),
      toplamUrun: fiyatlar.length,
      siralama: sort,
      kategori: kategori,
      secilenModel: secilenModel,
      enUcuzFiyat: enUcuzFiyat,
      enUcuzSite: fiyatlar.find(f => f.numericPrice === enUcuzFiyat)?.site || 'Trendyol'
    });
    
  } catch (error) {
    console.error('Fiyat çekme hatası:', error);
    res.json({ success: false, error: 'Sunucu hatası' });
  }
});

// ==================== AI YORUM ====================
app.post('/api/ai-yorum', async (req, res) => {
  console.log('🤖 AI yorum isteği:', req.body?.urun);
  
  try {
    const { urun, fiyatlar, sepetUrunu } = req.body;
    
    if (!geminiAI) {
      return res.json({
        success: true,
        aiYorum: "🤖 AI servisi şu anda kullanılamıyor. Fiyatları karşılaştırarak en uygun seçeneği bulabilirsiniz.",
        tip: 'hata'
      });
    }
    
    const model = geminiAI.getGenerativeModel({ model: 'gemini-pro' });
    
    let prompt = '';
    if (sepetUrunu) {
      prompt = `Bir alışveriş uzmanı olarak şu ürün için kısa analiz yap (max 80 karakter):
      
Ürün: ${sepetUrunu.urun}
Fiyat: ${sepetUrunu.fiyat}
Site: ${sepetUrunu.site}

Bu fiyat iyi mi? Almalı mı? Çok kısa Türkçe yanıt ver. Emoji kullan.`;
    } else {
      const fiyatListesi = fiyatlar.map(f => `${f.site}: ${f.fiyat}`).join(', ');
      const prices = fiyatlar.map(f => f.numericPrice || parseInt(f.fiyat.replace(/\D/g, '')) || 0);
      const minPrice = Math.min(...prices.filter(p => p > 0));
      const maxPrice = Math.max(...prices.filter(p => p > 0));
      const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      
      prompt = `Fiyat analiz uzmanı olarak şu ürün için 2 cümlelik analiz yap (max 100 karakter):
      
Ürün: ${urun}
Fiyatlar: ${fiyatListesi}
En düşük: ${minPrice.toLocaleString('tr-TR')} TL
En yüksek: ${maxPrice.toLocaleString('tr-TR')} TL
Ortalama: ${avgPrice.toLocaleString('tr-TR')} TL

Bu fiyatlar iyi mi? En iyi seçenek hangisi? Çok kısa Türkçe yanıt. Emoji kullan.`;
    }
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text().trim();
    
    res.json({
      success: true,
      aiYorum: aiText,
      tip: sepetUrunu ? 'sepet' : 'karsilastirma',
      tarih: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('AI yorum hatası:', error);
    res.json({
      success: true,
      aiYorum: "📊 Fiyat analizi yapılamadı. Fiyatları karşılaştırarak karar verebilirsiniz.",
      tip: 'hata'
    });
  }
});

// ==================== SEPET İŞLEMLERİ ====================
app.post('/api/sepet-ekle', (req, res) => {
  console.log('🛒 Sepete ekleme:', req.body?.urun);
  
  try {
    const { urun, site, fiyat, link, kategori, tip = 'otomatik' } = req.body;
    
    if (!urun || !fiyat) {
      return res.json({ success: false, error: 'Ürün ve fiyat gerekli' });
    }
    
    const numericPrice = parseInt(fiyat.toString().replace(/\D/g, '')) || 0;
    const sepetUrunu = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      urun: urun,
      site: site || 'Manuel',
      fiyat: fiyat.toString().includes('TL') ? fiyat : `${numericPrice.toLocaleString('tr-TR')} TL`,
      numericPrice: numericPrice,
      link: link || '#',
      kategori: kategori || 'genel',
      tip: tip,
      eklenmeTarihi: new Date().toISOString(),
      sonFiyat: numericPrice
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
  console.log('📦 Sepet getir');
  
  try {
    const siralanmisSepet = [...sepetDB].sort((a, b) => 
      new Date(b.eklenmeTarihi) - new Date(a.eklenmeTarihi)
    );
    
    const toplam = siralanmisSepet.reduce((sum, item) => sum + item.numericPrice, 0);
    const ortalama = sepetDB.length > 0 ? Math.round(toplam / sepetDB.length) : 0;
    
    res.json({
      success: true,
      sepet: siralanmisSepet,
      toplamUrun: siralanmisSepet.length,
      toplamFiyat: toplam,
      ortalamaFiyat: ortalama,
      enUcuz: sepetDB.length > 0 ? Math.min(...sepetDB.map(item => item.numericPrice)) : 0,
      enPahali: sepetDB.length > 0 ? Math.max(...sepetDB.map(item => item.numericPrice)) : 0
    });
    
  } catch (error) {
    console.error('Sepet getirme hatası:', error);
    res.json({ success: false, error: 'Sepet getirilemedi' });
  }
});

app.delete('/api/sepet/:id', (req, res) => {
  console.log('🗑️ Sepetten sil:', req.params.id);
  
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
    console.error('Sepet silme hatası:', error);
    res.json({ success: false, error: 'Silinemedi' });
  }
});

// ==================== GRAFİK VERİSİ ====================
app.get('/api/grafik', (req, res) => {
  console.log('📊 Grafik verisi isteği');
  
  try {
    if (sepetDB.length === 0) {
      return res.json({
        success: true,
        mesaj: 'Sepet boş',
        grafik: { kategoriler: [], fiyatGecmisi: [], sepetTrend: [] }
      });
    }
    
    // Kategori dağılımı
    const kategoriData = [];
    const kategoriMap = {};
    
    sepetDB.forEach(item => {
      const kat = item.kategori || 'Diğer';
      if (!kategoriMap[kat]) {
        kategoriMap[kat] = { kategori: kat, toplam: 0, adet: 0, renk: getRandomColor() };
      }
      kategoriMap[kat].toplam += item.numericPrice;
      kategoriMap[kat].adet += 1;
    });
    
    Object.values(kategoriMap).forEach(kat => {
      kategoriData.push({
        ...kat,
        ortalama: Math.round(kat.toplam / kat.adet)
      });
    });
    
    // Fiyat geçmişi (son 7 gün)
    const fiyatGecmisi = [];
    const bugun = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const tarih = new Date(bugun);
      tarih.setDate(tarih.getDate() - i);
      const tarihStr = tarih.toISOString().split('T')[0];
      
      const gununUrunleri = sepetDB.filter(item => 
        item.eklenmeTarihi.split('T')[0] === tarihStr
      );
      
      const toplam = gununUrunleri.reduce((sum, item) => sum + item.numericPrice, 0);
      const ortalama = gununUrunleri.length > 0 ? Math.round(toplam / gununUrunleri.length) : 0;
      
      fiyatGecmisi.push({
        tarih: tarihStr,
        gun: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][tarih.getDay()],
        urunSayisi: gununUrunleri.length,
        toplamFiyat: toplam,
        ortalamaFiyat: ortalama
      });
    }
    
    // Sepet trendi
    const sepetTrend = [];
    const groupedByDate = {};
    
    sepetDB.forEach(item => {
      const date = item.eklenmeTarihi.split('T')[0];
      if (!groupedByDate[date]) groupedByDate[date] = { toplam: 0, adet: 0 };
      groupedByDate[date].toplam += item.numericPrice;
      groupedByDate[date].adet += 1;
    });
    
    Object.entries(groupedByDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, data]) => {
        sepetTrend.push({
          tarih: date,
          toplam: data.toplam,
          adet: data.adet,
          ortalama: Math.round(data.toplam / data.adet)
        });
      });
    
    res.json({
      success: true,
      grafik: {
        kategoriler: kategoriData,
        fiyatGecmisi: fiyatGecmisi,
        sepetTrend: sepetTrend.slice(-14),
        istatistikler: {
          toplamUrun: sepetDB.length,
          toplamFiyat: sepetDB.reduce((sum, item) => sum + item.numericPrice, 0),
          ortalamaFiyat: Math.round(sepetDB.reduce((sum, item) => sum + item.numericPrice, 0) / sepetDB.length || 0),
          enCokKategori: kategoriData.length > 0 ? 
            kategoriData.reduce((a, b) => a.adet > b.adet ? a : b).kategori : 'Yok'
        }
      }
    });
    
  } catch (error) {
    console.error('Grafik hatası:', error);
    res.json({ success: false, error: 'Grafik verisi getirilemedi' });
  }
});

// ==================== FİYAT DÜŞÜŞ BİLDİRİMİ ====================
app.get('/api/fiyat-dususleri', (req, res) => {
  console.log('📉 Fiyat düşüşleri isteği');
  
  try {
    const dususler = [];
    
    Object.entries(fiyatGecmisiDB).forEach(([urunKey, gecmis]) => {
      if (gecmis.length >= 2) {
        const sonFiyat = gecmis[gecmis.length - 1].fiyat;
        const oncekiFiyat = gecmis[gecmis.length - 2].fiyat;
        
        if (sonFiyat < oncekiFiyat) {
          const dususYuzdesi = Math.round(((oncekiFiyat - sonFiyat) / oncekiFiyat) * 100);
          
          dususler.push({
            urun: urunKey.replace(/_/g, ' '),
            oncekiFiyat: oncekiFiyat,
            yeniFiyat: sonFiyat,
            dususYuzdesi: dususYuzdesi,
            site: gecmis[gecmis.length - 1].site,
            tarih: gecmis[gecmis.length - 1].tarih
          });
        }
      }
    });
    
    dususler.sort((a, b) => b.dususYuzdesi - a.dususYuzdesi);
    
    res.json({
      success: true,
      dususler: dususler.slice(0, 10),
      toplamDusus: dususler.length
    });
    
  } catch (error) {
    console.error('Fiyat düşüş hatası:', error);
    res.json({ success: false, error: 'Fiyat düşüşleri getirilemedi' });
  }
});

// ==================== FAVORİ İŞLEMLERİ ====================
app.post('/api/favori-ekle', (req, res) => {
  console.log('⭐ Favori ekle:', req.body?.urun);
  
  try {
    const { userId = 'guest', urun, fiyat, site, kategori } = req.body;
    
    if (!favoriDB[userId]) {
      favoriDB[userId] = [];
    }
    
    const favoriItem = {
      id: Date.now().toString(),
      urun,
      fiyat,
      site: site || 'Genel',
      kategori: kategori || 'genel',
      eklenmeTarihi: new Date().toISOString(),
      sonFiyat: parseInt(fiyat.toString().replace(/\D/g, '')) || 0
    };
    
    const existingIndex = favoriDB[userId].findIndex(item => 
      item.urun === urun && item.site === favoriItem.site
    );
    
    if (existingIndex !== -1) {
      favoriDB[userId][existingIndex] = favoriItem;
    } else {
      favoriDB[userId].push(favoriItem);
    }
    
    res.json({
      success: true,
      favori: favoriItem,
      toplamFavori: favoriDB[userId].length,
      mesaj: existingIndex !== -1 ? 'Favori güncellendi' : 'Favorilere eklendi'
    });
    
  } catch (error) {
    console.error('Favori ekleme hatası:', error);
    res.json({ success: false, error: 'Favori eklenemedi' });
  }
});

app.get('/api/favoriler/:userId', (req, res) => {
  console.log('⭐ Favoriler getir:', req.params.userId);
  
  try {
    const { userId = 'guest' } = req.params;
    const favoriler = favoriDB[userId] || [];
    
    const siraliFavoriler = [...favoriler].sort((a, b) => a.sonFiyat - b.sonFiyat);
    
    res.json({
      success: true,
      favoriler: siraliFavoriler,
      toplam: siraliFavoriler.length,
      istatistikler: {
        toplamFiyat: siraliFavoriler.reduce((sum, item) => sum + item.sonFiyat, 0),
        kategoriSayisi: [...new Set(siraliFavoriler.map(item => item.kategori))].length
      }
    });
    
  } catch (error) {
    console.error('Favoriler hatası:', error);
    res.json({ success: false, error: 'Favoriler getirilemedi' });
  }
});

// ==================== YARDIMCI FONKSİYONLAR ====================
function getRandomColor() {
  const colors = ['#36d399', '#4b3fd6', '#7c5cff', '#ff6b6b', '#ff4757', '#ffa502', '#2ed573', '#1e90ff'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ==================== SAĞLIK KONTROLÜ ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    zaman: new Date().toLocaleString('tr-TR'),
    versiyon: '4.0.0',
    ozellikler: [
      'Otomatik tamamlama',
      'Gerçek AI yorum',
      'Sepet yönetimi',
      'Grafik analiz',
      'Fiyat düşüş takibi'
    ],
    ai: geminiAI ? 'Aktif' : 'Pasif',
    sepet: sepetDB.length + ' ürün',
    urunVeritabani: Object.keys(urunVeritabani).length + ' kategori'
  });
});

// ==================== ANA SAYFA ====================
app.get('/api', (req, res) => {
  res.json({
    status: 'success',
    message: 'FiyatTakip API v4.0 çalışıyor!',
    endpoints: [
      'GET /api/otomatik-tamamlama?q=... - Otomatik tamamlama',
      'POST /api/fiyat-cek - Fiyat karşılaştırma',
      'POST /api/ai-yorum - Gerçek AI analiz',
      'POST /api/sepet-ekle - Sepete ürün ekle',
      'GET /api/sepet - Sepeti getir',
      'GET /api/grafik - Grafik analiz',
      'GET /api/fiyat-dususleri - Fiyat düşüşleri',
      'DELETE /api/sepet/:id - Sepetten sil',
      'POST /api/favori-ekle - Favorilere ekle',
      'GET /api/favoriler/:userId - Favorileri getir'
    ]
  });
});

// ==================== ROOT ENDPOINT ====================
app.get('/', (req, res) => {
  res.json({
    message: 'FiyatTakip API v4.0',
    status: 'online',
    docs: 'GET /api for endpoints',
    health: 'GET /health for status'
  });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint bulunamadı',
    available: 'GET /api for available endpoints'
  });
});

// ==================== SERVER BAŞLATMA ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FiyatTakip API v4.0 ${PORT} portunda`);
  console.log(`🤖 AI: ${geminiAI ? '✅ AKTİF' : '❌ PASİF'}`);
  console.log(`📡 http://localhost:${PORT}`);
  console.log(`🔍 Test: http://localhost:${PORT}/api/otomatik-tamamlama?q=iphone`);
  console.log(`💰 Test: http://localhost:${PORT}/health`);
  console.log(`📊 Özellikler: Otomatik tamamlama, AI yorum, Sepet, Grafik`);
});
