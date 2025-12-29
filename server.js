const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// --- Middleware ---
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));
app.options("*", cors({ origin: true }));

// --- Config ---
const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const geminiAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// --- Helpers ---
function nowTR() {
  try { return new Date().toLocaleString("tr-TR"); } catch { return new Date().toISOString(); }
}

function normalizeForMatch(s="") {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçı\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Root route ---
app.get("/", (req, res) => {
  res.json({ ok: true, status: "online", time: nowTR(), routes: ["/health", "/api/fiyat-cek", "/api/ai-yorum", "/api/kamera-ai"] });
});

// --- Health route ---
app.get("/health", (req, res) => {
  res.json({
    status: "online",
    zaman: nowTR(),
    ai: geminiAI ? "Aktif" : "Pasif"
  });
});

// --- Price Scraping (Geliştirilmiş) ---
async function fetchTrendyol(query) {
  try {
    const url = `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, { 
      timeout: 15000, 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
        "Accept-Language": "tr-TR,tr;q=0.9"
      } 
    });
    
    const $ = cheerio.load(response.data);
    const items = [];
    
    // Trendyol'da farklı ürün container'ları
    $('div[class*="p-card-wrppr"], div[data-testid="product-card"]').slice(0, 10).each((i, el) => {
      const name = $(el).find('span[class*="prdct-desc-cntnr-name"], div[class*="prdct-desc-cntnr-ttl"]').first().text().trim();
      const price = $(el).find('div[class*="prc-box-dscntd"], div[class*="prc-box-sllng"]').first().text().trim();
      let link = $(el).find('a').first().attr('href');
      
      if (link && !link.startsWith('http')) {
        link = 'https://www.trendyol.com' + link;
      }
      
      if (name && link) {
        items.push({
          site: "Trendyol",
          urun: name.substring(0, 100),
          fiyat: price || "Fiyat yok",
          link: link,
          orijinalFiyat: price ? parseFloat(price.replace(/[^\d,]/g, '').replace(',', '.')) : null
        });
      }
    });
    
    return items;
  } catch (error) {
    console.error("Trendyol error:", error.message);
    return [];
  }
}

async function fetchHepsiburada(query) {
  try {
    const url = `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html"
      }
    });
    
    const $ = cheerio.load(response.data);
    const items = [];
    
    $('li[class*="productListContent"]').slice(0, 10).each((i, el) => {
      const name = $(el).find('h3[data-test-id="product-card-name"]').first().text().trim();
      const price = $(el).find('div[data-test-id="price-current-price"]').first().text().trim();
      let link = $(el).find('a').first().attr('href');
      
      if (link && !link.startsWith('http')) {
        link = 'https://www.hepsiburada.com' + link;
      }
      
      if (name && link) {
        items.push({
          site: "Hepsiburada",
          urun: name.substring(0, 100),
          fiyat: price || "Fiyat yok",
          link: link,
          orijinalFiyat: price ? parseFloat(price.replace(/[^\d,]/g, '').replace(',', '.')) : null
        });
      }
    });
    
    return items;
  } catch (error) {
    console.error("Hepsiburada error:", error.message);
    return [];
  }
}

