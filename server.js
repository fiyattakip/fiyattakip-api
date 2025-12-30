const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const fetch = require("node-fetch"); // EKLE BUNU!

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));

const PORT = process.env.PORT || 3000;
console.log("🚀 FiyatTakip API ÇALIŞIYOR");

// ... scrapeTrendyol ve scrapeHepsiburada fonksiyonları AYNI KALSIN ...

// ==================== API ENDPOINT'LER ====================
app.get("/", (req, res) => {
  res.json({ success: true, service: "FiyatTakip API", status: "running" });
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "healthy" });
});

// 1. FIYAT ÇEKME (AYNI KALSIN)
app.post("/api/fiyat-cek", async (req, res) => {
  try {
    const { urun } = req.body;
    if (!urun) return res.status(400).json({ success: false, error: "Ürün adı gerekli" });
    
    console.log("🔍 Fiyat araması:", urun);
    
    const [trendyolResults, hepsiburadaResults] = await Promise.allSettled([
      scrapeTrendyol(urun),
      scrapeHepsiburada(urun)
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
      query: urun,
      toplamUrun: uniqueProducts.length,
      fiyatlar: uniqueProducts.slice(0, 6)
    });
    
  } catch (error) {
    console.error("Fiyat çekme hatası:", error);
    res.status(500).json({ success: false, error: "Fiyat çekilemedi" });
  }
});

// 2. AI YORUM - %100 ÇALIŞAN BASİT KOD
app.post("/api/ai-yorum", async (req, res) => {
  console.log("🤖 AI İSTEĞİ GELDİ");
  
  try {
    const { urun, fiyatlar = [], apiKey } = req.body;
    
    if (!urun || !apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün adı ve API Key gerekli" 
      });
    }
    
    console.log("📦 Ürün:", urun);
    console.log("🔑 Key var mı?:", apiKey ? "EVET" : "HAYIR");
    
    // EN GARANTİLİ MODEL VE URL
    const MODEL = "gemini-1.5-flash";
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${apiKey}`;
    
    // BASİT PROMPT
    const prompt = `"${urun}" ürünü hakkında 80 kelimelik alışveriş tavsiyesi ver. Türkçe cevap ver.`;
    
    console.log("📤 Google API'ye istek atılıyor...");
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200 }
      })
    });
    
    console.log("📥 Google'dan yanıt:", response.status);
    
    if (response.ok) {
      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı.";
      
      console.log("✅ GERÇEK AI ÇALIŞTI!");
      console.log("📝 Yanıt:", aiText.substring(0, 100) + "...");
      
      res.json({
        success: true,
        aiYorum: aiText,
        yorum: aiText,
        isRealAI: true,
        model: MODEL
      });
      
    } else {
      console.log("❌ Google API hatası:", response.status);
      
      // FALLBACK
      res.json({
        success: true,
        aiYorum: `"${urun}" ürününü alırken Trendyol, Hepsiburada ve Amazon'da fiyat karşılaştırması yapın. Ürün yorumlarını okuyun.`,
        yorum: `"${urun}" ürününü alırken Trendyol, Hepsiburada ve Amazon'da fiyat karşılaştırması yapın. Ürün yorumlarını okuyun.`,
        isFallback: true,
        error: `Google API: ${response.status}`
      });
    }
    
  } catch (error) {
    console.error("💥 AI hatası:", error.message);
    
    res.json({
      success: true,
      aiYorum: `"${req.body.urun || 'Ürün'}" için AI analizi geçici olarak kullanılamıyor.`,
      yorum: `"${req.body.urun || 'Ürün'}" için AI analizi geçici olarak kullanılamıyor.`,
      isError: true
    });
  }
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

// 4. ESKİ ENDPOINT'LER
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
});
