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

// 2. GERÇEK ÇALIŞAN AI YORUM (GEMINI)
app.post("/api/ai-yorum", async (req, res) => {
  console.log("=== AI YORUM İSTEĞİ BAŞLADI ===");
  
  try {
    const { urun, fiyatlar = [], apiKey } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Ürün adı gerekli" });
    }
    
    console.log("📝 Ürün:", urun);
    console.log("🔑 API Key (ilk 15):", apiKey ? apiKey.substring(0, 15) + "..." : "YOK");
    
    // API KEY KONTROLÜ
    if (!apiKey) {
      console.log("❌ API Key yok");
      return res.status(400).json({ 
        success: false, 
        error: "API Key gerekli. Lütfen AI ayarlarından ekleyin." 
      });
    }
    
    // GOOGLE GEMINI API - DOĞRUDAN İSTEK
    const API_BASE = "https://generativelanguage.googleapis.com";
    const API_VERSION = "v1";  // v1beta yerine v1 kullan
    
    // ÇALIŞAN MODEL LİSTESİ (güncel)
    const modelsToTry = [
      "gemini-1.5-flash",      // En yaygın
      "gemini-1.0-pro",        // Standart
      "gemini-1.5-pro",        // Pro
      "gemini-2.0-flash-exp",  // Deneysel
      "gemini-2.0-flash-lite"  // Lite
    ];
    
    let aiResponse = "";
    let workingModel = "";
    let lastError = "";
    
    // HER MODELİ DENE
    for (const modelName of modelsToTry) {
      try {
        console.log(`🔄 Model deneniyor: ${modelName}`);
        
        const url = `${API_BASE}/${API_VERSION}/models/${modelName}:generateContent?key=${apiKey}`;
        
        // PROMPT HAZIRLA
        let prompt = `Aşağıdaki ürün hakkında kısa, faydalı bir alışveriş tavsiyesi ver:\n\n`;
        prompt += `**Ürün:** ${urun}\n\n`;
        
        if (fiyatlar && fiyatlar.length > 0) {
          prompt += `**Fiyat Bilgisi:**\n`;
          fiyatlar.forEach(f => {
            prompt += `- ${f.site}: ${f.fiyat}\n`;
          });
          prompt += `\nBu fiyat uygun mu? Satın almak için önerin nedir?\n`;
        } else {
          prompt += `Bu ürünü alırken nelere dikkat etmeliyim?\n`;
        }
        
        prompt += `\nCevabını Türkçe ve 100 kelimeyi geçmeyecek şekilde ver.`;
        
        console.log(`📤 İstek gönderiliyor: ${modelName}`);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 300
            }
          })
        });
        
        console.log(`📥 Yanıt durumu (${modelName}):`, response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Model çalıştı: ${modelName}`);
          
          aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı.";
          workingModel = modelName;
          
          // YANITI KONTROL ET
          if (aiResponse.length < 10 || aiResponse.includes("API") || aiResponse.includes("key")) {
            console.log(`⚠️ Yanıt çok kısa veya hatalı, diğer model deneniyor...`);
            continue; // Diğer modeli dene
          }
          
          console.log(`📝 AI Yanıtı (ilk 50 karakter): ${aiResponse.substring(0, 50)}...`);
          break; // Başarılı, döngüden çık
          
        } else {
          const errorText = await response.text();
          lastError = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
          console.log(`❌ ${modelName} çalışmadı:`, lastError);
        }
        
      } catch (error) {
        lastError = error.message;
        console.log(`❌ ${modelName} hatası:`, error.message);
      }
    }
    
    // SONUÇ
    if (aiResponse && aiResponse.length > 20) {
      console.log("🎉 GERÇEK AI YANITI BAŞARILI!");
      
      res.json({
        success: true,
        aiYorum: aiResponse,
        yorum: aiResponse,
        model: workingModel,
        isRealAI: true
      });
      
    } else {
      console.log("⚠️ Hiçbir model çalışmadı, fallback gönderiliyor...");
      
      // AKILLI FALLBACK
      const fallbackMsg = `"${urun}" ürününü alırken dikkat etmeniz gerekenler:\n\n`;
      
      if (urun.toLowerCase().includes("tablet") || urun.toLowerCase().includes("pad")) {
        fallbackMsg += `• Ekran kalitesi ve çözünürlüğe dikkat edin\n`;
        fallbackMsg += `• İşlemci performansı önemli (Snapdragon tercih edin)\n`;
        fallbackMsg += `• RAM ve depolama alanını ihtiyacınıza göre seçin\n`;
        fallbackMsg += `• Batarya ömrü uzun olan modelleri tercih edin\n`;
      } else if (urun.toLowerCase().includes("telefon") || urun.toLowerCase().includes("iphone")) {
        fallbackMsg += `• İşlemci ve RAM performansına bakın\n`;
        fallbackMsg += `• Kamera kalitesi ve özelliklerini kontrol edin\n`;
        fallbackMsg += `• Batarya kapasitesi ve şarj hızı önemli\n`;
        fallbackMsg += `• Ekran boyutu ve teknolojisini değerlendirin\n`;
      } else {
        fallbackMsg += `• Ürün özelliklerini detaylıca inceleyin\n`;
        fallbackMsg += `• Kullanıcı yorumlarını mutlaka okuyun\n`;
        fallbackMsg += `• Farklı satıcılardan fiyat karşılaştırması yapın\n`;
        fallbackMsg += `• Garanti ve iade koşullarını kontrol edin\n`;
      }
      
      fallbackMsg += `\nTrendyol, Hepsiburada ve Amazon'da fiyatları karşılaştırın.`;
      
      res.json({
        success: true,
        aiYorum: fallbackMsg,
        yorum: fallbackMsg,
        isFallback: true,
        error: lastError
      });
    }
    
  } catch (error) {
    console.error("💥 AI endpoint hatası:", error);
    
    res.json({
      success: true,
      aiYorum: `"${req.body.urun || 'Bu ürün'}" için detaylı AI analizi şu an yapılamıyor. ` +
               `Ürün özelliklerini ve kullanıcı yorumlarını dikkatlice incelemenizi öneririm.`,
      yorum: `"${req.body.urun || 'Bu ürün'}" için detaylı AI analizi şu an yapılamıyor. ` +
             `Ürün özelliklerini ve kullanıcı yorumlarını dikkatlice incelemenizi öneririm.`,
      isError: true
    });
  }
  
  console.log("=== AI YORUM İSTEĞİ TAMAMLANDI ===");
});

// 3. KAMERA AI (Aynı kalabilir)
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

// ESKİ ENDPOINT YÖNLENDİRMELERİ (Aynı kalacak)
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
