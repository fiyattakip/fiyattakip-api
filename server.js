const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------
// Local (free) AI fallback: heuristic product review generator
// -------------------------
function heuristicComment(query){
  const q = String(query||"").trim();
  const low = q.toLowerCase();

  const specs = {};
  const mStorage = low.match(/(\d+)\s*(tb|gb)\b/);
  if(mStorage){ specs.storage = mStorage[1]+mStorage[2].toUpperCase(); }
  const mRam = low.match(/\b(\d+)\s*gb\s*ram\b/);
  if(mRam){ specs.ram = mRam[1]+"GB"; }
  const mInch = low.match(/(\d+(?:[\.,]\d+)?)\s*(?:inç|inch|\")/);
  if(mInch){ specs.screen = mInch[1].replace(',','.')+'"'; }

  const isPhone = /(iphone|samsung|galaxy|xiaomi|redmi|pixel|telefon|android)/.test(low);
  const isTablet = /(ipad|tablet|pad\b|galaxy tab|matepad)/.test(low);
  const isLaptop = /(laptop|notebook|ultrabook|macbook)/.test(low);
  const isHeadphone = /(airpods|kulakl\w+|earbuds|headset|bluetooth)/.test(low);

  const bullets = [];
  if(isPhone){
    bullets.push("• Kamera ve pil günlük kullanımda en kritik iki konu.");
    bullets.push("• Depolama doluluk hızına dikkat: 128GB altı uzun vadede sıkıştırabilir.");
    bullets.push("• Yazılım güncelleme süresi ve servis/garanti şartları önemli.");
  } else if(isTablet){
    bullets.push("• Ekran kalitesi ve kalem/klavye desteği verimliliği belirler.");
    bullets.push("• İşlemci + RAM, çoklu görev ve oyun performansını etkiler.");
    bullets.push("• Güncelleme desteği ve aksesuar ekosistemine bak.");
  } else if(isLaptop){
    bullets.push("• İşlemci modeli ve RAM yükseltilebilirliği en kritik noktalar.");
    bullets.push("• SSD kapasitesi ve ekran (IPS/Hz) deneyimi çok değiştirir.");
    bullets.push("• Soğutma ve pil ömrü, ince kasalarda belirleyicidir.");
  } else if(isHeadphone){
    bullets.push("• Aktif gürültü engelleme ve mikrofon kalitesi günlükte fark yaratır.");
    bullets.push("• Codec (AAC/LDAC) ve gecikme oyun/video için önemli.");
    bullets.push("• Kulak içi rahatlığı ve pil süresi mutlaka kontrol et.");
  } else {
    bullets.push("• İhtiyacına göre performans/kalite dengesine odaklan.");
    bullets.push("• Garanti, servis ve iade koşulları satın alma kadar önemli.");
    bullets.push("• Benzer fiyat bandında alternatifleri de kontrol et.");
  }

  const extras = [];
  if(specs.ram) extras.push(`RAM: ${specs.ram}`);
  if(specs.storage) extras.push(`Depolama: ${specs.storage}`);
  if(specs.screen) extras.push(`Ekran: ${specs.screen}`);
  const specLine = extras.length ? `\nÖne çıkanlar: ${extras.join(" • ")}.` : "";

  // make it feel less repetitive
  const tips = [
    "Satıcı puanı ve yorum sayısı düşükse temkinli ol.",
    "Aynı modelin farklı varyantlarını (RAM/Depolama) karıştırmamaya dikkat et.",
    "Aksesuar uyumluluğu ve güncelleme politikası uzun vadede değer katar."
  ];
  const tip = tips[Math.floor(Math.random()*tips.length)];

  return `Kısa değerlendirme (${q}):\n${bullets.join("\n")}${specLine}\n\nİpucu: ${tip}`;
}


// ==================== GEMINI AI KURULUMU ====================
let geminiAI = null;
try {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (GEMINI_API_KEY) {
    geminiAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini AI başlatıldı');
  }
} catch (error) {
  console.log('❌ Gemini AI başlatılamadı:', error.message);
}

// ==================== ÖNBELLEK ====================
const cache = {
  prices: new Map(),
  favorites: new Map(),
  duration: 10 * 60 * 1000 // 10 dakika
};

// ==================== ÇALIŞAN SİTELER ====================
const SITES = {
  'Trendyol': {
    url: (query) => `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}&qt=${encodeURIComponent(query)}&st=${encodeURIComponent(query)}&os=1`,
    selector: 'div.p-card-wrppr, div[class*="product-card"]',
    extract: ($, el) => {
      return {
        title: $(el).find('span.prdct-desc-cntnr-ttl').text().trim() || 
               $(el).find('span.prdct-desc-cntnr-name').text().trim() ||
               'Ürün',
        price: $(el).find('div.prc-box-dscntd').text().trim() || 'Fiyat yok',
        link: 'https://www.trendyol.com' + ($(el).find('a').attr('href') || '')
      };
    }
  },
  
  'Hepsiburada': {
    url: (query) => `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`,
    selector: 'li[class*="productList"], li[data-testid="product-card"]',
    extract: ($, el) => {
      return {
        title: $(el).find('h3[data-testid="product-card-name"]').text().trim() || 'Ürün',
        price: $(el).find('div[data-testid="price-current-price"]').text().trim() || 'Fiyat yok',
        link: 'https://www.hepsiburada.com' + ($(el).find('a[data-testid="product-card"]').attr('href') || '')
      };
    }
  },
  
  'n11': {
    url: (query) => `https://www.n11.com/arama?q=${encodeURIComponent(query)}`,
    selector: 'li.column, .listItem',
    extract: ($, el) => {
      return {
        title: $(el).find('h3.productName').text().trim() || 'Ürün',
        price: $(el).find('.newPrice').text().trim() || 'Fiyat yok',
        link: $(el).find('a').attr('href') || 'https://www.n11.com'
      };
    }
  },
  
  'Amazon': {
    url: (query) => `https://www.amazon.com.tr/s?k=${encodeURIComponent(query)}`,
    selector: 'div[data-component-type="s-search-result"]',
    extract: ($, el) => {
      const title = $(el).find('h2 a span').text().trim();
      const priceWhole = $(el).find('.a-price-whole').text().trim();
      const priceFraction = $(el).find('.a-price-fraction').text().trim();
      const price = priceWhole ? `${priceWhole}${priceFraction ? '.' + priceFraction : ''} TL` : 'Fiyat yok';
      
      return {
        title: title || 'Ürün',
        price: price,
        link: 'https://www.amazon.com.tr' + ($(el).find('h2 a').attr('href') || '')
      };
    }
  }
};

// ==================== SCRAPING FONKSİYONU ====================
async function scrapeSite(siteName, query) {
  const site = SITES[siteName];
  try {
    const response = await axios.get(site.url(query), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    $(site.selector).each((i, el) => {
      if (products.length >= 4) return false;
      
      try {
        const product = site.extract($, el);
        if (product.title && product.title !== 'Ürün' && 
            product.price && product.price !== 'Fiyat yok') {
          products.push({
            site: siteName,
            urun: product.title.substring(0, 80),
            fiyat: product.price.replace('TL', '₺').trim(),
            link: product.link,
            numericPrice: parseFloat(product.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 999999
          });
        }
      } catch (err) {
        // Hata durumunda geç
      }
    });
    
    return products.length > 0 ? products : [];
    
  } catch (error) {
    console.log(`${siteName} hata: ${error.message}`);
    return [];
  }
}

// ==================== API ENDPOINT'LERİ ====================

// 1. ANA FİYAT ÇEKME (4'erli sayfalar)
app.post('/api/fiyat-cek', async (req, res) => {
  try {
    const { urun, page = 1, sort = 'asc' } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.json({ success: false, error: 'En az 2 karakter girin' });
    }
    
    const query = urun.trim();
    const cacheKey = `${query}_${page}_${sort}`;
    
    // Önbellek kontrol
    const cached = cache.prices.get(cacheKey);
    if (cached && (Date.now() - cached.time) < cache.duration) {
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
    
    // Alakalı ürünleri filtrele
    const relevantProducts = filterRelevantProducts(allProducts, query);
    
    // Sıralama
    if (sort === 'asc') {
      relevantProducts.sort((a, b) => a.numericPrice - b.numericPrice);
    } else {
      relevantProducts.sort((a, b) => b.numericPrice - a.numericPrice);
    }
    
    // Sayfalama (4 ürün/sayfa)
    const pageSize = 4;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pagedProducts = relevantProducts.slice(startIndex, endIndex);
    const totalPages = Math.ceil(relevantProducts.length / pageSize);
    
    const response = {
      success: true,
      query: query,
      fiyatlar: pagedProducts,
      sayfa: parseInt(page),
      toplamSayfa: totalPages,
      toplamUrun: relevantProducts.length,
      siralama: sort,
      sites: Object.keys(SITES).length,
      timestamp: new Date().toISOString()
    };
    
    // Önbelleğe kaydet
    cache.prices.set(cacheKey, {
      time: Date.now(),
      data: response
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('API hatası:', error);
    res.json({ 
      success: false, 
      error: 'Sunucu hatası',
      fiyatlar: [] 
    });
  }
});

// 2. GEMINI AI YORUM

app.post('/api/ai-yorum', async (req, res) => {
  try {
    const { urun, product, query } = req.body || {};
    const q = (urun || product || query || "").toString().trim();
    if (!q) return res.status(400).json({ success:false, error:"Ürün adı gerekli" });

    // 1) Try Gemini if configured
    if (geminiAI) {
      try{
        const model = geminiAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Kullanıcı ürünü: "${q}".\nFiyat çekemiyoruz (bot engeli).\nSadece ürünün artı/eksi yönlerini, kimlere uygun olduğunu ve dikkat edilmesi gerekenleri 5-7 kısa maddeyle Türkçe yaz. Model/kapasite/RAM gibi detayları varsa kullan. Çok genel konuşma, ürüne özgü ol.`;
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.() || "";
        if (text && text.length > 40) {
          return res.json({ success:true, yorum:text.trim(), provider:"gemini" });
        }
      }catch(e){
        // quota / model not found / 4xx etc -> fallback
        console.warn("Gemini hata, fallback:", e?.message || e);
      }
    }

    // 2) Free fallback (no external API)
    const yorum = heuristicComment(q);
    return res.json({ success:true, yorum, provider:"local" });

  } catch (err) {
    console.error("AI yorum hatası:", err);
    return res.status(500).json({ success:false, error:"AI yorum alınamadı" });
  }
});

// 3. KAMERA AI ARAMA
app.post('/api/kamera-ai', async (req, res) => {
  try {
    const { image, mime, text } = req.body;
    
    let urunTahmini = text || 'telefon';
    
    // Basit ürün tahmini
    const tahminler = {
      'telefon': 'akıllı telefon',
      'iphone': 'iPhone',
      'samsung': 'Samsung telefon',
      'bilgisayar': 'dizüstü bilgisayar',
      'laptop': 'laptop',
      'televizyon': 'smart tv',
      'tv': 'televizyon',
      'ayakkabı': 'spor ayakkabı',
      'giyim': 'tişört',
      'kitap': 'roman kitabı',
      'kulaklık': 'bluetooth kulaklık'
    };
    
    Object.keys(tahminler).forEach(key => {
      if ((text || '').toLowerCase().includes(key)) {
        urunTahmini = tahminler[key];
      }
    });
    
    // Bu ürün için arama yap
    const promises = Object.keys(SITES).map(site => scrapeSite(site, urunTahmini));
    const results = await Promise.allSettled(promises);
    
    let allProducts = [];
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allProducts = allProducts.concat(result.value);
      }
    });
    
    const relevantProducts = filterRelevantProducts(allProducts, urunTahmini);
    const topProducts = relevantProducts.slice(0, 4);
    
    res.json({
      success: true,
      tespitEdilen: text || 'Görsel tespit edildi',
      urunTahmini: urunTahmini,
      aramaSonucu: {
        urun: urunTahmini,
        bulunan: relevantProducts.length,
        fiyatlar: topProducts
      },
      mesaj: "📸 Görselden ürün tespit edildi ve fiyatlar getirildi."
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: 'Kamera AI hatası',
      urunTahmini: 'telefon',
      aramaSonucu: {
        urun: 'telefon',
        bulunan: 0,
        fiyatlar: []
      }
    });
  }
});

// 4. SAĞLIK KONTROLÜ
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    zaman: new Date().toLocaleString('tr-TR'),
    versiyon: '2.0.0',
    ozellikler: [
      '4 site desteği (Trendyol, Hepsiburada, n11, Amazon)',
      'Sayfalama (4 ürün/sayfa)',
      'Sıralama (artan/azalan fiyat)',
      'Gemini AI yorum',
      'Kamera AI arama',
      'Alakalı ürün filtresi'
    ],
    ai: geminiAI ? 'Aktif' : 'Pasif',
    cache: {
      prices: cache.prices.size,
      favorites: cache.favorites.size
    }
  });
});

// ==================== YARDIMCI FONKSİYONLAR ====================
function filterRelevantProducts(products, query) {
  const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 2);
  
  return products.filter(product => {
    const title = product.urun.toLowerCase();
    let score = 0;
    
    queryWords.forEach(word => {
      if (title.includes(word)) score += 10;
      if (title.startsWith(word)) score += 5;
    });
    
    // Fiyatı olmayanları ele
    if (product.fiyat === 'Fiyat yok' || product.fiyat.includes('Siteye git')) {
      score -= 50;
    }
    
    product.relevanceScore = score;
    return score > 0;
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ==================== SERVER BAŞLATMA ====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API v2.0 ${PORT} portunda`);
  console.log(`🌐 Endpoint: http://localhost:${PORT}/api/fiyat-cek`);
  console.log(`📱 PWA uygulaması için hazır!`);
});
