const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== AYARLAR ====================
const priceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

const favoriUrunler = new Map();
const indirimTakip = new Map();

// ==================== YARDIMCI FONKSİYONLAR ====================
function extractPrice(priceStr) {
  if (!priceStr) return Infinity;
  const matches = priceStr.match(/(\d+[.,]\d+|\d+)/);
  return matches ? parseFloat(matches[0].replace(',', '.')) : Infinity;
}

function formatPrice(price) {
  if (price === Infinity) return 'Fiyat yok';
  return new Intl.NumberFormat('tr-TR', { 
    style: 'currency', 
    currency: 'TRY' 
  }).format(price);
}

function sortAndRankProducts(products, searchQuery) {
  const withNumericPrice = products.map(p => ({
    ...p,
    numericPrice: extractPrice(p.fiyat)
  }));
  
  const sorted = withNumericPrice.sort((a, b) => a.numericPrice - b.numericPrice);
  
  return sorted.map((p, index) => ({
    ...p,
    fiyat: formatPrice(p.numericPrice),
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

// 2. KAMERA İLE ÜRÜN TARAMA (BASİT)
app.post('/api/kamera-tara', (req, res) => {
  res.json({
    success: true,
    message: 'Kamera tarama aktif değil. İleride eklenecek.',
    detectedProduct: 'Ürün tanınamadı',
    results: []
  });
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
    
    res.json({
      success: true,
      message: 'Favoriden silindi',
      count: newFavs.length
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Favori silme hatası' });
  }
});

// 4. AI YORUMLAMA (BASİT)
app.post('/api/ai-yorum', (req, res) => {
  try {
    const { urun, fiyatlar } = req.body;
    
    // Fiyat analizi
    const fiyatListesi = fiyatlar.map(f => extractPrice(f.fiyat)).filter(p => p < Infinity);
    
    if (fiyatListesi.length === 0) {
      return res.json({
        success: true,
        yorum: "Fiyat verisi bulunamadı.",
        tavsiye: "Farklı bir ürün aramayı deneyin."
      });
    }
    
    const enUcuz = Math.min(...fiyatListesi);
    const enPahali = Math.max(...fiyatListesi);
    const ortalamaFiyat = fiyatListesi.reduce((a, b) => a + b, 0) / fiyatListesi.length;
    const indirimOrani = ((enPahali - enUcuz) / enPahali * 100);
    
    // Basit yorum
    let yorum = "";
    if (indirimOrani > 30) yorum = "🚀 HARİKA FIRSAT! Çok yüksek indirim farkı var.";
    else if (indirimOrani > 20) yorum = "👍 İyi fırsat, alınabilir.";
    else if (indirimOrani > 10) yorum = "👌 Normal fiyat aralığında.";
    else yorum = "ℹ️ Fiyatlar birbirine yakın.";
    
    const enUcuzSite = fiyatlar.find(f => extractPrice(f.fiyat) === enUcuz)?.site || "Bilinmiyor";
    
    res.json({
      success: true,
      yorum: `"${urun}" için ${fiyatlar.length} sitede analiz:`,
      aiYorum: `${yorum} En uygun fiyat ${formatPrice(enUcuz)} ile ${enUcuzSite} sitesinde.`,
      detay: {
        enUcuzFiyat: formatPrice(enUcuz),
        enPahaliFiyat: formatPrice(enPahali),
        ortalamaFiyat: formatPrice(ortalamaFiyat),
        fiyatFarki: formatPrice(enPahali - enUcuz),
        indirimOrani: `%${Math.round(indirimOrani)}`,
        siteSayisi: fiyatlar.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('AI yorum hatası:', error);
    res.json({
      success: true,
      yorum: "AI analizi şu anda kullanılamıyor.",
      aiYorum: "Fiyatları manuel olarak karşılaştırın.",
      detay: {}
    });
  }
});

// 5. İNDİRİM BİLDİRİMİ (BASİT)
app.post('/api/indirim-bildirim-ayarla', (req, res) => {
  try {
    const { userId, urun, site, seviye } = req.body;
    
    const takipKey = `${userId}-${urun}-${site}`;
    indirimTakip.set(takipKey, {
      userId, urun, site,
      bildirimSeviye: seviye || 10,
      eklenmeTarihi: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: `İndirim bildirimi ayarlandı (%${seviye || 10} indirimde bildirim)`
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Bildirim ayarı hatası' });
  }
});

// 6. SAĞLIK KONTROLÜ
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    time: new Date().toISOString(),
    version: '4.1.0',
    sites: Object.keys(SITES).length,
    cache: priceCache.size,
    favorites: favoriUrunler.size,
    discountTracking: indirimTakip.size
  });
});

// 7. ANA SAYFA
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>FiyatTakip API v4.1</title>
    <style>
      body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
      h1 { color: #333; }
      .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
      code { background: #eee; padding: 2px 5px; border-radius: 3px; }
      button { background: #4CAF50; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; }
      button:hover { background: #45a049; }
      .test-result { margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 5px; }
    </style>
  </head>
  <body>
    <h1>🚀 FiyatTakip API v4.1</h1>
    <p>13+ e-ticaret sitesinde akıllı fiyat karşılaştırma</p>
    
    <div class="endpoint">
      <h3>POST /api/fiyat-cek</h3>
      <p>Body: <code>{"urun": "iphone 15 pro"}</code></p>
      <p>En düşük fiyat üstte 🥇🥈🥉</p>
    </div>
    
    <div class="endpoint">
      <h3>GET /health</h3>
      <p>Sistem durumu</p>
      <a href="/health" target="_blank">Test et</a>
    </div>
    
    <h3>Hemen Test Et:</h3>
    <input type="text" id="urunInput" placeholder="Ürün adı" value="iphone 15" style="width: 70%; padding: 8px;">
    <button onclick="testAPI()">Test Et</button>
    <div id="testResults"></div>
    
    <script>
      async function testAPI() {
        const urun = document.getElementById('urunInput').value;
        const resultsDiv = document.getElementById('testResults');
        resultsDiv.innerHTML = '<div class="test-result">⏳ Test ediliyor...</div>';
        
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
              html += \`<div class="test-result">
                <strong>\${item.site}</strong> \${item.badge ? item.badge : ''}<br>
                \${item.urun}<br>
                <strong style="color: green;">\${item.fiyat}</strong><br>
                <a href="\${item.link}" target="_blank">🔗 Siteye Git</a>
              </div>\`;
            });
            resultsDiv.innerHTML = html;
          } else {
            resultsDiv.innerHTML = '<div class="test-result">❌ Sonuç bulunamadı</div>';
          }
        } catch (error) {
          resultsDiv.innerHTML = '<div class="test-result">❌ API hatası</div>';
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
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API v4.1 ${PORT} portunda çalışıyor`);
  console.log(`🌐 ${Object.keys(SITES).length} site destekleniyor`);
  console.log(`📱 Endpoint: http://localhost:${PORT}/api/fiyat-cek`);
  console.log(`🏠 Ana sayfa: http://localhost:${PORT}`);
});
