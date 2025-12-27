const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== AYARLAR ====================
const priceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

const favoriUrunler = new Map(); // {userId: [{urun, fiyat, site, link}]}
const indirimTakip = new Map(); // {userId-urun: {eskiFiyat, takipBaslangic}}

// OpenAI (AI için)
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ==================== YARDIMCI FONKSİYONLAR ====================

// Fiyatı sayıya çevir
function extractPrice(priceStr) {
  if (!priceStr) return Infinity;
  const matches = priceStr.match(/(\d+[.,]\d+|\d+)/);
  return matches ? parseFloat(matches[0].replace(',', '.')) : Infinity;
}

// Fiyat formatı
function formatPrice(price) {
  if (price === Infinity) return 'Fiyat yok';
  return new Intl.NumberFormat('tr-TR', { 
    style: 'currency', 
    currency: 'TRY' 
  }).format(price);
}

// Ürün benzerliği kontrolü
function isRelevantProduct(productName, searchQuery) {
  if (!productName || !searchQuery) return true;
  
  const queryWords = searchQuery.toLowerCase().split(' ').filter(w => w.length > 2);
  const productWords = productName.toLowerCase().split(' ').filter(w => w.length > 2);
  
  const matches = queryWords.filter(qw => 
    productWords.some(pw => pw.includes(qw) || qw.includes(pw))
  );
  
  return matches.length >= Math.max(1, queryWords.length * 0.5);
}

// En düşük fiyata göre sırala ve kupa ekle
function sortAndRankProducts(products, searchQuery) {
  // Alakasız ürünleri filtrele
  const relevant = products.filter(p => isRelevantProduct(p.urun, searchQuery));
  
  // Fiyata göre sırala (en düşük en üstte)
  const withNumericPrice = relevant.map(p => ({
    ...p,
    numericPrice: extractPrice(p.fiyat)
  }));
  
  const sorted = withNumericPrice.sort((a, b) => a.numericPrice - b.numericPrice);
  
  // Kupa simgelerini ekle
  return sorted.map((p, index) => ({
    ...p,
    fiyat: p.numericPrice === Infinity ? p.fiyat : formatPrice(p.numericPrice),
    badge: index === 0 ? '🥇 EN UCUZ' : 
           index === 1 ? '🥈 İKİNCİ' : 
           index === 2 ? '🥉 ÜÇÜNCÜ' : ''
  }));
}

// ==================== E-TİCARET SİTELERİ ====================

