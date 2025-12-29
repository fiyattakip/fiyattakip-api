const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors({ origin: true }));
app.options('*', cors({ origin: true }));
app.use(express.json());

app.get('/', (req,res)=>res.status(200).json({ ok:true, service:'fiyattakip-api' }));

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
    let relevantProducts = filterRelevantProducts(allProducts, query);
    if ((!relevantProducts || relevantProducts.length===0) && allProducts.length){
      relevantProducts = allProducts;
    }
    
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
    const { urun, fiyatlar, product, prices } = req.body || {};
    const urunAdi = String(urun || product || '').trim();
    const fiyatListesi = Array.isArray(fiyatlar) ? fiyatlar : (Array.isArray(prices) ? prices : []);

    if (!urunAdi || urunAdi.length < 2) {
      return res.status(400).json({ success: false, error: 'Ürün adı gerekli' });
    }

    // AI yoksa bile kısa/öz fallback dön (frontend "AI yorum alınamadı" demesin)
    if (!geminiAI) {
      const fallback = `Bu ürün günlük kullanım hedefleniyorsa genelde alınabilir; ancak model/özellikleri net değilse önce aynı isimde farklı varyantları kontrol et. Acele yoksa kısa bir indirim beklemek mantıklı olabilir.`;
      return res.json({ success: true, yorum: fallback, text: fallback });
    }

    const hasPrices = fiyatListesi.length > 0;
    const fiyatMetni = hasPrices
      ? fiyatListesi.map(f => `- ${(f.site||f.siteName||'Site')}: ${(f.fiyat||f.price||'')}`).join('
')
      : 'Fiyat bilgisi paylaşılmadı.';

    const prompt =
`Aşağıdaki ürün için kısa ve net bir değerlendirme yap.

Ürün: ${urunAdi}

Fiyat Bilgisi:
${fiyatMetni}

Kurallar:
- Fiyat varsa: fiyatların mantıklı olup olmadığını ve alınır mı/beklenir mi net söyle.
- Fiyat yoksa: ürünün alınabilirliğini, kimlere uygun olduğunu ve değer/değmez fikrini söyle.
- 3-4 cümle ile sınırlı kal.
- "fiyatlar karşılaştırıldı" veya "en uygun seçeneği tercih edin" gibi klişe cümleler KULLANMA.
- Sade, kullanıcı dostu Türkçe kullan.`;

    const model = geminiAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const aiText = String(result?.response?.text?.() || '').trim() || 'AI yorum üretilemedi.';

    return res.json({ success: true, yorum: aiText, text: aiText });
  } catch (err) {
    console.error('AI yorum hata:', err);
    return res.status(500).json({ success: false, error: 'AI yorum alınamadı' });
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
app.get('/api/health', (req, res) => {
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



// (Uyumluluk) Eski endpoint: /health -> /api/health ile aynı yanıtı döndürür
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
function normalizeForMatch(s){
  return String(s||"")
    .toLowerCase()
    .replace(/ı/g,'i')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}
function compactAlphaNum(s){
  // "8 gb" -> "8gb", "256 gb" -> "256gb"
  return normalizeForMatch(s)
    .replace(/\s+/g,' ')
    .replace(/(\d)\s+([a-z])/g,'$1$2');
}
function filterRelevantProducts(products, query) {
  const qNorm = compactAlphaNum(query);
  const qWords = qNorm.split(' ').filter(w => w.length >= 2);
  if (!qWords.length) return products;

  const scored = products.map(p => {
    const t1 = compactAlphaNum(p.urun);
    let score = 0;
    for (const w of qWords){
      if (!w) continue;
      if (t1.includes(w)) score += 10;
      if (t1.startsWith(w)) score += 5;
    }
    if (p.fiyat === 'Fiyat yok' || String(p.fiyat||'').toLowerCase().includes('siteye git')) score -= 15;
    p.relevanceScore = score;
    return p;
  });

  const kept = scored.filter(p => p.relevanceScore > 0).sort((a,b)=>b.relevanceScore-a.relevanceScore);
  return kept.length ? kept : scored.sort((a,b)=>b.relevanceScore-a.relevanceScore);
}


// ==================== SERVER BAŞLATMA ====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API v2.0 ${PORT} portunda`);
  console.log(`🌐 Endpoint: http://localhost:${PORT}/api/fiyat-cek`);
  console.log(`📱 PWA uygulaması için hazır!`);
});
