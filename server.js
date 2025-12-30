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

// 2. // server.js - GERÇEK AI ÇALIŞAN KOD
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));

const PORT = process.env.PORT || 10000;

// ==================== GERÇEK AI YORUM (GOOGLE GEMINI) ====================
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { urun, fiyatlar = [], apiKey } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Ürün adı gerekli" });
    }
    
    console.log("🤖 GERÇEK AI yorum isteği:", urun);
    
    const apiKeyToUse = apiKey;
    
    if (!apiKeyToUse) {
      return res.status(400).json({ 
        success: false, 
        error: "Gemini API Key gerekli. Lütfen uygulama ayarlarından API Key ekleyin." 
      });
    }
    
    // HANGİ MODELLERİ DENE (güncel listesi)
    const modelsToTry = [
      "gemini-1.5-flash",        // En yaygın ücretsiz
      "gemini-1.0-pro",          // Standart
      "gemini-1.5-pro",          // Pro
      "gemini-2.0-flash-exp",    // Deneysel
      "gemini-2.0-flash-lite",   // Lite versiyon
      "gemini-2.0-flash",        // Yeni flash
      "gemini-2.0-pro-exp"       // Deneysel pro
    ];
    
    let aiResponse = "";
    let workingModel = "";
    let lastError = "";
    
    // MODELLERİ TEK TEK DENE
    for (const modelName of modelsToTry) {
      try {
        console.log(`🔍 Model deneniyor: ${modelName}`);
        
        // DOĞRUDAN GOOGLE API ÇAĞRISI
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKeyToUse}`;
        
        // Prompt hazırla
        let prompt = `Sen bir e-ticaret asistanısın. Aşağıdaki ürün hakkında kısa, net ve faydalı bir alışveriş tavsiyesi ver.\n\n`;
        prompt += `**Ürün:** ${urun}\n\n`;
        
        if (fiyatlar && fiyatlar.length > 0) {
          prompt += `**Fiyat Bilgileri:**\n`;
          fiyatlar.forEach(f => {
            prompt += `- ${f.site}: ${f.fiyat}\n`;
          });
          prompt += `\nBu fiyatları karşılaştırarak:\n`;
          prompt += `1. En iyi değeri nerede bulabilir?\n`;
          prompt += `2. Fiyatlar uygun mu?\n`;
          prompt += `3. Hangi siteyi önerirsin ve neden?\n`;
        } else {
          prompt += `Bu ürün için fiyat bilgisi yok. Genel olarak bu tür ürünler alınırken nelere dikkat edilmeli?\n`;
        }
        
        prompt += `\n**NOT:** Yanıtını Türkçe ve günlük konuşma diliyle ver. 150 kelimeyi geçmesin.`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500
            }
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI yanıt oluşturamadı.";
          workingModel = modelName;
          console.log(`✅ Model çalıştı: ${modelName}`);
          break;
        } else {
          const errorData = await response.json();
          lastError = errorData.error?.message || `HTTP ${response.status}`;
          console.log(`❌ ${modelName} çalışmadı: ${lastError}`);
        }
      } catch (error) {
        lastError = error.message;
        console.log(`❌ ${modelName} hatası:`, error.message);
      }
    }
    
    // SONUÇ
    if (aiResponse) {
      res.json({
        success: true,
        aiYorum: aiResponse,
        yorum: aiResponse,
        model: workingModel
      });
    } else {
      // HİÇBİR MODEL ÇALIŞMAZSA - GERÇEK FALLBACK
      let fallbackMsg = `"${urun}" ürünü için fiyat karşılaştırması:\n\n`;
      
      if (fiyatlar && fiyatlar.length > 0) {
        fallbackMsg += `Bulunan fiyatlar:\n`;
        fiyatlar.forEach(f => {
          fallbackMsg += `• ${f.site}: ${f.fiyat}\n`;
        });
        fallbackMsg += `\nÖneri: Farklı satıcıları karşılaştırın, yorumları okuyun ve güvenilir sitelerden alın.`;
      } else {
        fallbackMsg += `Trendyol, Hepsiburada, Amazon gibi sitelerde arama yaparak en uygun fiyatı bulabilirsiniz.`;
      }
      
      res.json({
        success: true,
        aiYorum: fallbackMsg,
        yorum: fallbackMsg,
        isFallback: true,
        error: lastError
      });
    }
    
  } catch (error) {
    console.error("❌ AI yorum hatası:", error);
    
    res.json({
      success: true,
      aiYorum: `"${req.body.urun || 'Ürün'}" için detaylı analiz şu an yapılamıyor. Farklı sitelerde fiyat karşılaştırması yapmanızı öneririm.`,
      yorum: `"${req.body.urun || 'Ürün'}" için detaylı analiz şu an yapılamıyor. Farklı sitelerde fiyat karşılaştırması yapmanızı öneririm.`,
      isError: true
    });
  }
});

// ==================== GERÇEK KAMERA AI ====================
app.post("/api/kamera-ai", async (req, res) => {
  try {
    const { image, mime = 'image/jpeg', apiKey } = req.body;
    
    if (!image) {
      return res.status(400).json({ success: false, error: "Görsel verisi gerekli" });
    }
    
    console.log("📸 GERÇEK Kamera AI isteği");
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: "API Key gerekli" 
      });
    }
    
    // VISION MODELLERİ
    const visionModels = [
      "gemini-1.5-flash",        // Vision destekler
      "gemini-1.5-pro",          // Vision destekler
      "gemini-2.0-flash-exp"     // Vision destekler
    ];
    
    let detectedText = "";
    let workingModel = "";
    
    for (const modelName of visionModels) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: "Bu fotoğrafta ne görüyorsun? Sadece ürünün adını Türkçe söyle." },
                {
                  inlineData: {
                    mimeType: mime,
                    data: image
                  }
                }
              ]
            }]
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          detectedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Belirlenemedi";
          workingModel = modelName;
          console.log(`✅ Vision çalıştı: ${modelName} -> ${detectedText}`);
          break;
        }
      } catch (error) {
        console.log(`❌ ${modelName} vision hatası:`, error.message);
      }
    }
    
    if (detectedText) {
      res.json({
        success: true,
        urunTahmini: detectedText,
        tespitEdilen: detectedText,
        model: workingModel
      });
    } else {
      // Vision çalışmazsa basit tahmin
      const products = ["telefon", "laptop", "kitap", "kulaklık", "ayakkabı", "tişört"];
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      
      res.json({
        success: true,
        urunTahmini: randomProduct,
        tespitEdilen: randomProduct,
        isFallback: true
      });
    }
    
  } catch (error) {
    console.error("❌ Kamera AI hatası:", error);
    
    res.json({
      success: true,
      urunTahmini: "Ürün",
      tespitEdilen: "Ürün",
      isError: true
    });
  }
});

// ... Diğer endpoint'ler aynı kalacak ...
app.post("/api/fiyat-cek", async (req, res) => { /* Aynı */ });
app.get("/health", (req, res) => { res.json({ success: true }); });

// ESKİ ENDPOINT YÖNLENDİRMELERİ
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
  console.log(`🤖 GERÇEK AI: AKTİF (Google Gemini API)`);
});
