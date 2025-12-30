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
const geminiAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

console.log("🚀 FiyatTakip API ÇALIŞIYOR - AI:", geminiAI ? "AKTİF" : "PASİF");

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
    ai: geminiAI ? "active" : "inactive",
    endpoints: ["/health", "/api/fiyat-cek", "/api/ai-yorum", "/api/kamera-ai"]
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    ai: geminiAI ? "active" : "inactive"
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
    const { urun, fiyatlar = [] } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Ürün adı gerekli" });
    }
    
    console.log("🤖 AI yorum isteği:", urun);
    
    // EĞER API KEY YOKSA FALLBACK
    if (!geminiAI) {
      console.warn("⚠️  GEMINI_API_KEY tanımlı değil, fallback mesaj dönülüyor.");
      return res.json({
        success: true,
        aiYorum: `"${urun}" için fiyat analizi yapılamadı. Lütfen API key ayarlarını kontrol edin.`,
        yorum: `"${urun}" için fiyat analizi yapılamadı. Lütfen API key ayarlarını kontrol edin.`
      });
    }
    
    // GERÇEK GEMINI SORGUSU
    // HATALI KOD (muhtemelen):
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// DOĞRU KOD:
const model = genAI.getGenerativeModel({ model: "gemini-pro" });
// VEYA:
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    let prompt = `Aşağıdaki ürün hakkında kısa, net ve faydalı bir alışveriş tavsiyesi ver. Sadece tavsiyeni yaz, başlık vs. ekleme.\n\n`;
    prompt += `**Ürün:** ${urun}\n\n`;
    
    if (fiyatlar && fiyatlar.length > 0) {
      prompt += `**Fiyat Bilgileri:**\n`;
      fiyatlar.forEach(f => {
        prompt += `- ${f.site}: ${f.fiyat}\n`;
      });
      prompt += `\nBu fiyatları karşılaştırarak, kullanıcıya en iyi değeri nerede bulabileceğini, fiyatın uygun olup olmadığını veya alternatif siteleri öner.`;
    } else {
      prompt += `Bu ürün için henüz fiyat bilgisi yok. Genel olarak bu tür ürünlerde nelere dikkat etmeli, nereden araştırma yapmalı?`;
    }
    
    prompt += `\nCevabını Türkçe ve günlük konuşma diliyle ver.`;
    
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text().trim();
    
    res.json({
      success: true,
      aiYorum: aiResponse,
      yorum: aiResponse
    });
    
  } catch (error) {
    console.error("❌ AI yorum hatası:", error);
    res.status(500).json({
      success: false,
      error: "AI yorum yapılamadı",
      message: error.message || "Bilinmeyen hata"
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
    
    // EĞER API KEY YOKSA FALLBACK
    if (!geminiAI) {
      console.warn("⚠️  GEMINI_API_KEY tanımlı değil, random ürün dönülüyor.");
      const products = ["telefon", "laptop", "kitap", "kulaklık", "ayakkabı", "tişört"];
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      return res.json({
        success: true,
        urunTahmini: randomProduct,
        tespitEdilen: randomProduct
      });
    }
    
    // GERÇEK GEMINI VISION
    const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = "Bu fotoğrafta görünen ürün nedir? Sadece ürünün adını veya kısa açıklamasını Türkçe olarak yaz. Örneğin: 'iPhone 15', 'Siyah spor ayakkabı', 'Kahve makinesi'. Başka açıklama ekleme.";
    
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
      aciklama: `Görsel analiz sonucu: ${detectedText}`
    });
    
  } catch (error) {
    console.error("❌ Kamera AI hatası:", error);
    res.status(500).json({
      success: false,
      error: "Görsel analiz edilemedi",
      message: error.message || "Bilinmeyen hata"
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
  console.log(`🔑 Gemini AI Durumu: ${geminiAI ? "AKTİF ✓" : "PASİF (GEMINI_API_KEY bekleniyor)"}`);
});