async function fetchN11(query) {
  try {
    const url = `https://www.n11.com/arama?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const $ = cheerio.load(response.data);
    const items = [];
    
    $('.listItem').slice(0, 10).each((i, el) => {
      const name = $(el).find('.productName').first().text().trim();
      const price = $(el).find('.newPrice ins').first().text().trim() || 
                    $(el).find('.priceContainer').first().text().trim();
      let link = $(el).find('a').first().attr('href');
      
      if (name && link) {
        items.push({
          site: "N11",
          urun: name.substring(0, 100),
          fiyat: price || "Fiyat yok",
          link: link,
          orijinalFiyat: price ? parseFloat(price.replace(/[^\d,]/g, '').replace(',', '.')) : null
        });
      }
    });
    
    return items;
  } catch (error) {
    console.error("N11 error:", error.message);
    return [];
  }
}

function filterRelevant(query, items) {
  const q = normalizeForMatch(query);
  if (!q || items.length === 0) return items;
  
  const qTokens = q.split(' ').filter(t => t.length > 2);
  if (qTokens.length === 0) return items;
  
  const scored = items.map(item => {
    const name = normalizeForMatch(item.urun);
    let score = 0;
    
    qTokens.forEach(token => {
      if (name.includes(token)) score += 3;
    });
    
    // Bonus puan: tam eşleşme
    if (name.includes(q)) score += 5;
    
    return { ...item, relevanceScore: score };
  });
  
  // Puanı pozitif olanları filtrele
  const filtered = scored.filter(item => item.relevanceScore > 0);
  
  // Sırala (yüksek puan önce)
  filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Puanları kaldır
  return filtered.map(({ relevanceScore, ...item }) => item);
}

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const match = priceStr.match(/(\d+(?:[.,]\d+)*)/);
  if (!match) return null;
  
  const cleaned = match[0].replace(/\./g, '').replace(',', '.');
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

function sortByPrice(items, sort = "asc") {
  return [...items].sort((a, b) => {
    const priceA = a.orijinalFiyat || parsePrice(a.fiyat) || Infinity;
    const priceB = b.orijinalFiyat || parsePrice(b.fiyat) || Infinity;
    
    if (sort === "desc") {
      return priceB - priceA;
    }
    return priceA - priceB;
  });
}

// --- Fiyat Çekme API ---
app.post("/api/fiyat-cek", async (req, res) => {
  try {
    const { urun, page = 1, sort = "asc" } = req.body;
    
    if (!urun || typeof urun !== 'string' || urun.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: "En az 2 karakterlik ürün adı gerekli" 
      });
    }
    
    const query = urun.trim();
    
    // Paralel olarak tüm sitelerden veri çek
    const [trendyolResults, hepsiburadaResults, n11Results] = await Promise.allSettled([
      fetchTrendyol(query),
      fetchHepsiburada(query),
      fetchN11(query)
    ]);
    
    let allProducts = [];
    
    if (trendyolResults.status === 'fulfilled') {
      allProducts = allProducts.concat(trendyolResults.value);
    }
    if (hepsiburadaResults.status === 'fulfilled') {
      allProducts = allProducts.concat(hepsiburadaResults.value);
    }
    if (n11Results.status === 'fulfilled') {
      allProducts = allProducts.concat(n11Results.value);
    }
    
    // İlgili sonuçları filtrele
    allProducts = filterRelevant(query, allProducts);
    
    // Fiyata göre sırala
    allProducts = sortByPrice(allProducts, sort);
    
    // Benzersiz ürünler (link'e göre)
    const uniqueProducts = [];
    const seenLinks = new Set();
    
    for (const product of allProducts) {
      if (!seenLinks.has(product.link)) {
        seenLinks.add(product.link);
        uniqueProducts.push(product);
      }
    }
    
    const pageSize = 4;
    const totalProducts = uniqueProducts.length;
    const totalPages = Math.ceil(totalProducts / pageSize) || 1;
    const currentPage = Math.min(Math.max(1, parseInt(page)), totalPages);
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = uniqueProducts.slice(startIndex, endIndex);
    
    // Fiyat analizi
    const prices = uniqueProducts
      .map(p => p.orijinalFiyat || parsePrice(p.fiyat))
      .filter(p => p !== null);
    
    const priceStats = {
      min: prices.length > 0 ? Math.min(...prices) : null,
      max: prices.length > 0 ? Math.max(...prices) : null,
      avg: prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : null,
      count: prices.length
    };
    
    res.json({
      success: true,
      query: query,
      toplamUrun: totalProducts,
      sayfa: currentPage,
      toplamSayfa: totalPages,
      siralama: sort,
      fiyatlar: paginatedProducts,
      istatistikler: priceStats,
      zaman: nowTR()
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

// --- AI Yorum API (Geliştirilmiş) ---
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { urun, fiyatlar = [] } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün adı gerekli" 
      });
    }
    
    // Gemini AI aktif değilse fallback dön
    if (!geminiAI) {
      return res.json({
        success: true,
        yorum: "🤖 AI servisi şu anda aktif değil. Fiyat karşılaştırması yapmak için lütfen daha sonra tekrar deneyin.",
        detay: {
          enUcuzFiyat: null,
          enPahaliFiyat: null,
          ortalamaFiyat: null
        }
      });
    }
    
    // Fiyat istatistikleri
    const prices = fiyatlar
      .map(f => {
        const priceStr = f.fiyat || f.price || "";
        const match = priceStr.match(/(\d+(?:[.,]\d+)*)/);
        if (!match) return null;
        return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
      })
      .filter(p => p !== null && !isNaN(p));
    
    const priceDetails = {
      enUcuzFiyat: prices.length > 0 ? `${Math.min(...prices).toFixed(2)} TL` : "Bilinmiyor",
      enPahaliFiyat: prices.length > 0 ? `${Math.max(...prices).toFixed(2)} TL` : "Bilinmiyor",
      ortalamaFiyat: prices.length > 0 ? `${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)} TL` : "Bilinmiyor",
      fiyatSayisi: prices.length
    };
    
    // Fiyat listesi metni oluştur
    let fiyatMetni = "";
    if (fiyatlar.length > 0) {
      fiyatMetni = "Mevcut fiyatlar:\n" + fiyatlar.map(f => {
        const site = f.site || f.siteName || "Bilinmeyen Site";
        const fiyat = f.fiyat || f.price || "Fiyat bilgisi yok";
        return `- ${site}: ${fiyat}`;
      }).join('\n');
    } else {
      fiyatMetni = "Henüz fiyat bilgisi bulunmuyor.";
    }
    
    // AI için prompt oluştur
    const prompt = `
    Ürün: ${urun}
    
    ${fiyatMetni}
    
    Fiyat İstatistikleri:
    - En düşük fiyat: ${priceDetails.enUcuzFiyat}
    - En yüksek fiyat: ${priceDetails.enPahaliFiyat}
    - Ortalama fiyat: ${priceDetails.ortalamaFiyat}
    
    Lütfen bu ürün için şu şekilde bir değerlendirme yap:
    1. Mevcut fiyatların makul olup olmadığını değerlendir
    2. Ürünün değerini (fiyat/performans) 1-10 arasında puanla
    3. Bu ürün kimler için uygun, kimler için değil?
    4. Alışveriş önerisi (şimdi al, bekle, alternatif ara vb.)
    
    Cevabını 4-5 cümle ile sade ve anlaşılır Türkçe ile ver.
    Klişe ifadeler kullanma, samimi ve yardımcı ol.
    `;
    
    const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const aiResponse = await result.response.text();
    
    res.json({
      success: true,
      aiYorum: aiResponse.trim(),
      yorum: aiResponse.trim(), // Geri uyumluluk için
      detay: priceDetails,
      urun: urun
    });
    
  } catch (error) {
    console.error("AI yorum hatası:", error);
    
    // Fallback response
    res.json({
      success: true,
      aiYorum: "🤖 AI değerlendirmesi şu anda geçici olarak kullanılamıyor. Ürün fiyatlarını manuel olarak karşılaştırabilirsiniz.",
      yorum: "AI servisi geçici olarak kullanılamıyor.",
      detay: {
        enUcuzFiyat: "Bilinmiyor",
        enPahaliFiyat: "Bilinmiyor",
        ortalamaFiyat: "Bilinmiyor"
      }
    });
  }
});

// --- Kamera AI (Görsel Analiz) ---
app.post("/api/kamera-ai", async (req, res) => {
  try {
    const { image, mime = "image/jpeg" } = req.body;
    
    if (!image) {
      return res.status(400).json({ 
        success: false, 
        error: "Görsel verisi gerekli" 
      });
    }
    
    // Gemini AI aktif değilse fallback
    if (!geminiAI) {
      return res.json({
        success: true,
        urunTahmini: "telefon veya elektronik cihaz",
        tespitEdilen: "Elektronik ürün tespit edildi",
        aciklama: "AI servisi aktif değil. Lütfen ürün adını manuel girin."
      });
    }
    
    const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Base64 veriyi hazırla
    const imageParts = [{
      inlineData: {
        data: image,
        mimeType: mime
      }
    }];
    
    // Görsel analiz prompt'u
    const prompt = "Bu fotoğraftaki ürünü detaylı şekilde tanımla. Ürün adı, marka, model, renk ve özelliklerini belirt. Türkçe cevap ver. Sadece ürün bilgilerini listele, başka açıklama yapma.";
    
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response.text();
    
    // Yanıttan ürün adını çıkar
    const lines = response.split('\n');
    const urunTahmini = lines[0] || "elektronik ürün";
    
    // Tüm satırları birleştir
    const fullDescription = lines.join(' ').substring(0, 200);
    
    // Hemen arama yapılacak anahtar kelimeyi belirle
    let searchQuery = urunTahmini;
    const commonBrands = ['iphone', 'samsung', 'huawei', 'xiaomi', 'oppo', 'vivo', 'nike', 'adidas', 'apple', 'lenovo', 'hp', 'dell'];
    
    for (const brand of commonBrands) {
      if (response.toLowerCase().includes(brand)) {
        searchQuery = brand + " " + searchQuery;
        break;
      }
    }
    
    res.json({
      success: true,
      urunTahmini: searchQuery.trim(),
      tespitEdilen: urunTahmini,
      aciklama: fullDescription,
      aiAnaliz: response.substring(0, 300)
    });
    
  } catch (error) {
    console.error("Kamera AI hatası:", error);
    
    res.json({
      success: true,
      urunTahmini: "telefon",
      tespitEdilen: "Elektronik cihaz tespit edildi",
      aciklama: "Görsel analiz sırasında hata oluştu. Lütfen ürün adını manuel girin."
    });
  }
});

// --- Eski endpoint'ler için yönlendirme ---
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

// --- Server başlatma ---
app.listen(PORT, () => {
  console.log(`✅ FiyatTakip API çalışıyor: http://localhost:${PORT}`);
  console.log(`🤖 AI Durumu: ${geminiAI ? "AKTİF" : "PASİF"}`);
});
