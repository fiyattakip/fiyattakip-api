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

// Log API key status (first few characters only for security)
console.log("🔑 Gemini API Key Status:", GEMINI_API_KEY ? `Present (${GEMINI_API_KEY.substring(0, 10)}...)` : "MISSING!");

const geminiAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// --- Helpers ---
function nowTR() {
  try { return new Date().toLocaleString("tr-TR"); } catch { return new Date().toISOString(); }
}

// --- Root route ---
app.get("/", (req, res) => {
  res.status(200).json({ 
    ok: true, 
    status: "online", 
    time: nowTR(),
    ai: geminiAI ? "ACTIVE" : "INACTIVE",
    message: "FiyatTakip API v5.1.0"
  });
});

// --- Health route ---
app.get("/health", (req, res) => {
  res.json({
    status: "online",
    zaman: nowTR(),
    versiyon: "5.1.0",
    ai: geminiAI ? "AKTİF" : "PASİF - GEMINI_API_KEY eksik",
    routes: ["/health", "/api/fiyat-cek", "/api/ai-yorum", "/api/kamera-ai"]
  });
});

// --- Price scraping functions ---
async function fetchTrendyol(query) {
  try {
    const url = `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, { 
      timeout: 10000, 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9"
      } 
    });
    
    const $ = cheerio.load(response.data);
    const items = [];
    
    $('div[class*="p-card-wrppr"]').slice(0, 8).each((i, el) => {
      const name = $(el).find('span[class*="prdct-desc-cntnr-name"]').text().trim();
      const price = $(el).find('div[class*="prc-box-dscntd"]').text().trim();
      let link = $(el).find('a').attr('href');
      
      if (link && !link.startsWith('http')) {
        link = 'https://www.trendyol.com' + link;
      }
      
      if (name && link) {
        items.push({
          site: "Trendyol",
          urun: name.substring(0, 100),
          fiyat: price || "Fiyat yok",
          link: link
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
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const $ = cheerio.load(response.data);
    const items = [];
    
    $('li[class*="productListContent"]').slice(0, 8).each((i, el) => {
      const name = $(el).find('h3[data-test-id="product-card-name"]').text().trim();
      const price = $(el).find('div[data-test-id="price-current-price"]').text().trim();
      let link = $(el).find('a').attr('href');
      
      if (link && !link.startsWith('http')) {
        link = 'https://www.hepsiburada.com' + link;
      }
      
      if (name && link) {
        items.push({
          site: "Hepsiburada",
          urun: name.substring(0, 100),
          fiyat: price || "Fiyat yok",
          link: link
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
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const $ = cheerio.load(response.data);
    const items = [];
    
    $('.listItem').slice(0, 8).each((i, el) => {
      const name = $(el).find('.productName').text().trim();
      const price = $(el).find('.newPrice ins').text().trim() || 
                    $(el).find('.priceContainer').text().trim();
      let link = $(el).find('a').attr('href');
      
      if (name && link) {
        items.push({
          site: "N11",
          urun: name.substring(0, 100),
          fiyat: price || "Fiyat yok",
          link: link
        });
      }
    });
    
    return items;
  } catch (error) {
    console.error("N11 error:", error.message);
    return [];
  }
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
    console.log(`🔍 Fiyat arama: "${query}"`);
    
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
    
    // Remove duplicates by link
    const uniqueProducts = [];
    const seenLinks = new Set();
    
    for (const product of allProducts) {
      if (!seenLinks.has(product.link)) {
        seenLinks.add(product.link);
        uniqueProducts.push(product);
      }
    }
    
    // Parse prices for sorting
    function parsePrice(priceStr) {
      if (!priceStr) return Infinity;
      const match = priceStr.match(/(\d+(?:[.,]\d+)*)/);
      if (!match) return Infinity;
      const cleaned = match[0].replace(/\./g, '').replace(',', '.');
      return parseFloat(cleaned) || Infinity;
    }
    
    // Sort products
    uniqueProducts.sort((a, b) => {
      const priceA = parsePrice(a.fiyat);
      const priceB = parsePrice(b.fiyat);
      
      if (sort === "desc") {
        return priceB - priceA;
      }
      return priceA - priceB;
    });
    
    // Pagination
    const pageSize = 4;
    const totalProducts = uniqueProducts.length;
    const totalPages = Math.ceil(totalProducts / pageSize) || 1;
    const currentPage = Math.min(Math.max(1, parseInt(page)), totalPages);
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = uniqueProducts.slice(startIndex, endIndex);
    
    console.log(`✅ "${query}" için ${totalProducts} ürün bulundu`);
    
    res.json({
      success: true,
      query: query,
      toplamUrun: totalProducts,
      sayfa: currentPage,
      toplamSayfa: totalPages,
      siralama: sort,
      fiyatlar: paginatedProducts,
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

// --- AI Yorum API (GELİŞTİRİLMİŞ) ---
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { urun, fiyatlar = [] } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün adı gerekli (en az 2 karakter)" 
      });
    }
    
    console.log(`🤖 AI yorum isteği: "${urun}"`);
    
    // Eğer Gemini API key yoksa, daha iyi bir fallback mesajı gönder
    if (!geminiAI) {
      console.warn("⚠️ Gemini API key eksik! Fallback mesaj gönderiliyor.");
      
      // Fiyat analizi yap
      const prices = fiyatlar
        .map(f => {
          const priceStr = f.fiyat || f.price || "";
          const match = priceStr.match(/(\d+(?:[.,]\d+)*)/);
          if (!match) return null;
          return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
        })
        .filter(p => p !== null && !isNaN(p));
      
      const priceStats = {
        enUcuzFiyat: prices.length > 0 ? `${Math.min(...prices).toFixed(2)} TL` : "Bilinmiyor",
        enPahaliFiyat: prices.length > 0 ? `${Math.max(...prices).toFixed(2)} TL` : "Bilinmiyor",
        ortalamaFiyat: prices.length > 0 ? `${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)} TL` : "Bilinmiyor",
        fiyatSayisi: prices.length
      };
      
      // Fallback yorum (her ürüne özel olmayan ama fiyatlara göre değişen)
      let fallbackYorum = "";
      
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceDiff = ((maxPrice - minPrice) / minPrice) * 100;
        
        if (priceDiff > 50) {
          fallbackYorum = `⚠️ Bu üründe fiyat farkı çok yüksek (%${priceDiff.toFixed(0)}). En ucuz seçeneği tercih etmek mantıklı olabilir. Ürün fiyatları ${minPrice.toFixed(2)} TL ile ${maxPrice.toFixed(2)} TL arasında değişiyor.`;
        } else if (priceDiff > 20) {
          fallbackYorum = `📊 Ürün fiyatları ${minPrice.toFixed(2)} TL ile ${maxPrice.toFixed(2)} TL arasında. Fiyat farkı %${priceDiff.toFixed(0)} civarında. Güvenilir satıcılardan alışveriş yapmayı unutmayın.`;
        } else {
          fallbackYorum = `✅ Fiyatlar birbirine yakın (${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} TL). En uygun fiyatlı seçeneği tercih edebilirsiniz.`;
        }
      } else {
        fallbackYorum = `📱 "${urun}" ürünü için fiyat bilgisi bulunamadı. Ürünü satın almadan önce farklı sitelerde fiyat karşılaştırması yapmanızı öneririm.`;
      }
      
      return res.json({
        success: true,
        aiYorum: fallbackYorum,
        yorum: fallbackYorum,
        detay: priceStats,
        urun: urun,
        not: "AI servisi aktif değil. GEMINI_API_KEY environment variable ekleyin."
      });
    }
    
    // GEMINI AI AKTİFSE
    try {
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
      
      // Fiyat listesi metni
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
      
      // AI için prompt (daha detaylı ve spesifik)
      const prompt = `
      SEN BİR ALIŞVERİŞ DANIŞMANISIN. Kullanıcı şu ürün hakkında yorum istiyor: "${urun}"
      
      ${fiyatMetni}
      
      FİYAT İSTATİSTİKLERİ:
      - En düşük fiyat: ${priceDetails.enUcuzFiyat}
      - En yüksek fiyat: ${priceDetails.enPahaliFiyat}
      - Ortalama fiyat: ${priceDetails.ortalamaFiyat}
      - Fiyat sayısı: ${priceDetails.fiyatSayisi}
      
      LÜTFEN ŞUNLARI YAP:
      1. Bu ürünün genel değerlendirmesini yap (kalite, popülerlik, bilinirlik)
      2. Mevcut fiyatları analiz et (uygun mu, pahalı mı?)
      3. Fiyat/performans oranını 1-10 arası puanla
      4. Bu ürün KİMLER İÇİN UYGUN? (örneğin: bütçe dostu arayanlar, yüksek performans isteyenler vb.)
      5. Alışveriş tavsiyesi ver (ŞİMDİ AL, BEKLE, ALTERNATİF ARA)
      
      KURALLAR:
      - 5-6 cümle, kısa ve öz ol
      - Türkçe karakter kullan (ğ, ü, ş, ö, ç, ı)
      - Samimi ve yardımcı bir dil kullan
      - "Fiyatlar karşılaştırıldı", "en uygun seçeneği tercih edin" gibi klişe cümleler KULLANMA
      - Her ürün için farklı ve özgün bir yorum yap
      - Rakamlarla destekle (fiyat farkı yüzdesi, ortalama vs.)
      
      CEVAP FORMATI:
      [Değerlendirme] [Fiyat Analizi] [Puan] [Kime Uygun] [Tavsiye]
      `;
      
      console.log(`📝 AI Prompt hazır (${prompt.length} karakter)`);
      
      const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const aiResponse = await result.response.text();
      
      console.log(`✅ AI yanıtı alındı: ${aiResponse.substring(0, 100)}...`);
      
      res.json({
        success: true,
        aiYorum: aiResponse.trim(),
        yorum: aiResponse.trim(),
        detay: priceDetails,
        urun: urun
      });
      
    } catch (aiError) {
      console.error("Gemini AI hatası:", aiError);
      
      // AI hatası durumunda fallback
      const fallbackMsg = `🤖 "${urun}" ürünü için AI değerlendirmesi şu anda geçici olarak kullanılamıyor. Fiyat karşılaştırması yaparak en uygun seçeneği bulabilirsiniz. Mevcut fiyatlar: ${priceDetails.enUcuzFiyat} - ${priceDetails.enPahaliFiyat} arasında değişiyor.`;
      
      res.json({
        success: true,
        aiYorum: fallbackMsg,
        yorum: fallbackMsg,
        detay: priceDetails,
        urun: urun,
        aiError: aiError.message
      });
    }
    
  } catch (error) {
    console.error("AI yorum API hatası:", error);
    
    res.status(500).json({
      success: false,
      error: "AI yorum servisinde hata",
      detail: error.message
    });
  }
});

// --- KAMERA AI (GELİŞTİRİLMİŞ) ---
app.post("/api/kamera-ai", async (req, res) => {
  try {
    const { image, mime = "image/jpeg" } = req.body;
    
    if (!image) {
      return res.status(400).json({ 
        success: false, 
        error: "Görsel verisi gerekli (base64 formatında)" 
      });
    }
    
    console.log(`📸 Kamera AI isteği (görsel boyutu: ${image.length} karakter)`);
    
    // Eğer Gemini API key yoksa
    if (!geminiAI) {
      console.warn("⚠️ Gemini API key eksik! Kamera AI çalışmıyor.");
      
      return res.json({
        success: true,
        urunTahmini: "elektronik cihaz",
        tespitEdilen: "Ürün tespit edildi",
        aciklama: "AI görsel analiz servisi aktif değil. Lütfen ürün adını manuel yazın.",
        not: "GEMINI_API_KEY environment variable ekleyin."
      });
    }
    
    // GEMINI AI AKTİFSE
    try {
      const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const imageParts = [{
        inlineData: {
          data: image,
          mimeType: mime
        }
      }];
      
      // DAHA İYİ prompt
      const prompt = `
      Bu fotoğraftaki ürünü TAM OLARAK tanımla. 
      
      LÜTFEN:
      1. Ürünün TAM ADINI yaz (marka + model + tip)
      2. Rengini belirt
      3. Tahmini kategorisini yaz (elektronik, giyim, ev eşyası, kitap, vs.)
      4. Göze çarpan özelliklerini listele
      
      ÖRNEK ÇIKTILAR:
      - "iPhone 15 Pro Max - Siyah - Akıllı Telefon - 256GB"
      - "Nike Air Force 1 - Beyaz - Spor Ayakkabı - Deri"
      - "Samsung QLED 55 inç TV - Siyah - Televizyon - 4K"
      - "Kitap - Savaş ve Barış - Roman - Ciltli"
      
      SADECE ürün bilgilerini ver, başka açıklama yapma.
      Türkçe cevap ver.
      `;
      
      console.log("📝 Kamera AI prompt gönderiliyor...");
      
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response.text();
      
      console.log(`✅ Kamera AI yanıtı: ${response.substring(0, 150)}...`);
      
      // Yanıtı parse et
      const lines = response.split('\n').filter(line => line.trim().length > 0);
      let urunTahmini = "ürün";
      let kategori = "elektronik";
      
      if (lines.length > 0) {
        // İlk satırı al
        urunTahmini = lines[0].trim();
        
        // "telefon" yerine daha spesifik tahminler yap
        if (urunTahmini.toLowerCase().includes('iphone') || 
            urunTahmini.toLowerCase().includes('samsung') ||
            urunTahmini.toLowerCase().includes('xiaomi') ||
            urunTahmini.toLowerCase().includes('huawei') ||
            urunTahmini.toLowerCase().includes('telefon')) {
          kategori = "telefon";
        } else if (urunTahmini.toLowerCase().includes('ayakkabı') || 
                   urunTahmini.toLowerCase().includes('nike') || 
                   urunTahmini.toLowerCase().includes('adidas')) {
          kategori = "ayakkabı";
        } else if (urunTahmini.toLowerCase().includes('kitap')) {
          kategori = "kitap";
        } else if (urunTahmini.toLowerCase().includes('tv') || 
                   urunTahmini.toLowerCase().includes('televizyon')) {
          kategori = "televizyon";
        } else if (urunTahmini.toLowerCase().includes('laptop') || 
                   urunTahmini.toLowerCase().includes('bilgisayar')) {
          kategori = "bilgisayar";
        }
        
        // Arama için optimize et
        const searchQuery = urunTahmini
          .replace(/[^a-zA-Z0-9ğüşöçıĞÜŞÖÇİ\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 50);
        
        res.json({
          success: true,
          urunTahmini: searchQuery || "elektronik ürün",
          tespitEdilen: urunTahmini,
          kategori: kategori,
          aciklama: response.substring(0, 200),
          aiAnaliz: response.substring(0, 300),
          not: "Ürün AI tarafından tespit edildi. Arama yapmak için 'Ara' butonuna tıklayın."
        });
        
      } else {
        throw new Error("AI boş yanıt verdi");
      }
      
    } catch (aiError) {
      console.error("Gemini Vision hatası:", aiError);
      
      res.json({
        success: true,
        urunTahmini: "elektronik ürün",
        tespitEdilen: "Ürün tespit edilemedi",
        aciklama: "Görsel analiz başarısız oldu. Lütfen ürün adını manuel yazın.",
        aiError: aiError.message
      });
    }
    
  } catch (error) {
    console.error("Kamera AI API hatası:", error);
    
    res.status(500).json({
      success: false,
      error: "Kamera AI servisinde hata",
      detail: error.message
    });
  }
});

// --- Backward compatibility ---
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

// --- Server start ---
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API çalışıyor: http://localhost:${PORT}`);
  console.log(`🤖 AI Durumu: ${geminiAI ? "✅ AKTİF" : "❌ PASİF (GEMINI_API_KEY eksik)"}`);
  console.log(`📊 Endpoints: /health, /api/fiyat-cek, /api/ai-yorum, /api/kamera-ai`);
});
