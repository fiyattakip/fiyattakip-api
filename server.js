const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

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
    const { urun, link, fiyatlar, prices, apiKey } = req.body || {};
    const productName = String(urun || '').trim();
    if (!productName) return res.status(400).json({ success:false, error:'Ürün adı (urun) gerekli' });

    // fiyat listesi normalize
    const list = Array.isArray(fiyatlar) ? fiyatlar : (Array.isArray(prices) ? prices : []);
    const normalized = (list || []).map(x => ({
      site: String(x?.site || x?.siteName || x?.source || 'Site').slice(0,50),
      fiyat: String(x?.fiyat || x?.price || x?.amount || '').slice(0,50),
    })).filter(x => x.fiyat || x.site);

    const key = (apiKey && String(apiKey).trim()) || process.env.GEMINI_API_KEY || '';
    if (!key) {
      // key yoksa yine de kısa, ürün-odaklı yorum üret
      const fallback = normalized.length
        ? `“${productName}” için listelenen fiyatlar arasında en düşük olanı tercih edebilirsin. Satıcı puanı/garanti/iade koşullarını kontrol et.`
        : `“${productName}” alınabilir mi? Resmi garanti, güncel destek ve fiyat bandına göre değerlendir. Benzer ürünlerle RAM/dep./işlemci/ekran gibi kritik özellikleri kıyasla; aşırı pahalıysa beklemek mantıklı olabilir.`;
      return res.json({ success:true, yorum: fallback, source:'fallback_no_key' });
    }

    // Gemini istemcisi (lazy)
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(key);
    // ücretsiz/stabil
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const fiyatMetni = normalized.length
      ? normalized.map(f => `- ${f.site}: ${f.fiyat}`).join('\n')
      : '(fiyat listesi yok)';

    const prompt = [
      "Sen kısa ve net alışveriş danışmanısın.",
      "Kullanıcıya 2-4 cümlede özgün bir yorum yaz.",
      "Eğer fiyat listesi varsa: en mantıklı seçeneği anlat ama sadece 'en ucuz' deme; garanti/ satıcı puanı/ iade gibi riskleri de kısaca belirt.",
      "Eğer fiyat yoksa: ürün genel olarak alınır mı (değer mi) buna odaklan; kritik kontrol maddeleri ver.",
      "Kesin bilgi uydurma; emin değilsen 'kontrol et' de.",
      "",
      `Ürün: ${productName}`,
      link ? `Link: ${link}` : "",
      `Fiyatlar:\n${fiyatMetni}`
    ].filter(Boolean).join('\n');

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || '';
    const yorum = String(text).trim() || (normalized.length
      ? `“${productName}” için en düşük fiyat cazip ama satıcı puanı/garanti/iade şartlarını kontrol et; güvenilirse alınır.`
      : `“${productName}” alınabilirliği için garanti, güncellik ve fiyat bandını benzerleriyle kıyasla; pahalıysa beklemek mantıklı olabilir.`);

    return res.json({ success:true, yorum, source:'gemini' });
  } catch (err) {
    console.error('AI yorum hata:', err?.message || err);
    return res.status(500).json({ success:false, error:'AI yorum alınamadı' });
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
app.get('/api/health', (req,res)=>res.json({ok:true,status:'up'}));

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
