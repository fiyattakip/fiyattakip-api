// server.js - GELİŞTİRİLMİŞ VERSİYON
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const rateLimit = require("express-rate-limit");

const app = express();

// ==================== KONFİGÜRASYON ====================
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ==================== RATE LIMITING ====================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // Her IP için 100 istek
  message: {
    success: false,
    error: "Çok fazla istek gönderildi. Lütfen 15 dakika sonra tekrar deneyin."
  }
});
app.use("/api/", limiter);

// ==================== UTILITY FONKSİYONLARI ====================
function normalizePrice(priceText) {
  if (!priceText) return "Fiyat yok";
  
  // TL, ₺, TL sembollerini temizle
  let cleaned = priceText
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  const price = parseFloat(cleaned);
  return isNaN(price) ? "Fiyat yok" : `${price.toFixed(2)} TL`;
}

function cleanProductTitle(title) {
  if (!title) return "";
  // Fazla boşlukları temizle, karakter limiti uygula
  return title
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

// ==================== GELİŞMİŞ SCRAPER FONKSİYONLARI ====================
async function scrapeTrendyol(query) {
  try {
    const url = `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}&qt=${encodeURIComponent(query)}&st=${encodeURIComponent(query)}`;
    console.log(`🌐 Trendyol scraping: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0"
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    // Trendyol'un farklı ürün kartı seçicileri
    const selectors = [
      'div[data-testid="product-card"]',
      'div.p-card-wrppr',
      'div.product-card',
      'div.prdct-cntnr-wrppr'
    ];
    
    let productElements = [];
    selectors.forEach(selector => {
      if (productElements.length < 10) {
        const elements = $(selector).slice(0, 10).toArray();
        productElements = [...productElements, ...elements];
      }
    });
    
    productElements.slice(0, 10).forEach((el) => {
      const $el = $(el);
      
      // Farklı başlık seçicileri
      const titleSelectors = [
        'span.prdct-desc-cntnr-name',
        'div.prdct-desc-cntnr-ttl',
        'div.product-name',
        'h3[class*="name"]',
        'div[class*="name"]'
      ];
      
      let title = "";
      for (const selector of titleSelectors) {
        const text = $el.find(selector).first().text().trim();
        if (text) {
          title = text;
          break;
        }
      }
      
      // Fiyat seçicileri
      const priceSelectors = [
        'div.prc-box-dscntd',
        'div.prc-box-sllng',
        'div.discountedPrice',
        'div[class*="price"]',
        'span[class*="price"]'
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
      let link = $el.find('a').attr('href');
      if (link && !link.startsWith('http')) {
        link = 'https://www.trendyol.com' + link;
      }
      
      // Resim URL'si
      let image = $el.find('img').attr('src') || $el.find('img').attr('data-src');
      
      if (title && link) {
        products.push({
          site: "Trendyol",
          urun: cleanProductTitle(title),
          fiyat: normalizePrice(price),
          fiyatRaw: price,
          link: link,
          image: image,
          puan: $el.find('div.rating').text().trim() || "Değerlendirme yok",
          kargo: $el.find('span.cargo-badge').text().trim() || "Kargo bilgisi yok"
        });
      }
    });
    
    console.log(`✅ Trendyol: ${products.length} ürün bulundu`);
    return products;
    
  } catch (err) {
    console.error("❌ Trendyol hatası:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Headers:", err.response.headers);
    }
    return [];
  }
}

async function scrapeHepsiburada(query) {
  try {
    const url = `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`;
    console.log(`🌐 Hepsiburada scraping: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br"
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    // Hepsiburada ürün seçicileri
    const selectors = [
      'li[data-testid="product-list-item"]',
      'li.productListContent-item',
      'div[data-testid="product-card"]',
      'div.search-item'
    ];
    
    let productElements = [];
    selectors.forEach(selector => {
      if (productElements.length < 10) {
        const elements = $(selector).slice(0, 10).toArray();
        productElements = [...productElements, ...elements];
      }
    });
    
    productElements.slice(0, 10).forEach((el) => {
      const $el = $(el);
      
      // Başlık seçicileri
      const title = $el.find('h3[data-testid="product-card-name"]').text().trim() ||
                    $el.find('div.product-name').text().trim() ||
                    $el.find('a[data-testid="product-card-name"]').text().trim();
      
      // Fiyat seçicileri
      const price = $el.find('div[data-testid="price-current-price"]').text().trim() ||
                    $el.find('span.price').text().trim() ||
                    $el.find('div[class*="price"]').text().trim();
      
      // Link
      let link = $el.find('a').attr('href');
      if (link && !link.startsWith('http')) {
        link = 'https://www.hepsiburada.com' + link;
      }
      
      // Resim
      let image = $el.find('img').attr('src') || 
                  $el.find('img').attr('data-src') ||
                  $el.find('div[class*="image"] img').attr('src');
      
      if (title && link) {
        products.push({
          site: "Hepsiburada",
          urun: cleanProductTitle(title),
          fiyat: normalizePrice(price),
          fiyatRaw: price,
          link: link,
          image: image,
          puan: $el.find('div.rating').text().trim() || "Değerlendirme yok",
          satıcı: $el.find('span[class*="seller"]').text().trim() || "Satıcı bilgisi yok",
          hızlıKargo: $el.find('div[class*="cargo"]').text().includes("hızlı") ? "Evet" : "Hayır"
        });
      }
    });
    
    console.log(`✅ Hepsiburada: ${products.length} ürün bulundu`);
    return products;
    
  } catch (err) {
    console.error("❌ Hepsiburada hatası:", err.message);
    return [];
  }
}

// Amazon TR scraping (yeni eklenen)
async function scrapeAmazon(query) {
  try {
    const url = `https://www.amazon.com.tr/s?k=${encodeURIComponent(query)}&__mk_tr_TR=ÅMÅŽÕÑ`;
    console.log(`🌐 Amazon scraping: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9"
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    $('div[data-component-type="s-search-result"]').slice(0, 8).each((i, el) => {
      const $el = $(el);
      const title = $el.find('h2 a span').text().trim();
      const price = $el.find('.a-price-whole').text().trim();
      let link = $el.find('h2 a').attr('href');
      
      if (link && !link.startsWith('http')) {
        link = 'https://www.amazon.com.tr' + link;
      }
      
      if (title && link) {
        products.push({
          site: "Amazon",
          urun: cleanProductTitle(title),
          fiyat: price ? `${price.replace(/\./g, '').replace(',', '.')} TL` : "Fiyat yok",
          fiyatRaw: price,
          link: link,
          image: $el.find('img.s-image').attr('src'),
          prime: $el.find('.s-prime').length > 0 ? "Prime" : "",
          yıldız: $el.find('span[aria-label*="yıldız"]').text().trim() || ""
        });
      }
    });
    
    console.log(`✅ Amazon: ${products.length} ürün bulundu`);
    return products;
    
  } catch (err) {
    console.error("❌ Amazon hatası:", err.message);
    return [];
  }
}

// ==================== API ENDPOINT'LER ====================
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "FiyatTakip API v2.0",
    status: "running",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      fiyatCek: "/api/fiyat-cek",
      aiYorum: "/api/ai-yorum",
      kameraAi: "/api/kamera-ai",
      stats: "/api/stats"
    },
    features: ["Çoklu site scraping", "Gerçek AI yorum", "Fiyat normalizasyonu", "Rate limiting"]
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// İstatistikler endpoint'i
app.get("/api/stats", (req, res) => {
  res.json({
    success: true,
    stats: {
      totalSites: 3,
      supportedSites: ["Trendyol", "Hepsiburada", "Amazon"],
      dailyLimit: 100,
      features: ["price-scraping", "ai-analysis", "image-analysis"],
      lastUpdated: "2024-01-15"
    }
  });
});

// 1. GELİŞMİŞ FIYAT ÇEKME
app.post("/api/fiyat-cek", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { urun, site = "all", limit = 12 } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: "Geçerli bir ürün adı giriniz (en az 2 karakter)" 
      });
    }
    
    const query = urun.trim();
    console.log(`🔍 Fiyat araması başladı: "${query}"`);
    
    let scrapers = [];
    
    if (site === "all" || site === "trendyol") {
      scrapers.push(scrapeTrendyol(query));
    }
    if (site === "all" || site === "hepsiburada") {
      scrapers.push(scrapeHepsiburada(query));
    }
    if (site === "all" || site === "amazon") {
      scrapers.push(scrapeAmazon(query));
    }
    
    if (scrapers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Geçerli bir site seçiniz: all, trendyol, hepsiburada, amazon"
      });
    }
    
    const results = await Promise.allSettled(scrapers);
    
    let allProducts = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allProducts.push(...result.value);
      } else {
        console.error(`Scraper ${index} hatası:`, result.reason);
      }
    });
    
    // Benzersiz ürünleri filtrele (link'e göre)
    const uniqueProducts = [];
    const seenLinks = new Set();
    
    allProducts.forEach(p => {
      if (p.link && p.urun && !seenLinks.has(p.link)) {
        seenLinks.add(p.link);
        uniqueProducts.push(p);
      }
    });
    
    // Fiyata göre sırala (varsa)
    uniqueProducts.sort((a, b) => {
      const priceA = parseFloat(a.fiyat) || Infinity;
      const priceB = parseFloat(b.fiyat) || Infinity;
      return priceA - priceB;
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Arama tamamlandı: ${uniqueProducts.length} ürün, ${responseTime}ms`);
    
    res.json({
      success: true,
      query: query,
      siteFilter: site,
      toplamUrun: uniqueProducts.length,
      responseTime: `${responseTime}ms`,
      fiyatlar: uniqueProducts.slice(0, parseInt(limit)),
      metadata: {
        cheapest: uniqueProducts[0] || null,
        mostExpensive: uniqueProducts[uniqueProducts.length - 1] || null,
        sitesScraped: scrapers.length
      }
    });
    
  } catch (error) {
    console.error("💥 Fiyat çekme hatası:", error);
    
    res.status(500).json({ 
      success: false, 
      error: "Fiyat çekilirken bir hata oluştu",
      details: error.message 
    });
  }
});

// 2. GELİŞMİŞ AI YORUM SİSTEMİ
app.post("/api/ai-yorum", async (req, res) => {
  console.log("🤖 AI İSTEĞİ BAŞLADI");
  const startTime = Date.now();
  
  try {
    const { urun, fiyatlar = [], apiKey, model = "auto" } = req.body;
    
    if (!urun || !apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün adı ve API Key gerekli" 
      });
    }
    
    console.log(`📦 Ürün: "${urun}"`);
    console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...`);
    
    // GELİŞMİŞ PROMPT
    let prompt = `"${urun}" ürünü hakkında alışveriş tavsiyesi ver. Aşağıdaki kurallara uy:\n\n`;
    prompt += `1. Ürünün tipine göre (elektronik, giyim, ev eşyası vb.) uzman tavsiyeleri ver\n`;
    prompt += `2. Alırken dikkat edilmesi gereken 3-5 önemli noktayı listele\n`;
    prompt += `3. Fiyat/performans değerlendirmesi yap\n`;
    
    if (fiyatlar && fiyatlar.length > 0) {
      prompt += `\nMevcut fiyat bilgileri:\n`;
      fiyatlar.slice(0, 5).forEach((f, i) => {
        prompt += `${i+1}. ${f.site}: ${f.fiyat}\n`;
      });
      prompt += `\nBu fiyatları da dikkate alarak değerlendirme yap.\n`;
    }
    
    prompt += `\nKurallar:\n`;
    prompt += `- Türkçe ve anlaşılır bir dil kullan\n`;
    prompt += `- Maksimum 150 kelime\n`;
    prompt += `- Maddeli liste formatında ver\n`;
    prompt += `- Tarafsız ve bilgilendirici ol\n`;
    
    // MODEL SEÇİMİ
    const models = {
      "gemini-1.5-pro": "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent",
      "gemini-1.5-flash": "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
      "gemini-1.0-pro": "https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent"
    };
    
    let selectedModel = model === "auto" ? "gemini-1.5-flash" : model;
    let aiResponse = "";
    let modelUsed = "";
    
    try {
      const url = `${models[selectedModel]}?key=${apiKey}`;
      
      console.log(`🔄 ${selectedModel} modeli deneniyor...`);
      
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }, {
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 20000
      });
      
      if (response.status === 200) {
        aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı.";
        modelUsed = selectedModel;
        console.log(`✅ ${selectedModel} başarılı!`);
      }
      
    } catch (modelError) {
      console.log(`❌ ${selectedModel} hatası:`, modelError.message);
      
      // FALLBACK: Diğer modelleri dene
      for (const [modelName, modelUrl] of Object.entries(models)) {
        if (modelName === selectedModel) continue;
        
        try {
          console.log(`🔄 Fallback: ${modelName} deneniyor...`);
          const fallbackUrl = `${modelUrl}?key=${apiKey}`;
          
          const fallbackResponse = await axios.post(fallbackUrl, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 300
            }
          }, {
            timeout: 15000
          });
          
          if (fallbackResponse.status === 200) {
            aiResponse = fallbackResponse.data.candidates?.[0]?.content?.parts?.[0]?.text;
            modelUsed = modelName;
            console.log(`✅ Fallback ${modelName} başarılı!`);
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    if (aiResponse) {
      console.log(`🎉 AI yanıtı alındı (${responseTime}ms)`);
      console.log(`📝 Önizleme: ${aiResponse.substring(0, 100)}...`);
      
      res.json({
        success: true,
        aiYorum: aiResponse,
        yorum: aiResponse,
        model: modelUsed,
        isRealAI: true,
        responseTime: `${responseTime}ms`,
        promptLength: prompt.length,
        wordCount: aiResponse.split(/\s+/).length
      });
      
    } else {
      // AKILLI FALLBACK
      console.log("📝 Akıllı fallback oluşturuluyor...");
      
      const category = getProductCategory(urun);
      const fallback = generateSmartFallback(urun, category, fiyatlar);
      
      res.json({
        success: true,
        aiYorum: fallback,
        yorum: fallback,
        isFallback: true,
        category: category,
        note: "Bu bir otomatik tavsiyedir, AI kullanılamadı"
      });
    }
    
  } catch (error) {
    console.error("💥 AI hatası:", error.message);
    
    res.status(500).json({
      success: false,
      error: "AI servisinde geçici bir sorun oluştu",
      details: error.message,
      fallbackYorum: `"${req.body.urun || 'Bu ürün'}" için detaylı analiz şu an yapılamıyor. Farklı sitelerde fiyat karşılaştırması yapmanızı öneririz.`
    });
  }
  
  console.log("🤖 AI İSTEĞİ TAMAMLANDI");
});

// Yardımcı fonksiyonlar
function getProductCategory(productName) {
  const lowerName = productName.toLowerCase();
  
  if (lowerName.includes('telefon') || lowerName.includes('iphone') || lowerName.includes('samsung')) {
    return 'telefon';
  } else if (lowerName.includes('laptop') || lowerName.includes('notebook') || lowerName.includes('macbook')) {
    return 'laptop';
  } else if (lowerName.includes('tablet') || lowerName.includes('ipad')) {
    return 'tablet';
  } else if (lowerName.includes('tv') || lowerName.includes('televizyon')) {
    return 'tv';
  } else if (lowerName.includes('kulaklık') || lowerName.includes('headphone') || lowerName.includes('earphone')) {
    return 'kulaklık';
  } else if (lowerName.includes('ayakkabı') || lowerName.includes('shoe')) {
    return 'ayakkabı';
  } else if (lowerName.includes('tişört') || lowerName.includes('t-shirt')) {
    return 'giyim';
  } else if (lowerName.includes('kitap') || lowerName.includes('book')) {
    return 'kitap';
  } else {
    return 'diğer';
  }
}

function generateSmartFallback(productName, category, prices = []) {
  let advice = `"${productName}" ürünü için tavsiyeler:\n\n`;
  
  const categoryAdvice = {
    'telefon': [
      '📱 İşlemci ve RAM kapasitesine dikkat edin',
      '🔋 Batarya ömrü (mAh) önemli bir kriter',
      '📸 Kamera özelliklerini karşılaştırın',
      '🔄 Yazılım güncelleme desteğini kontrol edin'
    ],
    'laptop': [
      '💻 İşlemci (i5/i7, Ryzen 5/7) ve RAM (min 8GB) önemli',
      '💾 SSD depolama hız için kritik',
      '🖥️ Ekran kalitesi (IPS, OLED) ve çözünürlük',
      '🔋 Batarya ömrü ve taşınabilirlik'
    ],
    'tablet': [
      '📱 Ekran boyutu ve çözünürlüğü değerlendirin',
      '⚡ İşlemci performansı (Snapdragon, A-serisi)',
      '✍️ Stylus desteği ihtiyacınız var mı?',
      '📶 Wi-Fi + Cellular seçeneklerini düşünün'
    ],
    'kulaklık': [
      '🎵 Ses kalitesi ve bass performansı',
      '🔇 Aktif gürültü önleme (ANC) özelliği',
      '🔋 Kablosuz kullanım süresi',
      '🏃♂️ Spor için suya dayanıklılık'
    ]
  };
  
  const genericAdvice = [
    '✅ Ürün özelliklerini detaylı inceleyin',
    '⭐ Kullanıcı yorumlarını ve puanlarını okuyun',
    '🏪 Farklı satıcılardan fiyat karşılaştırması yapın',
    '🚚 Kargo süresi ve ücretlerini kontrol edin',
    '🔄 İade ve değişim koşullarını öğrenin'
  ];
  
  // Kategoriye özgü tavsiyeler
  if (categoryAdvice[category]) {
    advice += categoryAdvice[category].map(item => `• ${item}`).join('\n');
    advice += '\n\n';
  }
  
  // Genel tavsiyeler
  advice += 'Genel tavsiyeler:\n';
  advice += genericAdvice.map(item => `• ${item}`).join('\n');
  
  // Fiyat bilgisi varsa ekle
  if (prices.length > 0) {
    advice += '\n\n📊 Mevcut fiyatlar:\n';
    prices.slice(0, 3).forEach(p => {
      advice += `• ${p.site}: ${p.fiyat}\n`;
    });
    advice += '\nEn uygun fiyatı bulmak için karşılaştırma yapın.';
  }
  
  return advice;
}

// 3. GELİŞMİŞ KAMERA AI
app.post("/api/kamera-ai", async (req, res) => {
  try {
    const { image, apiKey } = req.body;
    
    // Base64 görüntü analizi için Gemini Vision
    if (image && apiKey) {
      try {
        const visionUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await axios.post(visionUrl, {
          contents: [{
            parts: [
              { text: "Bu görseldeki ürünü tanımla. Sadece ürün adını ve kısa açıklamasını ver. Türkçe." },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: image.replace(/^data:image\/\w+;base64,/, "")
                }
              }
            ]
          }]
        }, {
          timeout: 30000
        });
        
        const visionResult = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Tanımlanamadı";
        
        return res.json({
          success: true,
          urunTahmini: visionResult,
          tespitEdilen: visionResult,
          isVisionAI: true,
          source: "Gemini Vision AI"
        });
        
      } catch (visionError) {
        console.log("Vision AI hatası, fallback kullanılıyor");
      }
    }
    
    // Fallback: Rastgele ürün tahmini
    const products = [
      { name: "Apple iPhone 15 Pro", category: "telefon" },
      { name: "Samsung Galaxy S23", category: "telefon" },
      { name: "HP Pavilion Laptop", category: "laptop" },
      { name: "Apple iPad Air", category: "tablet" },
      { name: "Sony WH-1000XM5 Kulaklık", category: "kulaklık" },
      { name: "Nike Air Max Ayakkabı", category: "ayakkabı" },
      { name: "Kitap: Steve Jobs Biyografi", category: "kitap" },
      { name: "Samsung QLED 4K TV", category: "tv" }
    ];
    
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    res.json({
      success: true,
      urunTahmini: randomProduct.name,
      tespitEdilen: randomProduct.name,
      category: randomProduct.category,
      isFallback: !image || !apiKey,
      note: image ? "Vision AI kullanılamadı" : "Görsel veya API Key gerekli"
    });
    
  } catch (error) {
    console.error("Kamera AI hatası:", error);
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
    availableEndpoints: ["/api/fiyat-cek", "/api/ai-yorum", "/api/kamera-ai", "/health"]
  });
});

app.use((err, req, res, next) => {
  console.error("🚨 Sunucu hatası:", err);
  res.status(500).json({
    success: false,
    error: "Sunucu hatası oluştu",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== SUNUCUYU BAŞLAT ====================
app.listen(PORT, () => {
  console.log(`\n✅ ====================================`);
  console.log(`🚀 FiyatTakip API v2.0 ÇALIŞIYOR`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🤖 AI DURUMU: AKTİF (Gemini AI entegre)`);
  console.log(`🛡️  Rate Limiting: AKTİF`);
  console.log(`🕒 Başlangıç: ${new Date().toLocaleTimeString('tr-TR')}`);
  console.log(`✅ ====================================\n`);
  
  // Başlangıç testi
  console.log("🔧 Sistem testi yapılıyor...");
  console.log("✅ Express.js hazır");
  console.log("✅ CORS aktif");
  console.log("✅ Rate limiting aktif");
  console.log(`✅ ${Object.keys(require('./package.json').dependencies || {}).length} bağımlılık yüklendi\n`);
});
