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
    const { urun, fiyatlar } = req.body;
    
    if (!geminiAI) {
      return res.json({
        success: true,
        yorum: "🤖 AI şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
        aiYorum: "Gemini AI API anahtarı gerekiyor.",
        detay: {
          enUcuzFiyat: "N/A",
          enPahaliFiyat: "N/A",
          ortalamaFiyat: "N/A",
          indirimOrani: "N/A",
          siteSayisi: fiyatlar?.length || 0
        }
      });
    }
    
    if (!urun) {
      return res.json({
        success: false,
        error: 'Ürün bilgisi gerekli'
      });
    }
    
    // Gemini AI'ya soru hazırla
    const model = geminiAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const fiyatText = fiyatlar?.map(f => `${f.site}: ${f.fiyat}`).join('\n') || 'Fiyat bilgisi yok';
    
    const prompt = `
      Sen bir ürün danışmanı ve fiyat kıyas uzmanısın.
      Görev: Aşağıdaki ürünü **özellik/kalite** açısından değerlendir, sonra varsa fiyat aralığına göre satın alma tavsiyesi ver.

      Ürün sorgusu: ${urun}

      Bulunan fiyatlar (varsa):
      ${fiyatText || "Fiyat verisi yok / bulunamadı"}

      Kurallar:
      - Ürünün teknik özelliklerini uydurma. Bilmediğin yerde "özellik belirtilmemiş" de.
      - "Piyasaya sürülmedi" gibi kesin olmayan iddialar yazma.
      - Kısa, maddeli ve okunur yaz.
      - Çıktıyı HTML olarak üret: <ul><li>...</li></ul> + en sona 1 satır özet.

      İstenen çıktı:
      1) <ul> içinde 5-7 madde: Nelere dikkat etmeli (garanti, satıcı, kutu/iade, sahte risk, muadil).
      2) Eğer fiyat varsa: en ucuz siteyi ve yaklaşık fiyat aralığını söyle.
      3) 1 satır "Alınır mı?" (Evet/Hayır/Şartlı) + kısa sebep.
    `;    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text();
    
    // Basit analiz
    const prices = fiyatlar?.map(f => {
      const price = parseFloat(f.fiyat.replace(/[^\d.,]/g, '').replace(',', '.'));
      return isNaN(price) ? 0 : price;
    }).filter(p => p > 0) || [];
    
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    
    res.json({
      success: true,
      urun: urun,
      aiYorum: aiText,
      detay: {
        enUcuzFiyat: minPrice > 0 ? `₺${minPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : "N/A",
        enPahaliFiyat: maxPrice > 0 ? `₺${maxPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : "N/A",
        ortalamaFiyat: avgPrice > 0 ? `₺${avgPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : "N/A",
        indirimOrani: minPrice > 0 && maxPrice > 0 ? `%${Math.round(((maxPrice - minPrice) / maxPrice) * 100)}` : "N/A",
        siteSayisi: prices.length
      },
      tarih: new Date().toLocaleString('tr-TR')
    });
    
  } catch (error) {
    console.error('AI hatası:', error);
    res.json({
      success: false,
      error: 'AI yorum yapılamadı',
      aiYorum: "📊 Fiyatlar karşılaştırıldı. En uygun seçeneği tercih edin."
    });
  }
});

// 3. KAMERA AI ARAMA
app.post('/api/kamera-ai', async (req, res) => {
  try {
    const { image, mime, text } = req.body;
    
    let urunTahmini = text || 'telefon';

// Eğer Gemini varsa ve image geldiyse: gerçek görsel analiz
if (geminiAI && image) {
  try{
    const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([
      "Bu görseldeki ürünün en kısa ürün adı nedir? 3-6 kelime Türkçe yaz. Sadece ürün adını döndür.",
      { inlineData: { data: image, mimeType: mime || "image/jpeg" } }
    ]);
    const resp = await result.response;
    const textOut = String(resp.text() || "").trim();
    if (textOut) {
      urunTahmini = textOut;
    }
  }catch(e){
    console.error("Vision hata:", e);
  }
}
    
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
function isValidProductLink(link){
  if (!link || typeof link !== "string") return false;
  if (!link.startsWith("http")) return false;
  try{
    const u = new URL(link);
    const p = (u.pathname || "/").trim();
    if (p === "/" || p.length < 2) return false; // anasayfa
    // çok genel arama sayfası linkleri de düşük kalite
    if (/\/ara\b|\/search\b|\bquery=|\bq=/.test(link) && p.length < 10) return false;
    return true;
  }catch{
    return false;
  }
}

function filterRelevantProducts(products, query) {
  const q = String(query || "").toLowerCase().trim();
  const queryWords = q.split(/\s+/).filter(w => w.length > 2);

  return (products || []).filter(product => {
    const title = String(product?.urun || "").toLowerCase();
    const priceOk = Number.isFinite(product?.numericPrice) && product.numericPrice > 0;
    const linkOk = isValidProductLink(product?.link);

    let score = 0;

    // kelime eşleşmesi
    for (const word of queryWords){
      if (title.includes(word)) score += 10;
      if (title.startsWith(word)) score += 5;
    }

    // uzunluk bonusu (daha detay başlık)
    if (title.length > 20) score += 2;

    // fiyat ve link kalitesi
    if (!priceOk) score -= 50;
    if (!linkOk) score -= 40;

    // fiyat "siteye git" vs
    const fiyat = String(product?.fiyat || "");
    if (!fiyat || /fiyat yok|siteye git|incele/i.test(fiyat)) score -= 30;

    product.relevanceScore = score;
    return score > 0;
  }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

// ==================== SERVER BAŞLATMA ====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API v2.0 ${PORT} portunda`);
  console.log(`🌐 Endpoint: http://localhost:${PORT}/api/fiyat-cek`);
  console.log(`📱 PWA uygulaması için hazır!`);
});