const SITES = {
  'Trendyol': {
    url: (query) => `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}`,
    selector: 'div[data-testid="product-card"]',
    extract: ($, el) => {
      const title = $(el).find('span.prdct-desc-cntnr-name').text().trim();
      const price = $(el).find('div.prc-box-dscntd').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  },
  'Hepsiburada': {
    url: (query) => `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`,
    selector: 'li[data-testid="product-card"]',
    extract: ($, el) => {
      const title = $(el).find('h3[data-testid="product-title"]').text().trim();
      const price = $(el).find('div[data-testid="price-current-price"]').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  },
  'n11': {
    url: (query) => `https://www.n11.com/arama?q=${encodeURIComponent(query)}`,
    selector: '.listItem',
    extract: ($, el) => {
      const title = $(el).find('.productName').text().trim();
      const price = $(el).find('.newPrice').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  },
  'Amazon TR': {
    url: (query) => `https://www.amazon.com.tr/s?k=${encodeURIComponent(query)}`,
    selector: '.s-result-item',
    extract: ($, el) => {
      const title = $(el).find('h2 a span').text().trim();
      const priceWhole = $(el).find('.a-price-whole').text().trim();
      const priceFraction = $(el).find('.a-price-fraction').text().trim();
      const link = $(el).find('h2 a').attr('href');
      const price = priceWhole && priceFraction ? `${priceWhole}.${priceFraction} TL` : priceWhole || priceFraction;
      return { title, price, link };
    }
  },
  'Teknosa': {
    url: (query) => `https://www.teknosa.com/arama/?q=${encodeURIComponent(query)}`,
    selector: '.product-item',
    extract: ($, el) => {
      const title = $(el).find('.product-name').text().trim();
      const price = $(el).find('.product-price').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  },
  'Vatan Bilgisayar': {
    url: (query) => `https://www.vatanbilgisayar.com/arama/${encodeURIComponent(query)}/`,
    selector: '.product-list__item',
    extract: ($, el) => {
      const title = $(el).find('.product-list__product-name').text().trim();
      const price = $(el).find('.product-list__price').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  },
  'Çiçek Sepeti': {
    url: (query) => `https://www.ciceksepeti.com/arama?query=${encodeURIComponent(query)}`,
    selector: '.products__item',
    extract: ($, el) => {
      const title = $(el).find('.products__item-title').text().trim();
      const price = $(el).find('.price').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  },
  'İdefix': {
    url: (query) => `https://www.idefix.com/search?Q=${encodeURIComponent(query)}`,
    selector: '.product-item',
    extract: ($, el) => {
      const title = $(el).find('.product-name').text().trim();
      const price = $(el).find('.price').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  },
  'MediaMarkt': {
    url: (query) => `https://www.mediamarkt.com.tr/tr/category/_${encodeURIComponent(query)}.html`,
    selector: '.product-wrapper',
    extract: ($, el) => {
      const title = $(el).find('.product-title').text().trim();
      const price = $(el).find('.price').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  },
  'Cimri': {
    url: (query) => `https://www.cimri.com/${encodeURIComponent(query)}`,
    selector: '.s1a9kvkv',
    extract: ($, el) => {
      const title = $(el).find('.s1a9kvkv-0').text().trim();
      const price = $(el).find('.s15oq9e4-0').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  },
  'Epey': {
    url: (query) => `https://www.epey.com/${encodeURIComponent(query.replace(/\s+/g, '-'))}.html`,
    selector: '.urun',
    extract: ($, el) => {
      const title = $(el).find('.urunadi').text().trim();
      const price = $(el).find('.urunfiyat').text().trim();
      const link = $(el).find('a').attr('href');
      return { title, price, link };
    }
  }
};

// Site'den veri çek
async function scrapeSite(siteName, query) {
  const site = SITES[siteName];
  try {
    const response = await axios.get(site.url(query), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    $(site.selector).each((i, el) => {
      if (products.length >= 3) return false;
      
      try {
        const { title, price, link } = site.extract($, el);
        if (title && price) {
          products.push({
            site: siteName,
            urun: title.substring(0, 70),
            fiyat: price,
            link: link ? (link.startsWith('http') ? link : new URL(link, site.url(query)).href) : site.url(query)
          });
        }
      } catch (err) {
        console.error(`${siteName} hata:`, err.message);
      }
    });
    
    return products;
  } catch (error) {
    console.error(`${siteName} hata:`, error.message);
    return [{
      site: siteName,
      urun: query,
      fiyat: 'Siteye git →',
      link: site.url(query)
    }];
  }
}

// ==================== API ENDPOINT'LERİ ====================

// 1. ANA FİYAT ÇEKME
app.post('/api/fiyat-cek', async (req, res) => {
  try {
    const { urun } = req.body;
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ error: 'En az 2 karakter girin' });
    }
    
    const query = urun.trim();
    
    // Cache kontrol
    const cacheKey = query.toLowerCase();
    const cached = priceCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return res.json(cached.data);
    }
    
    // Tüm sitelerden veri çek
    const promises = Object.keys(SITES).map(site => scrapeSite(site, query));
    const results = await Promise.allSettled(promises);
    
    let allProducts = [];
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allProducts = allProducts.concat(result.value);
      }
    });
    
    // Sırala ve kupa ekle
    const sortedProducts = sortAndRankProducts(allProducts, query);
    
    const response = {
      success: true,
      query: query,
      fiyatlar: sortedProducts.slice(0, 15),
      count: sortedProducts.length,
      cheapest: sortedProducts[0] || null,
      timestamp: new Date().toISOString()
    };
    
    // Cache'e kaydet
    priceCache.set(cacheKey, {
      timestamp: Date.now(),
      data: response
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('API hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sunucu hatası',
      fiyatlar: []
    });
  }
});

// 2. KAMERA İLE ÜRÜN TARAMA (GOOGLE LENS)
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.post('/api/kamera-tara', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Resim yüklenmedi' });
    }
    
    const imagePath = req.file.path;
    
    // Resmi işle
    await sharp(imagePath)
      .resize(800, 800, { fit: 'inside' })
      .grayscale()
      .toFile(imagePath + '_processed.jpg');
    
    // OCR ile metin oku
    const worker = await createWorker('tur');
    const { data: { text } } = await worker.recognize(imagePath + '_processed.jpg');
    await worker.terminate();
    
    // Ürün adını bul
    const extractedText = text.toLowerCase();
    let detectedProduct = '';
    
    // Markaları ara
    const brands = ['iphone', 'samsung', 'xiaomi', 'huawei', 'apple', 'sony', 'lg'];
    const lines = extractedText.split('\n').filter(line => line.trim().length > 3);
    
    for (const line of lines) {
      for (const brand of brands) {
        if (line.includes(brand)) {
          detectedProduct = line.trim();
          break;
        }
      }
      if (detectedProduct) break;
    }
    
    if (!detectedProduct && lines.length > 0) {
      detectedProduct = lines[0].trim();
    }
    
    // Bulunan ürünle arama yap
    const searchQuery = detectedProduct || 'elektronik ürün';
    const searchResults = await Promise.all([
      scrapeSite('Trendyol', searchQuery),
      scrapeSite('Hepsiburada', searchQuery)
    ]);
    
    const allResults = searchResults.flat();
    const sortedResults = sortAndRankProducts(allResults, searchQuery);
    
    // Temizlik
    await fs.unlink(imagePath).catch(() => {});
    await fs.unlink(imagePath + '_processed.jpg').catch(() => {});
    
    res.json({
      success: true,
      detectedProduct,
      searchQuery,
      results: sortedResults.slice(0, 10),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Kamera tarama hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Resim işleme hatası',
      results: []
    });
  }
});

// 3. FAVORİ İŞLEMLERİ
app.post('/api/favori-ekle', (req, res) => {
  try {
    const { userId, urun, fiyat, site, link } = req.body;
    
    if (!userId || !urun) {
      return res.status(400).json({ error: 'Eksik bilgi' });
    }
    
    const userFavs = favoriUrunler.get(userId) || [];
    
    // Aynı ürünü kontrol et
    const existingIndex = userFavs.findIndex(fav => 
      fav.urun === urun && fav.site === site
    );
    
    if (existingIndex > -1) {
      userFavs[existingIndex] = {
        urun, fiyat, site, link,
        eklenmeTarihi: new Date().toISOString()
      };
    } else {
      userFavs.push({
        urun, fiyat, site, link,
        eklenmeTarihi: new Date().toISOString()
      });
    }
    
    favoriUrunler.set(userId, userFavs);
    
    // İndirim takibi başlat
    const takipKey = `${userId}-${urun}-${site}`;
    indirimTakip.set(takipKey, {
      eskiFiyat: extractPrice(fiyat),
      takipBaslangic: new Date(),
      userId, urun, site, link,
      bildirimSeviye: 10 // %10 indirimde bildirim
    });
    
    res.json({
      success: true,
      message: 'Favorilere eklendi',
      total: userFavs.length
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Favori ekleme hatası' });
  }
});

app.get('/api/favoriler/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userFavs = favoriUrunler.get(userId) || [];
    
    // En düşük fiyata göre sırala
    const sorted = userFavs.sort((a, b) => {
      const priceA = extractPrice(a.fiyat);
      const priceB = extractPrice(b.fiyat);
      return priceA - priceB;
    });
    
    res.json({
      success: true,
      favoriler: sorted,
      count: sorted.length
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Favorileri getirme hatası' });
  }
});

app.delete('/api/favori-sil/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { urun, site } = req.body;
    
    const userFavs = favoriUrunler.get(userId) || [];
    const newFavs = userFavs.filter(fav => 
      !(fav.urun === urun && fav.site === site)
    );
    
    favoriUrunler.set(userId, newFavs);
    
    // İndirim takibini sil
    const takipKey = `${userId}-${urun}-${site}`;
    indirimTakip.delete(takipKey);
    
    res.json({
      success: true,
      message: 'Favoriden silindi',
      count: newFavs.length
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Favori silme hatası' });
  }
});

// 4. İNDİRİM BİLDİRİM SİSTEMİ
async function checkDiscounts() {
  console.log('🔔 İndirim kontrolü başlıyor...');
  
  for (const [key, data] of indirimTakip.entries()) {
    try {
      // Güncel fiyatı al
      const results = await scrapeSite(data.site, data.urun);
      if (results.length > 0 && results[0].fiyat) {
        const currentPrice = extractPrice(results[0].fiyat);
        
        if (currentPrice < data.eskiFiyat) {
          const indirimOrani = ((data.eskiFiyat - currentPrice) / data.eskiFiyat * 100);
          
          // Belirlenen seviyeden fazla indirim varsa
          if (indirimOrani >= (data.bildirimSeviye || 10)) {
            console.log(`🎉 İNDİRİM! ${data.urun}: %${indirimOrani.toFixed(0)} indirim!`);
            
            // Burada push notification gönderilecek
            // Örnek: Firebase Cloud Messaging
            
            // Fiyatı güncelle
            data.eskiFiyat = currentPrice;
            data.sonIndirimTarihi = new Date();
            data.indirimOrani = indirimOrani;
          }
        }
      }
    } catch (error) {
      console.error(`İndirim kontrol hatası (${key}):`, error.message);
    }
  }
}

// Her saat başı kontrol
cron.schedule('0 * * * *', checkDiscounts);

// İndirim bildirim seviyesini ayarla
app.post('/api/indirim-bildirim-ayarla', (req, res) => {
  try {
    const { userId, urun, site, seviye } = req.body; // seviye: 10, 20, 30
    
    const takipKey = `${userId}-${urun}-${site}`;
    const data = indirimTakip.get(takipKey);
    
    if (data) {
      data.bildirimSeviye = seviye;
      res.json({
        success: true,
        message: `İndirim bildirim seviyesi %${seviye} olarak ayarlandı`
      });
    } else {
      res.status(404).json({ error: 'Ürün bulunamadı' });
    }
    
  } catch (error) {
    res.status(500).json({ error: 'Bildirim ayarı hatası' });
  }
});

// 5. AI YORUMLAMA
app.post('/api/ai-yorum', async (req, res) => {
  try {
    const { urun, fiyatlar, userId } = req.body;
    
    // OpenAI kontrol
    if (!openai) {
      return res.json({
        success: true,
        yorum: "AI yorumlama aktif değil",
        tavsiye: "OpenAI API key'i Render Environment'a ekleyin"
      });
    }
    
    // Fiyat analizi
    const prices = fiyatlar.map(f => extractPrice(f.fiyat)).filter(p => p < Infinity);
    const enUcuz = Math.min(...prices);
    const enPahali = Math.max(...prices);
    const ortalama = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // OpenAI'ye sor
    const prompt = `
    Ürün: ${urun}
    Fiyat Aralığı: ${formatPrice(enUcuz)} - ${formatPrice(enPahali)}
    Ortalama: ${formatPrice(ortalama)}
    
    Bu ürün için:
    1. Fiyatlar makul mu?
    2. Hangi siteden almalı?
    3. Beklemeli mi?
    
    Kısa ve net Türkçe cevap ver.
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300
    });
    
    const aiCevap = completion.choices[0].message.content;
    
    res.json({
      success: true,
      yorum: `"${urun}" için AI analizi:`,
      aiYorum: aiCevap,
      detay: {
        enUcuz: formatPrice(enUcuz),
        enPahali: formatPrice(enPahali),
        ortalama: formatPrice(ortalama),
        siteSayisi: fiyatlar.length
      }
    });
    
  } catch (error) {
    console.error('AI hatası:', error);
    res.json({
      success: true,
      yorum: "AI şu anda kullanılamıyor",
      aiYorum: "Fiyatları manuel karşılaştırın"
    });
  }
});

// 6. SAĞLIK KONTROLÜ
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    time: new Date().toISOString(),
    version: '4.0.0',
    sites: Object.keys(SITES).length,
    cache: priceCache.size,
    favorites: favoriUrunler.size,
    discountTracking: indirimTakip.size,
    ai: openai ? 'Aktif' : 'API key gerekli'
  });
});

// 7. ANA SAYFA
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>FiyatTakip API v4.0</title>
    <style>
      body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
      h1 { color: #333; }
      .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
      code { background: #eee; padding: 2px 5px; border-radius: 3px; }
      button { background: #4CAF50; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; }
      button:hover { background: #45a049; }
    </style>
  </head>
  <body>
    <h1>🚀 FiyatTakip API v4.0</h1>
    <p>13+ e-ticaret sitesinde akıllı fiyat karşılaştırma</p>
    
    <div class="endpoint">
      <h3>POST /api/fiyat-cek</h3>
      <p>Body: <code>{"urun": "iphone 15 pro"}</code></p>
      <p>En düşük fiyat üstte 🥇🥈🥉</p>
    </div>
    
    <div class="endpoint">
      <h3>POST /api/kamera-tara</h3>
      <p>Form-data: <code>image (file)</code></p>
      <p>Google Lens gibi ürün tarama</p>
    </div>
    
    <div class="endpoint">
      <h3>POST /api/favori-ekle</h3>
      <p>Body: <code>{"userId": "...", "urun": "...", "fiyat": "...", "site": "...", "link": "..."}</code></p>
    </div>
    
    <div class="endpoint">
      <h3>POST /api/ai-yorum</h3>
      <p>AI ile fiyat analizi (OpenAI gerekli)</p>
    </div>
    
    <p><a href="/health">/health</a> - Sistem durumu</p>
    
    <h3>Test:</h3>
    <input type="text" id="urunInput" placeholder="Ürün adı" value="iphone 15">
    <button onclick="testAPI()">Test Et</button>
    <div id="testResults"></div>
    
    <script>
      async function testAPI() {
        const urun = document.getElementById('urunInput').value;
        const resultsDiv = document.getElementById('testResults');
        resultsDiv.innerHTML = '⏳ Test ediliyor...';
        
        try {
          const response = await fetch('/api/fiyat-cek', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urun: urun })
          });
          
          const data = await response.json();
          
          if (data.success && data.fiyatlar.length > 0) {
            let html = '<h4>Sonuçlar (' + data.fiyatlar.length + ' ürün):</h4>';
            data.fiyatlar.forEach(item => {
              html += \`<div style="margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 5px;">
                <strong>\${item.site}</strong> \${item.badge ? item.badge : ''}<br>
                \${item.urun}<br>
                <strong style="color: green;">\${item.fiyat}</strong><br>
                <a href="\${item.link}" target="_blank">🔗 Siteye Git</a>
              </div>\`;
            });
            resultsDiv.innerHTML = html;
          } else {
            resultsDiv.innerHTML = '❌ Sonuç bulunamadı';
          }
        } catch (error) {
          resultsDiv.innerHTML = '❌ API hatası';
        }
      }
      
      // Sayfa açıldığında test et
      window.onload = testAPI;
    </script>
  </body>
  </html>
  `);
});

// ==================== SERVER BAŞLATMA ====================
const PORT = process.env.PORT || 3000;

// Klasörleri oluştur
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API v4.0 ${PORT} portunda çalışıyor`);
  console.log(`🌐 ${Object.keys(SITES).length} site destekleniyor`);
  console.log(`📱 Endpoint: http://localhost:${PORT}/api/fiyat-cek`);
  console.log(`🔔 İndirim takibi aktif`);
  console.log(`🤖 AI: ${openai ? 'Aktif' : 'API key gerekli'}`);
});
