// server.js - TAM ÇALIŞAN VERSİYON
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

console.log("🚀 FiyatTakip API başlatılıyor...");

// ==================== SİTE SCRAPING FONKSİYONLARI ====================
async function scrapeSite(url) {
  try {
    console.log(`🌐 Scraping: ${url}`);
    
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Referer": "https://www.google.com/"
    };

    const response = await axios.get(url, { 
      timeout: 10000, 
      headers: headers,
      validateStatus: function (status) {
        return status < 500; // 500'den küçük tüm status kodlarını kabul et
      }
    });

    const $ = cheerio.load(response.data);
    const products = [];
    const site = getSiteName(url);

    // ==================== TRENDYOL ====================
    if (url.includes('trendyol.com')) {
      $('div[data-testid="product-card"], div.p-card-wrppr').slice(0, 8).each((i, el) => {
        const title = $(el).find('span.prdct-desc-cntnr-name, div.prdct-desc-cntnr-ttl').first().text().trim();
        const price = $(el).find('div.prc-box-dscntd, div.prc-box-sllng').first().text().trim();
        let link = $(el).find('a').first().attr('href');
        
        if (link && !link.startsWith('http')) {
          link = 'https://www.trendyol.com' + link.split('?')[0];
        }
        
        if (title && link && price) {
          products.push({
            site: "Trendyol",
            urun: title.substring(0, 100),
            fiyat: cleanPrice(price),
            link: link,
            image: $(el).find('img').first().attr('src') || ""
          });
        }
      });
    }
    
    // ==================== HEPSIBURADA ====================
    else if (url.includes('hepsiburada.com')) {
      $('li[data-testid="product-list-item"], li.search-item').slice(0, 8).each((i, el) => {
        const title = $(el).find('h3[data-testid="product-card-name"]').first().text().trim();
        const price = $(el).find('div[data-testid="price-current-price"]').first().text().trim();
        let link = $(el).find('a[data-testid="product-card-name"]').first().attr('href');
        
        if (link && !link.startsWith('http')) {
          link = 'https://www.hepsiburada.com' + link.split('?')[0];
        }
        
        if (title && link && price) {
          products.push({
            site: "Hepsiburada",
            urun: title.substring(0, 100),
            fiyat: cleanPrice(price),
            link: link,
            image: $(el).find('img').first().attr('src') || ""
          });
        }
      });
    }
    
    // ==================== N11 ====================
    else if (url.includes('n11.com')) {
      $('li.column, .list-ul li').slice(0, 8).each((i, el) => {
        const title = $(el).find('h3.productName, .productName').first().text().trim();
        const price = $(el).find('ins, .newPrice').first().text().trim();
        let link = $(el).find('a').first().attr('href');
        
        if (title && link && price) {
          products.push({
            site: "n11",
            urun: title.substring(0, 100),
            fiyat: cleanPrice(price),
            link: link,
            image: $(el).find('img').first().attr('data-src') || $(el).find('img').first().attr('src') || ""
          });
        }
      });
    }
    
    // ==================== AMAZON ====================
    else if (url.includes('amazon.com.tr')) {
      $('div[data-component-type="s-search-result"]').slice(0, 8).each((i, el) => {
        const title = $(el).find('h2 a span').first().text().trim();
        const price = $(el).find('.a-price-whole').first().text().trim();
        let link = $(el).find('h2 a').first().attr('href');
        
        if (link && !link.startsWith('http')) {
          link = 'https://www.amazon.com.tr' + link.split('?')[0];
        }
        
        if (title && link && price) {
          products.push({
            site: "Amazon",
            urun: title.substring(0, 100),
            fiyat: cleanPrice(price) + ' TL',
            link: link,
            image: $(el).find('img.s-image').first().attr('src') || ""
          });
        }
      });
    }
    
    // ==================== PAZARAMA ====================
    else if (url.includes('pazarama.com')) {
      $('.product-card, .product-item').slice(0, 8).each((i, el) => {
        const title = $(el).find('.product-title, .name').first().text().trim();
        const price = $(el).find('.product-price, .price').first().text().trim();
        let link = $(el).find('a').first().attr('href');
        
        if (link && !link.startsWith('http')) {
          link = 'https://www.pazarama.com' + link.split('?')[0];
        }
        
        if (title && link && price) {
          products.push({
            site: "Pazarama",
            urun: title.substring(0, 100),
            fiyat: cleanPrice(price),
            link: link,
            image: $(el).find('img').first().attr('src') || ""
          });
        }
      });
    }
    
    // ==================== ÇİÇEKSEPETİ ====================
    else if (url.includes('ciceksepeti.com')) {
      $('.products__item, .product-item').slice(0, 8).each((i, el) => {
        const title = $(el).find('.product__title, .product-title').first().text().trim();
        const price = $(el).find('.product__price, .product-price').first().text().trim();
        let link = $(el).find('a').first().attr('href');
        
        if (link && !link.startsWith('http')) {
          link = 'https://www.ciceksepeti.com' + link.split('?')[0];
        }
        
        if (title && link && price) {
          products.push({
            site: "ÇiçekSepeti",
            urun: title.substring(0, 100),
            fiyat: cleanPrice(price),
            link: link,
            image: $(el).find('img').first().attr('src') || ""
          });
        }
      });
    }
    
    // ==================== İDEFİX ====================
    else if (url.includes('idefix.com')) {
      $('.product-item, .item').slice(0, 8).each((i, el) => {
        const title = $(el).find('.product-title, .title').first().text().trim();
        const price = $(el).find('.current-price, .price').first().text().trim();
        let link = $(el).find('a').first().attr('href');
        
        if (link && !link.startsWith('http')) {
          link = 'https://www.idefix.com' + link.split('?')[0];
        }
        
        if (title && link && price) {
          products.push({
            site: "İdefix",
            urun: title.substring(0, 100),
            fiyat: cleanPrice(price),
            link: link,
            image: $(el).find('img').first().attr('src') || ""
          });
        }
      });
    }

    console.log(`✅ ${site}: ${products.length} ürün bulundu`);
    return products;

  } catch (error) {
    console.log(`❌ Scraping hatası (${url}):`, error.message);
    return [];
  }
}

