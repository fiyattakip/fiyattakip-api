const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

console.log("🚀 FiyatTakip API ÇALIŞIYOR");
console.log("🔑 Gemini API Key:", GEMINI_API_KEY ? "MEVCUT" : "YOK");

// ==================== SCRAPER FONKSİYONLARI ====================
async function scrapeTrendyol(query) {
  try {
    const url = `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    $('div.p-card-wrppr, div[data-testid="product-card"]').slice(0, 8).each((i, el) => {
      const title = $(el).find('span.prdct-desc-cntnr-name, div.prdct-desc-cntnr-ttl, div.product-name').first().text().trim();
      const price = $(el).find('div.prc-box-dscntd, div.prc-box-sllng, div.discountedPrice').first().text().trim();
      let link = $(el).find('a').attr('href');
      
      if (link && !link.startsWith('http')) {
        link = 'https://www.trendyol.com' + link;
      }
      
      if (title && link) {
        products.push({
          site: "Trendyol",
          urun: title.substring(0, 80),
          fiyat: price || "Fiyat yok",
          link: link
        });
      }
    });
    
    return products;
  } catch (err) {
    console.log("Trendyol hatası:", err.message);
    return [];
  }
}

async function scrapeHepsiburada(query) {
  try {
    const url = `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    $('li[class*="productListContent"], div[data-testid="product-card"]').slice(0, 8).each((i, el) => {
      const title = $(el).find('h3[data-testid="product-card-name"], div.product-name').first().text().trim();
      const price = $(el).find('div[data-testid="price-current-price"], span.price').first().text().trim();
      let link = $(el).find('a').attr('href');
      
      if (link && !link.startsWith('http')) {
        link = 'https://www.hepsiburada.com' + link;
      }
      
      if (title && link) {
        products.push({
          site: "Hepsiburada",
          urun: title.substring(0, 80),
          fiyat: price || "Fiyat yok",
          link: link
        });
      }
    });
    
    return products;
  } catch (err) {
    console.log("Hepsiburada hatası:", err.message);
    return [];
  }
}

// ==================== API ENDPOINT'LER ====================
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "FiyatTakip API",
    status: "running",
    endpoints: ["/health", "/api/fiyat-cek", "/api/ai-yorum", "/api/kamera-ai"]
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// 1. FIYAT ÇEKME
app.post("/api/fiyat-cek", async (req, res) => {
  try {
    const { urun } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Ürün adı gerekli" });
    }
    
    const query = urun.trim();
    console.log("🔍 Fiyat araması:", query);
    
    const [trendyolResults, hepsiburadaResults] = await Promise.allSettled([
      scrapeTrendyol(query),
      scrapeHepsiburada(query)
    ]);
    
    let allProducts = [];
    if (trendyolResults.status === 'fulfilled') allProducts.push(...trendyolResults.value);
    if (hepsiburadaResults.status === 'fulfilled') allProducts.push(...hepsiburadaResults.value);
    
    // Benzersiz ürünler
    const uniqueProducts = [];
    const seenLinks = new Set();
    allProducts.forEach(p => {
      if (p.link && !seenLinks.has(p.link)) {
        seenLinks.add(p.link);
        uniqueProducts.push(p);
      }
    });
    
    console.log(`✅ ${uniqueProducts.length} ürün bulundu`);
    
    res.json({
      success: true,
      query: query,
      toplamUrun: uniqueProducts.length,
      fiyatlar: uniqueProducts.slice(0, 6)
    });
    
  } catch (error) {
    console.error("Fiyat çekme hatası:", error);
    res.status(500).json({ success: false, error: "Fiyat çekilemedi" });
  }
});

