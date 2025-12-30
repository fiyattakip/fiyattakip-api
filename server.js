// server.js - TAM ÇALIŞAN VERSİYON (GÜNCELLENMİŞ)
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));

const PORT = process.env.PORT || 3000;

// ==================== BASİT LOGGING ====================
const log = {
  info: (msg) => console.log(`📝 ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`❌ ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`✅ ${new Date().toISOString()} - ${msg}`)
};

// ==================== SCRAPER FONKSİYONLARI ====================
async function scrapeTrendyol(query) {
  try {
    const url = `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}`;
    log.info(`Trendyol arama: ${query}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    // Birden fazla seçici deneyelim
    const selectors = [
      'div[data-testid="product-card"]',
      'div.p-card-wrppr',
      'div.search-product-card'
    ];
    
    let productElements = [];
    selectors.forEach(selector => {
      $(selector).slice(0, 10).each((i, el) => {
        productElements.push(el);
      });
    });
    
    productElements.slice(0, 10).forEach((el) => {
      try {
        const $el = $(el);
        
        // Başlık için farklı seçiciler
        const titleSelectors = [
          'span.prdct-desc-cntnr-name',
          'div.prdct-desc-cntnr-ttl',
          'div.product-name',
          'h3.product-name',
          '[class*="name"]'
        ];
        
        let title = "";
        for (const selector of titleSelectors) {
          const text = $el.find(selector).first().text().trim();
          if (text && text.length > 3) {
            title = text;
            break;
          }
        }
        
        // Fiyat için farklı seçiciler
        const priceSelectors = [
          'div.prc-box-dscntd',
          'div.prc-box-sllng',
          'div.discountedPrice',
          'div.product-price',
          '[class*="price"]'
        ];
        
        let price = "";
        for (const selector of priceSelectors) {
          const text = $el.find(selector).first().text().trim();
          if (text) {
            price = text;
            break;
          }
        }
        
        // Link bulma
        let link = $el.find('a').first().attr('href');
        if (link && !link.startsWith('http')) {
          link = 'https://www.trendyol.com' + link.split('?')[0];
        }
        
        // Resim
        const image = $el.find('img').first().attr('src') || 
                      $el.find('img').first().attr('data-src');
        
        if (title && link && price) {
          products.push({
            site: "Trendyol",
            urun: title.substring(0, 100),
            fiyat: price.replace(' TL', '').trim() + ' TL',
            link: link,
            image: image || "",
            marka: title.split(' ')[0] || ""
          });
        }
      } catch (err) {
        log.error(`Trendyol ürün parse: ${err.message}`);
      }
    });
    
    log.success(`Trendyol: ${products.length} ürün bulundu`);
    return products;
  } catch (err) {
    log.error(`Trendyol hatası: ${err.message}`);
    return [];
  }
}

async function scrapeHepsiburada(query) {
  try {
    const url = `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`;
    log.info(`Hepsiburada arama: ${query}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9"
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    // Hepsiburada seçicileri
    const selectors = [
      'li[data-testid="product-list-item"]',
      'li.search-item',
      'div[data-testid="product-card"]'
    ];
    
    let productElements = [];
    selectors.forEach(selector => {
      $(selector).slice(0, 10).each((i, el) => {
        productElements.push(el);
      });
    });
    
    productElements.slice(0, 10).forEach((el) => {
      try {
        const $el = $(el);
        
        const title = $el.find('h3[data-testid="product-card-name"]').text().trim() ||
                      $el.find('div.product-name').text().trim();
        
        const price = $el.find('div[data-testid="price-current-price"]').text().trim() ||
                      $el.find('span[data-testid="price"]').text().trim();
        
        let link = $el.find('a[data-testid="product-card-name"]').attr('href') ||
                   $el.find('a[href*="/urun/"]').attr('href');
        
        if (link && !link.startsWith('http')) {
          link = 'https://www.hepsiburada.com' + link.split('?')[0];
        }
        
        const image = $el.find('img').first().attr('src') || 
                      $el.find('img').first().attr('data-src');
        
        if (title && link && price) {
          products.push({
            site: "Hepsiburada",
            urun: title.substring(0, 100),
            fiyat: price.replace(' TL', '').trim() + ' TL',
            link: link,
            image: image || "",
            satıcı: $el.find('span[data-testid="seller"]').text().trim() || ""
          });
        }
      } catch (err) {
        log.error(`Hepsiburada ürün parse: ${err.message}`);
      }
    });
    
    log.success(`Hepsiburada: ${products.length} ürün bulundu`);
    return products;
  } catch (err) {
    log.error(`Hepsiburada hatası: ${err.message}`);
    return [];
  }
}

// ==================== API ENDPOINT'LER ====================
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "FiyatTakip API v5.0",
    status: "running",
    version: "5.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      fiyatCek: "/api/fiyat-cek",
      aiYorum: "/api/ai-yorum",
      kameraAi: "/api/kamera-ai"
    },
    note: "AI için Google Gemini API key gereklidir"
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 1. GELİŞMİŞ FIYAT ÇEKME
app.post("/api/fiyat-cek", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { urun, limit = 12 } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: "Geçerli bir ürün adı giriniz (en az 2 karakter)" 
      });
    }
    
    const query = urun.trim();
    log.info(`Fiyat araması: "${query}"`);
    
    const [trendyolResults, hepsiburadaResults] = await Promise.allSettled([
      scrapeTrendyol(query),
      scrapeHepsiburada(query)
    ]);
    
    let allProducts = [];
    
    if (trendyolResults.status === 'fulfilled') {
      allProducts.push(...trendyolResults.value);
    }
    
    if (hepsiburadaResults.status === 'fulfilled') {
      allProducts.push(...hepsiburadaResults.value);
    }
    
    // Benzersiz ürünleri filtrele
    const uniqueProducts = [];
    const seenLinks = new Set();
    
    allProducts.forEach(p => {
      if (p.link && p.urun && !seenLinks.has(p.link)) {
        seenLinks.add(p.link);
        uniqueProducts.push(p);
      }
    });
    
    // Fiyata göre sırala
    uniqueProducts.sort((a, b) => {
      const priceA = parseFloat(a.fiyat.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      const priceB = parseFloat(b.fiyat.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      return priceA - priceB;
    });
    
    const responseTime = Date.now() - startTime;
    const limitedProducts = uniqueProducts.slice(0, parseInt(limit));
    
    log.success(`${limitedProducts.length} ürün bulundu (${responseTime}ms)`);
    
    res.json({
      success: true,
      query: query,
      toplamUrun: limitedProducts.length,
      responseTime: `${responseTime}ms`,
      fiyatlar: limitedProducts,
      sites: ["Trendyol", "Hepsiburada"],
      enUcuz: limitedProducts[0] || null
    });
    
  } catch (error) {
    log.error(`Fiyat çekme hatası: ${error.message}`);
    
    res.status(500).json({ 
      success: false, 
      error: "Fiyat çekilirken bir hata oluştu",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 2. GELİŞTİRİLMİŞ AI YORUM SİSTEMİ
app.post("/api/ai-yorum", async (req, res) => {
  const startTime = Date.now();
  log.info("AI yorum isteği başladı");
  
  try {
    const { urun, fiyatlar = [], apiKey } = req.body;
    
    if (!urun || !apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün adı ve Google Gemini API Key gerekli" 
      });
    }
    
    log.info(`AI için ürün: "${urun}"`);
    
    // GELİŞMİŞ PROMPT
    let prompt = `"${urun}" ürünü hakkında alışveriş tavsiyesi ver. Aşağıdaki bilgileri dikkate al:\n\n`;
    
    if (fiyatlar && fiyatlar.length > 0) {
      prompt += `Mevcut fiyatlar:\n`;
      fiyatlar.slice(0, 5).forEach((f, i) => {
        prompt += `${i+1}. ${f.site}: ${f.fiyat}\n`;
      });
      prompt += `\n`;
    }
    
    prompt += `Tavsiyeni şu şekilde ver:\n`;
    prompt += `1. Ürün tipine göre dikkat edilmesi gereken 3-5 önemli nokta\n`;
    prompt += `2. Fiyat/performans değerlendirmesi\n`;
    prompt += `3. Genel alışveriş tavsiyeleri\n\n`;
    prompt += `Kurallar:\n`;
    prompt += `- Türkçe yanıt ver\n`;
    prompt += `- Maddeli liste formatında olsun\n`;
    prompt += `- Maksimum 200 kelime\n`;
    prompt += `- Net ve anlaşılır olsun\n`;
    
    // GEMINI MODELLERİ
    const models = [
      "gemini-1.5-flash",
      "gemini-1.0-pro", 
      "gemini-1.5-pro"
    ];
    
    let aiResponse = "";
    let modelUsed = "";
    
    for (const model of models) {
      try {
        log.info(`${model} modeli deneniyor...`);
        
        const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        }, {
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 15000
        });
        
        if (response.status === 200) {
          aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (aiResponse) {
            modelUsed = model;
            log.success(`${model} başarılı!`);
            break;
          }
        }
      } catch (modelError) {
        log.error(`${model} hatası: ${modelError.message}`);
        continue;
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    if (aiResponse) {
      log.success(`AI yanıtı alındı (${responseTime}ms)`);
      
      res.json({
        success: true,
        aiYorum: aiResponse,
        yorum: aiResponse,
        model: modelUsed,
        isRealAI: true,
        responseTime: `${responseTime}ms`,
        wordCount: aiResponse.split(/\s+/).length
      });
      
    } else {
      // AKILLI FALLBACK
      log.info("AI çalışmadı, fallback kullanılıyor");
      
      const fallback = generateSmartFallback(urun, fiyatlar);
      
      res.json({
        success: true,
        aiYorum: fallback,
        yorum: fallback,
        isFallback: true,
        note: "Bu bir otomatik tavsiyedir, AI kullanılamadı"
      });
    }
    
  } catch (error) {
    log.error(`AI genel hatası: ${error.message}`);
    
    res.json({
      success: true,
      aiYorum: `"${req.body.urun || 'Bu ürün'}" için detaylı AI analizi şu an yapılamıyor.`,
      yorum: `"${req.body.urun || 'Bu ürün'}" için detaylı AI analizi şu an yapılamıyor.`,
      isError: true,
      note: error.message
    });
  }
  
  log.info("AI isteği tamamlandı");
});

// Fallback fonksiyonu
function generateSmartFallback(productName, prices = []) {
  const lowerName = productName.toLowerCase();
  let advice = `"${productName}" ürünü için tavsiyeler:\n\n`;
  
  // Kategoriye özgü tavsiyeler
  if (lowerName.includes('telefon') || lowerName.includes('iphone')) {
    advice += `📱 Telefon Alırken Dikkat Edilmesi Gerekenler:\n`;
    advice += `• İşlemci ve RAM performansı\n`;
    advice += `• Kamera kalitesi (gece çekimi, video stabilizasyonu)\n`;
    advice += `• Batarya ömrü ve hızlı şarj desteği\n`;
    advice += `• Ekran kalitesi (AMOLED, IPS, yenileme hızı)\n`;
    advice += `• Yazılım güncelleme desteği\n\n`;
  } 
  else if (lowerName.includes('laptop') || lowerName.includes('notebook')) {
    advice += `💻 Laptop Alırken Dikkat Edilmesi Gerekenler:\n`;
    advice += `• İşlemci (Intel i5/i7 veya AMD Ryzen 5/7)\n`;
    advice += `• RAM (en az 8GB, tercihen 16GB)\n`;
    advice += `• Depolama (SSD tercih edin, HDD'den kaçının)\n`;
    advice += `• Ekran kalitesi (çözünürlük, renk doğruluğu)\n`;
    advice += `• Batarya ömrü ve taşınabilirlik\n\n`;
  }
  else if (lowerName.includes('tablet') || lowerName.includes('ipad')) {
    advice += `📱 Tablet Alırken Dikkat Edilmesi Gerekenler:\n`;
    advice += `• Ekran boyutu ve çözünürlüğü\n`;
    advice += `• İşlemci performansı ve multitasking\n`;
    advice += `• Kalem (stylus) desteği ihtiyacınız\n`;
    advice += `• Bağlantı seçenekleri (Wi-Fi, Cellular)\n`;
    advice += `• Aksesuar uyumluluğu (klavye, kılıf)\n\n`;
  }
  else {
    advice += `🛒 Genel Alışveriş Tavsiyeleri:\n`;
    advice += `• Ürün özelliklerini detaylı inceleyin\n`;
    advice += `• Kullanıcı yorumlarını ve puanlarını okuyun\n`;
    advice += `• Garanti ve iade koşullarını kontrol edin\n`;
    advice += `• Farklı satıcılardan fiyat karşılaştırması yapın\n\n`;
  }
  
  // Fiyat bilgisi
  if (prices.length > 0) {
    advice += `💰 Mevcut Fiyatlar:\n`;
    prices.slice(0, 3).forEach(p => {
      advice += `• ${p.site}: ${p.fiyat}\n`;
    });
    advice += `\n🔍 En uygun fiyat için Trendyol, Hepsiburada, Amazon, n11 karşılaştırın.`;
  } else {
    advice += `💡 Fiyat karşılaştırması yapmak için üstteki "Fiyat Çek" butonunu kullanın.`;
  }
  
  return advice;
}

// 3. KAMERA AI (BASİT VERSİYON)
app.post("/api/kamera-ai", async (req, res) => {
  try {
    const { image, apiKey } = req.body;
    
    // Eğer görsel ve API key varsa Gemini Vision dene
    if (image && apiKey && image.startsWith('data:image')) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await axios.post(url, {
          contents: [{
            parts: [
              { text: "Bu görseldeki ürün ne? Sadece ürün adını ve kısa açıklamasını ver. Türkçe." },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: image.replace(/^data:image\/\w+;base64,/, "")
                }
              }
            ]
          }]
        }, {
          timeout: 20000
        });
        
        const visionResult = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Tanımlanamadı";
        
        return res.json({
          success: true,
          urunTahmini: visionResult,
          tespitEdilen: visionResult,
          isVisionAI: true
        });
        
      } catch (visionError) {
        log.error(`Vision AI hatası: ${visionError.message}`);
      }
    }
    
    // Fallback: Rastgele ürün tahmini
    const products = [
      "iPhone 15 Pro - Apple akıllı telefon",
      "Samsung Galaxy S23 - Android akıllı telefon",
      "HP Pavilion Laptop - Windows dizüstü bilgisayar",
      "iPad Air - Apple tablet bilgisayar",
      "Sony WH-1000XM5 - Kablosuz kulaklık",
      "Nike Air Max - Spor ayakkabı",
      "Apple Watch Series 9 - Akıllı saat",
      "Samsung QLED TV - 4K televizyon"
    ];
    
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    res.json({
      success: true,
      urunTahmini: randomProduct,
      tespitEdilen: randomProduct,
      isFallback: true,
      note: image ? "Görsel analiz edilemedi" : "Görsel gerekli"
    });
    
  } catch (error) {
    log.error(`Kamera AI hatası: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: "Görsel analiz edilemedi" 
    });
  }
});

// ==================== HATA YÖNETİMİ ====================
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: "Endpoint bulunamadı",
    availableEndpoints: [
      "GET /",
      "GET /health",
      "POST /api/fiyat-cek",
      "POST /api/ai-yorum", 
      "POST /api/kamera-ai"
    ]
  });
});

app.use((err, req, res, next) => {
  log.error(`Sunucu hatası: ${err.message}`);
  res.status(500).json({
    success: false,
    error: "Sunucu hatası oluştu",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== SUNUCUYU BAŞLAT ====================
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 FiyatTakip API v5.0 ÇALIŞIYOR");
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log("🤖 AI: Google Gemini entegre");
  console.log("🛒 Siteler: Trendyol, Hepsiburada");
  console.log("=".repeat(50) + "\n");
});
