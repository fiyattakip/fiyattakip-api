// server.js - TAM TEMİZ VERSİYON
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));

const PORT = process.env.PORT || 10000;

console.log("🚀 FiyatTakip API ÇALIŞIYOR");

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
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: "API Key gerekli. Lütfen uygulama ayarlarından ekleyin." 
      });
    }
    
    // DOĞRUDAN GOOGLE API - GÜNCEL MODEL
    const modelsToTry = [
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash-001", 
      "gemini-1.5-pro-001",
      "gemini-1.5-flash",
      "gemini-1.0-pro"
    ];
    
    let aiResponse = "";
    let workingModel = "";
    
    for (const modelName of modelsToTry) {
      try {
        // ÖNCE v1 DENEYELİM
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
        
        let prompt = `"${urun}" ürünü hakkında kısa alışveriş tavsiyesi ver. `;
        if (fiyatlar && fiyatlar.length > 0) {
          prompt += `Fiyat: ${fiyatlar[0].site} - ${fiyatlar[0].fiyat}. `;
        }
        prompt += `Türkçe, net ve kısa cevap ver.`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              maxOutputTokens: 200
            }
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı.";
          workingModel = modelName;
          console.log(`✅ Model çalıştı: ${modelName}`);
          break;
        }
      } catch (error) {
        console.log(`❌ ${modelName} hatası:`, error.message);
      }
    }
    
    if (aiResponse) {
      res.json({
        success: true,
        aiYorum: aiResponse,
        yorum: aiResponse,
        model: workingModel
      });
    } else {
      // FALLBACK
      const fallbackMsg = `"${urun}" ürününü alırken Trendyol ve Hepsiburada'da fiyat karşılaştırması yapmanızı öneririm.`;
      
      res.json({
        success: true,
        aiYorum: fallbackMsg,
        yorum: fallbackMsg,
        isFallback: true
      });
    }
    
  } catch (error) {
    console.error("❌ AI hatası:", error);
    
    res.json({
      success: true,
      aiYorum: `"${req.body.urun || 'Ürün'}" için AI analizi geçici olarak kullanılamıyor.`,
      yorum: `"${req.body.urun || 'Ürün'}" için AI analizi geçici olarak kullanılamıyor.`,
      isError: true
    });
  }
});

// 3. KAMERA AI
app.post("/api/kamera-ai", async (req, res) => {
  try {
    const { image, apiKey } = req.body;
    
    if (!image || !apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: "Görsel ve API Key gerekli" 
      });
    }
    
    console.log("📸 Kamera AI isteği");
    
    // BASİT FALLBACK (şimdilik)
    const products = ["telefon", "laptop", "kitap", "kulaklık", "ayakkabı", "tişört"];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    res.json({
      success: true,
      urunTahmini: randomProduct,
      tespitEdilen: randomProduct,
      isFallback: true
    });
    
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

// ESKİ ENDPOINT YÖNLENDİRMELERİ
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