// ==================== YARDIMCI FONKSİYONLAR ====================
function getSiteName(url) {
  if (url.includes('trendyol.com')) return 'Trendyol';
  if (url.includes('hepsiburada.com')) return 'Hepsiburada';
  if (url.includes('n11.com')) return 'n11';
  if (url.includes('amazon.com.tr')) return 'Amazon';
  if (url.includes('pazarama.com')) return 'Pazarama';
  if (url.includes('ciceksepeti.com')) return 'ÇiçekSepeti';
  if (url.includes('idefix.com')) return 'İdefix';
  return 'Diğer';
}

function cleanPrice(price) {
  if (!price) return "Fiyat yok";
  // Rakamları ve virgül/nokta temizle
  const clean = price.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? "Fiyat yok" : num.toFixed(2).replace('.', ',') + ' TL';
}

function getSearchUrls(query) {
  const encodedQuery = encodeURIComponent(query);
  return [
    `https://www.trendyol.com/sr?q=${encodedQuery}`,
    `https://www.hepsiburada.com/ara?q=${encodedQuery}`,
    `https://www.n11.com/arama?q=${encodedQuery}`,
    `https://www.amazon.com.tr/s?k=${encodedQuery}`,
    `https://www.pazarama.com/arama?q=${encodedQuery}`,
    `https://www.ciceksepeti.com/arama?query=${encodedQuery}`,
    `https://www.idefix.com/arama/?q=${encodedQuery}`
  ];
}

// ==================== AI YORUM FONKSİYONU ====================
async function getAIComment(urunAdi, urunLink, fiyatlar = [], apiKey) {
  console.log(`🤖 AI analizi: ${urunAdi}`);
  
  try {
    if (!apiKey) {
      throw new Error("API Key gerekli");
    }

    // Siteye göre ürün analizi
    let siteAnaliz = "";
    if (urunLink.includes('trendyol.com')) {
      siteAnaliz = "Trendyol'dan alışveriş yapıyorsunuz. Trendyol genellikle hızlı kargo ve geniş ürün yelpazesi sunar.";
    } else if (urunLink.includes('hepsiburada.com')) {
      siteAnaliz = "Hepsiburada'dan alışveriş yapıyorsunuz. HepsiExpress ile hızlı teslimat avantajı vardır.";
    } else if (urunLink.includes('amazon.com.tr')) {
      siteAnaliz = "Amazon'dan alışveriş yapıyorsunuz. Prime üyeliği ile hızlı ve ücretsiz kargo avantajı bulunur.";
    }

    // Ürün tipine göre analiz
    let urunAnaliz = "";
    const lowerAdi = urunAdi.toLowerCase();
    
    if (lowerAdi.includes('ram') || lowerAdi.includes('bellek')) {
      urunAnaliz = "RAM soğutucu, bilgisayar bileşenlerinin ömrünü uzatmak için önemli bir aksesuardır.";
    } else if (lowerAdi.includes('telefon') || lowerAdi.includes('iphone')) {
      urunAnaliz = "Telefon alırken depolama kapasitesi, kamera kalitesi ve batarya ömrüne dikkat edin.";
    } else if (lowerAdi.includes('laptop') || lowerAdi.includes('bilgisayar')) {
      urunAnaliz = "Laptop alırken işlemci, RAM ve ekran kalitesi önemli faktörlerdir.";
    }

    // Gemini API çağrısı
    const prompt = `
      "${urunAdi}" ürünü hakkında 3-5 cümlelik kısa bir alışveriş tavsiyesi ver.
      
      Bilgiler:
      - Ürün Linki: ${urunLink}
      - Site: ${getSiteName(urunLink)}
      ${siteAnaliz ? `- Site Özelliği: ${siteAnaliz}` : ''}
      ${urunAnaliz ? `- Ürün Tipi: ${urunAnaliz}` : ''}
      ${fiyatlar.length > 0 ? `- Karşılaştırmalı Fiyatlar: ${fiyatlar.map(f => `${f.site}: ${f.fiyat}`).join(', ')}` : ''}
      
      Kurallar:
      1. Sadece 3-5 cümle olsun
      2. Türkçe ve anlaşılır olsun
      3. Ürün tipine uygun tavsiyeler ver
      4. Site güvenilirliğinden bahset
      5. Fiyat karşılaştırması yap
    `;

    // Gemini API'yi dene
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200
      }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text;
    }

  } catch (error) {
    console.log(`❌ AI hatası: ${error.message}`);
  }

  // Fallback yanıt
  return `
  "${urunAdi}" ürünü için:
  
  1. ${getSiteName(urunLink)} sitesinden alışveriş yapıyorsunuz - güvenilir bir platform.
  2. Ürünü almadan önce kullanıcı yorumlarını mutlaka okuyun.
  3. Benzer ürünleri diğer sitelerde de karşılaştırmanızı öneririm.
  4. İade ve garanti koşullarını kontrol edin.
  5. Kampanya ve indirimleri takip edin.
  `.trim();
}

