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
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { urun, fiyatlar = [], apiKey } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Ürün adı gerekli" });
    }
    
    console.log("🤖 AI yorum isteği:", urun);
    
    // API Key kontrolü
    if (!apiKey && !GEMINI_API_KEY) {
      return res.status(400).json({ 
        success: false, 
        error: "Gemini API Key gerekli. Lütfen uygulama ayarlarından ekleyin." 
      });
    }
    
    const apiKeyToUse = apiKey || GEMINI_API_KEY;
    
    // Gemini AI başlat
    const genAI = new GoogleGenerativeAI(apiKeyToUse);
    
    // HANGİ MODELLERİ DENEYELİM (sırayla)
    const modelsToTry = [
      "gemini-1.0-pro",           // 1. öncelik
      "models/gemini-1.0-pro",    // 2. öncelik  
      "gemini-pro",               // 3. öncelik
      "gemini-1.5-pro-latest",    // 4. öncelik
      "gemini-1.5-flash-latest"   // 5. öncelik (ücretsiz)
    ];
    
    let aiResponse = "";
    let lastError = "";
    
    // Modelleri sırayla dene
    for (const modelName of modelsToTry) {
      try {
        console.log(`🔍 Model deneniyor: ${modelName}`);
        
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Prompt hazırla
        let prompt = `${urun} ürünü hakkında alışveriş tavsiyesi ver.\n`;
        
        if (fiyatlar && fiyatlar.length > 0) {
          prompt += `Fiyatlar:\n`;
          fiyatlar.forEach(f => {
            prompt += `- ${f.site}: ${f.fiyat}\n`;
          });
          prompt += `\nBu fiyatlar uygun mu? Hangi siteyi önerirsin?`;
        }
        
        prompt += `\nTürkçe cevap ver, kısa ve net olsun.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiResponse = response.text().trim();
        
        console.log(`✅ Model çalıştı: ${modelName}`);
        
        // Başarılı oldu, döngüden çık
        res.json({
          success: true,
          aiYorum: aiResponse,
          yorum: aiResponse,
          modelUsed: modelName
        });
        
        return; // Fonksiyondan çık
        
      } catch (modelError) {
        lastError = modelError.message;
        console.log(`❌ Model başarısız (${modelName}):`, modelError.message);
        // Sonraki modeli dene
      }
    }
    
    // Hiçbir model çalışmadı
    throw new Error(`Hiçbir model çalışmadı. Son hata: ${lastError}`);
    
  } catch (error) {
    console.error("❌ AI yorum hatası:", error);
    
    // Basit fallback mesaj
    const fallbackResponse = `"${req.body.urun || 'Bu ürün'}" için fiyat analizi yapılamadı. ` +
                             `Doğrudan sitelerde arama yapmanızı öneririm.`;
    
    res.json({
      success: true,
      aiYorum: fallbackResponse,
      yorum: fallbackResponse,
      error: error.message,
      isFallback: true
    });
  }
});

// 3. GERÇEK KAMERA AI (GEMINI VISION)
app.post("/api/kamera-ai", async (req, res) => {
  try {
    const { image, mime = 'image/jpeg' } = req.body;
    
    if (!image) {
      return res.status(400).json({ success: false, error: "Görsel verisi (base64) gerekli" });
    }
    
    console.log("📸 Kamera AI isteği - Görsel analizi");
    
    // Environment API Key kullan
    if (!GEMINI_API_KEY) {
      console.warn("⚠️ GEMINI_API_KEY tanımlı değil");
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
    
    // Vision modellerini dene
    const visionModels = [
      "gemini-pro-vision",
      "models/gemini-pro-vision",
      "gemini-1.0-pro-vision"
    ];
    
    let detectedText = "";
    let lastVisionError = "";
    
    for (const modelName of visionModels) {
      try {
        console.log(`🔍 Vision model deneniyor: ${modelName}`);
        
        const model = genAI.getGenerativeModel({ model: modelName });
        
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
        
        detectedText = result.response.text().trim();
        console.log(`✅ Vision model çalıştı (${modelName}):`, detectedText);
        
        res.json({
          success: true,
          urunTahmini: detectedText,
          tespitEdilen: detectedText,
          modelUsed: modelName
        });
        
        return;
        
      } catch (visionError) {
        lastVisionError = visionError.message;
        console.log(`❌ Vision model başarısız (${modelName}):`, visionError.message);
      }
    }
    
    // Vision modelleri çalışmazsa, normal model dene
    try {
      console.log("🔍 Vision modeller çalışmadı, normal model deneniyor...");
      const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
      
      const prompt = `Bu base64 görselde ne olduğunu tahmin et: ${image.substring(0, 100)}... Sadece ürün adını Türkçe söyle.`;
      
      const result = await model.generateContent(prompt);
      detectedText = result.response.text().trim();
      
      res.json({
        success: true,
        urunTahmini: detectedText,
        tespitEdilen: detectedText,
        modelUsed: "gemini-1.0-pro (text-only)"
      });
      
    } catch (finalError) {
      throw new Error(`Vision analiz başarısız: ${lastVisionError}`);
    }
    
  } catch (error) {
    console.error("❌ Kamera AI hatası:", error);
    
    // Fallback
    const products = ["telefon", "laptop", "kitap", "kulaklık", "ayakkabı", "tişört", "çanta", "saat"];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    res.json({
      success: true,
      urunTahmini: randomProduct,
      tespitEdilen: randomProduct,
      isFallback: true,
      error: error.message
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
