const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));

// CONFIG
const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Log API key status
console.log("=".repeat(50));
console.log("🚀 FiyatTakip API Başlatılıyor");
console.log("📅", new Date().toLocaleString("tr-TR"));
console.log("🔑 GEMINI_API_KEY:", GEMINI_API_KEY ? "✅ VAR" : "❌ YOK");
console.log("🌐 PORT:", PORT);
console.log("=".repeat(50));

const geminiAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// HEALTH CHECK
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "FiyatTakip API",
    version: "6.0.0",
    status: "running",
    ai: geminiAI ? "active" : "inactive",
    endpoints: [
      "GET  /health",
      "POST /api/fiyat-cek",
      "POST /api/ai-yorum", 
      "POST /api/kamera-ai"
    ],
    time: new Date().toLocaleString("tr-TR")
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    ai: geminiAI ? "active" : "inactive - GEMINI_API_KEY required",
    timestamp: new Date().toISOString()
  });
});

// SIMPLE PRICE SCRAPING
async function scrapeTrendyol(query) {
  try {
    const url = `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const $ = cheerio.load(data);
    const products = [];
    
    $('div.p-card-wrppr').each((i, el) => {
      if (products.length >= 6) return false;
      
      const title = $(el).find('span.prdct-desc-cntnr-name').text().trim();
      const price = $(el).find('div.prc-box-dscntd').text().trim();
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
    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const $ = cheerio.load(data);
    const products = [];
    
    $('li[class*="productListContent"]').each((i, el) => {
      if (products.length >= 6) return false;
      
      const title = $(el).find('h3[data-test-id="product-card-name"]').text().trim();
      const price = $(el).find('div[data-test-id="price-current-price"]').text().trim();
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

// FIYAT ÇEKME API
app.post("/api/fiyat-cek", async (req, res) => {
  console.log("📥 /api/fiyat-cek çağrıldı:", req.body.urun);
  
  try {
    const { urun, page = 1, sort = "asc" } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Ürün adı gerekli" });
    }
    
    const query = urun.trim();
    
    // İki siteden paralel veri çek
    const [trendyolData, hepsiburadaData] = await Promise.allSettled([
      scrapeTrendyol(query),
      scrapeHepsiburada(query)
    ]);
    
    let allProducts = [];
    
    if (trendyolData.status === 'fulfilled') allProducts.push(...trendyolData.value);
    if (hepsiburadaData.status === 'fulfilled') allProducts.push(...hepsiburadaData.value);
    
    // Benzersiz ürünler
    const uniqueProducts = [];
    const seenLinks = new Set();
    
    allProducts.forEach(p => {
      if (!seenLinks.has(p.link)) {
        seenLinks.add(p.link);
        uniqueProducts.push(p);
      }
    });
    
    // Fiyatları parse et ve sırala
    function getPriceNumber(priceStr) {
      if (!priceStr) return 9999999;
      const match = priceStr.match(/(\d+(?:[.,]\d+)*)/);
      if (!match) return 9999999;
      return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
    }
    
    uniqueProducts.sort((a, b) => {
      const priceA = getPriceNumber(a.fiyat);
      const priceB = getPriceNumber(b.fiyat);
      return sort === "desc" ? priceB - priceA : priceA - priceB;
    });
    
    // Sayfalama
    const pageSize = 4;
    const total = uniqueProducts.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const currentPage = Math.min(Math.max(1, parseInt(page)), totalPages);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageProducts = uniqueProducts.slice(start, end);
    
    console.log(`✅ "${query}" için ${total} ürün bulundu`);
    
    res.json({
      success: true,
      query: query,
      toplamUrun: total,
      sayfa: currentPage,
      toplamSayfa: totalPages,
      siralama: sort,
      fiyatlar: pageProducts,
      timestamp: new Date().toLocaleString("tr-TR")
    });
    
  } catch (error) {
    console.error("Fiyat çekme hatası:", error);
    res.status(500).json({
      success: false,
      error: "Fiyat çekilemedi",
      detail: error.message
    });
  }
});

// AI YORUM API (BASIT VE ÇALIŞAN)
app.post("/api/ai-yorum", async (req, res) => {
  console.log("📥 /api/ai-yorum çağrıldı");
  
  try {
    const { urun, fiyatlar = [] } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Ürün adı gerekli" });
    }
    
    const query = urun.trim();
    
    // Fiyat analizi
    const prices = fiyatlar.map(f => {
      const priceStr = f.fiyat || "";
      const match = priceStr.match(/(\d+(?:[.,]\d+)*)/);
      return match ? parseFloat(match[0].replace(/\./g, '').replace(',', '.')) : null;
    }).filter(p => p !== null);
    
    const priceInfo = {
      enUcuz: prices.length ? Math.min(...prices) : null,
      enPahali: prices.length ? Math.max(...prices) : null,
      ortalama: prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      sayi: prices.length
    };
    
    // EĞER GEMINI YOKSA SMART FALLBACK
    if (!geminiAI) {
      console.log("⚠️ Gemini yok, fallback mesaj üretiliyor");
      
      let fallbackMsg = "";
      const urunLower = query.toLowerCase();
      
      if (urunLower.includes('iphone') || urunLower.includes('telefon')) {
        fallbackMsg = `📱 ${query} akıllı telefon modeli. `;
        if (priceInfo.sayi > 0) {
          fallbackMsg += `Fiyatlar ${priceInfo.enUcuz.toFixed(2)} TL ile ${priceInfo.enPahali.toFixed(2)} TL arasında. `;
          if (priceInfo.sayi >= 3) {
            fallbackMsg += `Ortalama fiyat ${priceInfo.ortalama.toFixed(2)} TL. `;
          }
          fallbackMsg += `Teknoloji ürünlerinde fiyatlar hızla değişebilir.`;
        }
      }
      else if (urunLower.includes('laptop') || urunLower.includes('bilgisayar')) {
        fallbackMsg = `💻 ${query} bilgisayar ürünü. `;
        if (priceInfo.sayi > 0) {
          fallbackMsg += `En ucuz ${priceInfo.enUcuz.toFixed(2)} TL, en pahalı ${priceInfo.enPahali.toFixed(2)} TL. `;
          fallbackMsg += `${priceInfo.sayi} farklı fiyat bulundu.`;
        }
      }
      else {
        fallbackMsg = `🛒 ${query} ürünü için değerlendirme: `;
        if (priceInfo.sayi > 0) {
          fallbackMsg += `${priceInfo.sayi} farklı fiyat bulundu. `;
          if (priceInfo.enPahali - priceInfo.enUcuz > priceInfo.enUcuz * 0.5) {
            fallbackMsg += `Fiyat farkı yüksek, dikkatli olun.`;
          } else {
            fallbackMsg += `Fiyatlar makul görünüyor.`;
          }
        } else {
          fallbackMsg += `Henüz fiyat bilgisi yok. Farklı sitelerde arama yapın.`;
        }
      }
      
      return res.json({
        success: true,
        aiYorum: fallbackMsg,
        yorum: fallbackMsg,
        detay: {
          enUcuzFiyat: priceInfo.enUcuz ? `${priceInfo.enUcuz.toFixed(2)} TL` : "Yok",
          enPahaliFiyat: priceInfo.enPahali ? `${priceInfo.enPahali.toFixed(2)} TL` : "Yok",
          ortalamaFiyat: priceInfo.ortalama ? `${priceInfo.ortalama.toFixed(2)} TL` : "Yok"
        },
        not: "AI servisi aktif değil. GEMINI_API_KEY ekleyin."
      });
    }
    
    // GEMINI AI VARSA - GERÇEK YORUM
    try {
      const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `"${query}" ürünü hakkında kısa, samimi bir alışveriş değerlendirmesi yap. 
      ${priceInfo.sayi > 0 ? `Fiyatlar: ${priceInfo.enUcuz} TL - ${priceInfo.enPahali} TL arasında. Ortalama: ${priceInfo.ortalama} TL.` : "Henüz fiyat bilgisi yok."}
      
      Format:
      1. Ürün değerlendirmesi (2 cümle)
      2. Fiyat analizi
      3. Tavsiye (al/bekle/alternatif ara)
      
      Kısa, net, Türkçe. Klişe cümle yok.`;
      
      const result = await model.generateContent(prompt);
      const aiText = await result.response.text();
      
      res.json({
        success: true,
        aiYorum: aiText.trim(),
        yorum: aiText.trim(),
        detay: {
          enUcuzFiyat: priceInfo.enUcuz ? `${priceInfo.enUcuz.toFixed(2)} TL` : "Yok",
          enPahaliFiyat: priceInfo.enPahali ? `${priceInfo.enPahali.toFixed(2)} TL` : "Yok",
          ortalamaFiyat: priceInfo.ortalama ? `${priceInfo.ortalama.toFixed(2)} TL` : "Yok"
        },
        not: "Gerçek AI yorumu"
      });
      
    } catch (aiError) {
      console.error("Gemini hatası:", aiError);
      throw aiError;
    }
    
  } catch (error) {
    console.error("AI yorum hatası:", error);
    res.status(500).json({
      success: false,
      error: "AI yorum yapılamadı",
      detail: error.message
    });
  }
});

// KAMERA AI
app.post("/api/kamera-ai", async (req, res) => {
  console.log("📥 /api/kamera-ai çağrıldı");
  
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ success: false, error: "Görsel gerekli" });
    }
    
    if (!geminiAI) {
      return res.json({
        success: true,
        urunTahmini: "elektronik ürün",
        tespitEdilen: "Ürün tespit edildi",
        aciklama: "AI servisi aktif değil. Ürün adını yazın."
      });
    }
    
    const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent([
      "Bu fotoğraftaki ürünün adını sadece yaz. Örnek: 'iPhone 15 Pro', 'Nike Air Force 1', 'Kitap - Savaş ve Barış'. Sadece ürün adı.",
      { inlineData: { data: image, mimeType: "image/jpeg" } }
    ]);
    
    const detected = await result.response.text();
    
    res.json({
      success: true,
      urunTahmini: detected.trim() || "ürün",
      tespitEdilen: detected.trim() || "Ürün tespit edildi",
      aciklama: `AI ürünü tespit etti: ${detected.trim()}`,
      timestamp: new Date().toLocaleString("tr-TR")
    });
    
  } catch (error) {
    console.error("Kamera AI hatası:", error);
    res.json({
      success: true,
      urunTahmini: "elektronik ürün",
      tespitEdilen: "Tespit başarısız",
      aciklama: "Görsel analiz hatası. Ürün adını yazın."
    });
  }
});

// OLD ENDPOINTS FOR COMPATIBILITY
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

// START SERVER
app.listen(PORT, () => {
  console.log(`✅ FiyatTakip API çalışıyor: http://localhost:${PORT}`);
  console.log(`🤖 AI Durumu: ${geminiAI ? "AKTİF" : "PASİF (GEMINI_API_KEY gerekli)"}`);
});