// ==================== API ENDPOINT'LERİ ====================
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "FiyatTakip API",
    version: "2.0",
    endpoints: {
      fiyatCek: "POST /api/fiyat-cek",
      aiYorum: "POST /api/ai-yorum",
      health: "GET /health"
    },
    supportedSites: ["Trendyol", "Hepsiburada", "n11", "Amazon", "Pazarama", "ÇiçekSepeti", "İdefix"]
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    status: "healthy",
    timestamp: new Date().toISOString() 
  });
});

// 1. FIYAT ÇEKME ENDPOINT
app.post("/api/fiyat-cek", async (req, res) => {
  try {
    const { urun } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün adı gerekli (en az 2 karakter)" 
      });
    }
    
    const query = urun.trim();
    console.log(`🔍 Fiyat araması: "${query}"`);
    
    // Tüm siteleri paralel olarak scrape et
    const searchUrls = getSearchUrls(query);
    const scrapePromises = searchUrls.map(url => scrapeSite(url));
    
    const results = await Promise.allSettled(scrapePromises);
    
    // Tüm ürünleri topla
    let allProducts = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allProducts.push(...result.value);
      }
    });
    
    // Benzersiz ürünleri filtrele
    const uniqueProducts = [];
    const seenLinks = new Set();
    
    allProducts.forEach(p => {
      if (p.link && !seenLinks.has(p.link)) {
        seenLinks.add(p.link);
        uniqueProducts.push(p);
      }
    });
    
    // Fiyata göre sırala (en ucuza)
    uniqueProducts.sort((a, b) => {
      const priceA = parseFloat(a.fiyat.replace(/[^\d.,]/g, '').replace(',', '.')) || Infinity;
      const priceB = parseFloat(b.fiyat.replace(/[^\d.,]/g, '').replace(',', '.')) || Infinity;
      return priceA - priceB;
    });
    
    console.log(`✅ Toplam ${uniqueProducts.length} ürün bulundu`);
    
    res.json({
      success: true,
      query: query,
      toplamUrun: uniqueProducts.length,
      fiyatlar: uniqueProducts.slice(0, 15),
      searchUrls: searchUrls
    });
    
  } catch (error) {
    console.error("💥 Fiyat çekme hatası:", error);
    res.status(500).json({ 
      success: false, 
      error: "Fiyat çekilemedi",
      message: error.message 
    });
  }
});

// 2. AI YORUM ENDPOINT
app.post("/api/ai-yorum", async (req, res) => {
  console.log("🤖 AI isteği geldi");
  
  try {
    const { urunAdi, urunLink, fiyatlar = [], apiKey } = req.body;
    
    if (!urunAdi || !urunLink) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün adı ve linki gerekli" 
      });
    }
    
    console.log(`📦 AI için: ${urunAdi}`);
    console.log(`🔗 Link: ${urunLink}`);
    
    // AI yorumunu al
    const aiYorum = await getAIComment(urunAdi, urunLink, fiyatlar, apiKey);
    
    console.log("✅ AI yanıtı oluşturuldu");
    
    res.json({
      success: true,
      aiYorum: aiYorum,
      yorum: aiYorum,
      urun: urunAdi,
      link: urunLink,
      site: getSiteName(urunLink)
    });
    
  } catch (error) {
    console.error("💥 AI hatası:", error);
    
    res.json({
      success: true,
      aiYorum: `"${req.body.urunAdi || 'Bu ürün'}" için AI analizi yapılamadı.`,
      yorum: `"${req.body.urunAdi || 'Bu ürün'}" için AI analizi yapılamadı.`,
      isFallback: true
    });
  }
});

// ==================== SUNUCU BAŞLATMA ====================
app.listen(PORT, () => {
  console.log(`
  ===========================================
  🚀 FiyatTakip API ÇALIŞIYOR
  📡 Port: ${PORT}
  🌐 URL: https://fiyattakip-api.onrender.com
  🛒 Desteklenen Siteler: 7 site
  🤖 AI Özelliği: AKTİF
  ===========================================
  `);
});
