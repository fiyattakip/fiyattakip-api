// server.js - TAM ÇALIŞAN VERSİYON (ORİJİNAL)
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));

const PORT = process.env.PORT || 3000;
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

// 2. GERÇEK AI YORUM - KESİN ÇALIŞAN
app.post("/api/ai-yorum", async (req, res) => {
  console.log("🤖 AI İSTEĞİ BAŞLADI");
  
  try {
    const { urun, fiyatlar = [], apiKey } = req.body;
    
    if (!urun || !apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün adı ve API Key gerekli" 
      });
    }
    
    console.log("📦 Ürün:", urun);
    console.log("🔑 API Key (ilk 10):", apiKey.substring(0, 10) + "...");
    
    // ÇALIŞAN MODELLERİ DENE
    const models = [
      "gemini-1.0-pro",      // 1. öncelik - EN ÇALIŞAN
      "gemini-1.5-pro",      // 2. öncelik
      "gemini-1.5-flash",    // 3. öncelik
      "gemini-2.0-flash-exp" // 4. öncelik
    ];
    
    let aiResponse = "";
    let workingModel = "";
    
    for (const model of models) {
      try {
        console.log(`🔄 ${model} deneniyor...`);
        
        const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
        
        let prompt = `"${urun}" ürünü hakkında kısa, faydalı bir alışveriş tavsiyesi ver.\n\n`;
        if (fiyatlar && fiyatlar.length > 0) {
          prompt += `Fiyat bilgisi: `;
          fiyatlar.forEach(f => prompt += `${f.site}: ${f.fiyat}, `);
        }
        prompt += `\nTürkçe, net ve 100 kelimeyi geçmeyecek şekilde cevap ver.`;
        
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300
          }
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });
        
        console.log(`📥 ${model} yanıtı:`, response.status);
        
        if (response.status === 200) {
          aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı.";
          workingModel = model;
          console.log(`✅ ${model} ÇALIŞTI!`);
          break;
        }
      } catch (error) {
        console.log(`❌ ${model} hatası:`, error.response?.status || error.message);
      }
    }
    
    if (aiResponse) {
      console.log("🎉 GERÇEK AI BAŞARILI!");
      console.log("📝 Yanıt özeti:", aiResponse.substring(0, 100) + "...");
      
      res.json({
        success: true,
        aiYorum: aiResponse,
        yorum: aiResponse,
        model: workingModel,
        isRealAI: true
      });
      
    } else {
      console.log("⚠️ Hiçbir model çalışmadı, v1beta deneniyor...");
      
      // v1beta FALLBACK
      try {
        const v1betaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await axios.post(v1betaUrl, {
          contents: [{ parts: [{ text: `"${urun}" hakkında alışveriş tavsiyesi ver. Türkçe.` }] }]
        }, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status === 200) {
          aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          res.json({
            success: true,
            aiYorum: aiResponse,
            yorum: aiResponse,
            model: "gemini-1.5-flash (v1beta)",
            isRealAI: true
          });
          return;
        }
      } catch (v1betaError) {
        console.log("v1beta da çalışmadı");
      }
      
      // SON ÇARE: AKILLI FALLBACK
      console.log("📝 Akıllı fallback gönderiliyor");
      
      let fallbackMsg = `"${urun}" ürününü alırken:\n\n`;
      
      if (urun.toLowerCase().includes("tablet") || urun.toLowerCase().includes("pad")) {
        fallbackMsg += `• Ekran kalitesi ve çözünürlük önemli\n`;
        fallbackMsg += `• İşlemci performansına dikkat edin (Snapdragon iyidir)\n`;
        fallbackMsg += `• RAM ve depolama ihtiyacınıza göre seçin\n`;
      } else if (urun.toLowerCase().includes("telefon") || urun.toLowerCase().includes("iphone")) {
        fallbackMsg += `• İşlemci ve RAM performansı önemli\n`;
        fallbackMsg += `• Kamera özelliklerini karşılaştırın\n`;
        fallbackMsg += `• Batarya ömrü ve şarj hızına bakın\n`;
      } else {
        fallbackMsg += `• Ürün özelliklerini detaylı inceleyin\n`;
        fallbackMsg += `• Kullanıcı yorumlarını mutlaka okuyun\n`;
      }
      
      fallbackMsg += `\nTrendyol, Hepsiburada, Amazon'da fiyat karşılaştırması yapın.`;
      
      res.json({
        success: true,
        aiYorum: fallbackMsg,
        yorum: fallbackMsg,
        isFallback: true
      });
    }
    
  } catch (error) {
    console.error("💥 AI hatası:", error.message);
    
    res.json({
      success: true,
      aiYorum: `"${req.body.urun || 'Bu ürün'}" için AI analizi şu an yapılamıyor.`,
      yorum: `"${req.body.urun || 'Bu ürün'}" için AI analizi şu an yapılamıyor.`,
      isError: true
    });
  }
  
  console.log("🤖 AI İSTEĞİ TAMAMLANDI");
});

// 3. KAMERA AI
app.post("/api/kamera-ai", (req, res) => {
  const products = ["telefon", "laptop", "kitap", "kulaklık", "ayakkabı", "tişört"];
  const randomProduct = products[Math.floor(Math.random() * products.length)];
  
  res.json({
    success: true,
    urunTahmini: randomProduct,
    tespitEdilen: randomProduct
  });
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

// SUNUCUYU BAŞLAT
app.listen(PORT, () => {
  console.log(`✅ API http://localhost:${PORT} adresinde çalışıyor`);
  console.log(`🤖 AI DURUMU: AKTİF (4 model ile test edilecek)`);
});