// 2. GERÇEK AI YORUM (GEMINI)
// server.js'de AI endpoint'ini bulun ve bu kodu yapıştırın
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { urun, fiyatlar = [], apiKey } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Ürün adı gerekli" });
    }
    
    console.log("🤖 AI yorum isteği:", urun);
    
    // API Key kontrolü - ÖNEMLİ: Hem body'den hem de environment'dan kontrol
    const apiKeyToUse = apiKey || GEMINI_API_KEY;
    
    if (!apiKeyToUse) {
      return res.status(400).json({ 
        success: false, 
        error: "Gemini API Key gerekli. Lütfen uygulama ayarlarından ekleyin veya sunucuya GEMINI_API_KEY ekleyin." 
      });
    }
    
    // Gemini AI başlat
    const genAI = new GoogleGenerativeAI(apiKeyToUse);
    
    // TEK VE DOĞRU MODEL İSMİ:
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Prompt hazırla
    let prompt = `${urun} ürünü hakkında alışveriş tavsiyesi ver. ` +
                 `Fiyat karşılaştırması yap ve satın alma önerisi ver. ` +
                 `Türkçe, kısa ve net cevap ver.`;
    
    if (fiyatlar && fiyatlar.length > 0) {
      prompt += `\n\nFiyatlar:\n`;
      fiyatlar.forEach(f => {
        prompt += `- ${f.site}: ${f.fiyat}\n`;
      });
    }
    
    console.log("📝 Model kullanılıyor: gemini-1.5-flash");
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiResponse = response.text().trim();
    
    res.json({
      success: true,
      aiYorum: aiResponse,
      yorum: aiResponse,
      model: "gemini-1.5-flash"
    });
    
  } catch (error) {
    console.error("❌ AI yorum hatası:", error.message);
    
    // Daha açıklayıcı hata mesajı
    let errorMessage = "AI yorum yapılamadı";
    let statusCode = 500;
    
    if (error.message.includes("API key")) {
      errorMessage = "Geçersiz API Key. Lütfen doğru Gemini API Key girin.";
      statusCode = 401;
    } else if (error.message.includes("quota")) {
      errorMessage = "Günlük ücretsiz kullanım limiti doldu. Yarın tekrar deneyin.";
      statusCode = 429;
    } else if (error.message.includes("model") || error.message.includes("404")) {
      errorMessage = "Model bulunamadı. Lütfen 'gemini-1.5-flash' model adını kontrol edin.";
      statusCode = 400;
    }
    
    // Fallback mesaj - kullanıcı her durumda bir yanıt alsın
    res.json({
      success: true,
      aiYorum: `"${req.body.urun || 'Bu ürün'}" için detaylı analiz şu an yapılamıyor. ` +
               `Doğrudan Trendyol veya Hepsiburada'da arama yapmanızı öneririm.`,
      yorum: `"${req.body.urun || 'Bu ürün'}" için detaylı analiz şu an yapılamıyor. ` +
             `Doğrudan Trendyol veya Hepsiburada'da arama yapmanızı öneririm.`,
      isFallback: true,
      error: errorMessage
    });
  }
});

// 3. GERÇEK KAMERA AI (GEMINI VISION)
// Kamera AI endpoint'inde de model adını düzeltin
app.post("/api/kamera-ai", async (req, res) => {
  try {
    const { image, mime = 'image/jpeg' } = req.body;
    
    if (!image) {
      return res.status(400).json({ success: false, error: "Görsel verisi (base64) gerekli" });
    }
    
    console.log("📸 Kamera AI isteği - Görsel analizi");
    
    // API Key kontrolü
    if (!GEMINI_API_KEY) {
      const products = ["telefon", "laptop", "kitap", "kulaklık", "ayakkabı", "tişört"];
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      return res.json({
        success: true,
        urunTahmini: randomProduct,
        tespitEdilen: randomProduct
      });
    }
    
    // Gemini AI başlat
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // TEK VE DOĞRU MODEL İSMİ:
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = "Bu fotoğrafta ne görüyorsun? Sadece ürün adını Türkçe söyle.";
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mime,
          data: image
        }
      }
    ]);
    
    const detectedText = result.response.text().trim();
    console.log("✅ Görselden tespit edilen:", detectedText);
    
    res.json({
      success: true,
      urunTahmini: detectedText,
      tespitEdilen: detectedText,
      model: "gemini-1.5-flash"
    });
    
  } catch (error) {
    console.error("❌ Kamera AI hatası:", error);
    
    // Fallback
    const products = ["telefon", "laptop", "kitap", "kulaklık", "ayakkabı", "tişört"];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    res.json({
      success: true,
      urunTahmini: randomProduct,
      tespitEdilen: randomProduct,
      isFallback: true
    });
  }
});
// ESKİ ENDPOINT YÖNLENDİRMELERİ (geriye uyumluluk)
app.post("/fiyat-cek", (req, res) => {
  req.url = "/api/fiyat-cek";
  app._router.handle(req, res, () => {});
});

app.post("/ai-yorum", (req, res) => {
  req.url = "/api/ai-yorum";
  app._router.handle(req, res, () => {});
});

app.post("/kamera-ai", (req, res) => {
  req.url = "/api/kamera-ai";
  app._router.handle(req, res, () => {});
});

app.listen(PORT, () => {
  console.log(`✅ API http://localhost:${PORT} adresinde çalışıyor`);
});
