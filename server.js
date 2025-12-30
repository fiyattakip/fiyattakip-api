// server.js - KESİN ÇALIŞAN PROXY API
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

console.log("🚀 Proxy API başlatılıyor...");

// 1. HEALTH CHECK
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "FiyatTakip Proxy API",
    version: "1.0",
    status: "çalışıyor",
    note: "Bu API sadece proxy görevi görür"
  });
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "healthy" });
});

// 2. GEMINI PROXY - ANA ENDPOINT
app.post("/api/gemini-proxy", async (req, res) => {
  try {
    const { prompt, apiKey } = req.body;
    
    if (!prompt || !apiKey) {
      return res.status(400).json({
        success: false,
        error: "Prompt ve API Key gerekli"
      });
    }
    
    console.log("🤖 Gemini proxy isteği alındı");
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300
      }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı";
    
    res.json({
      success: true,
      response: aiResponse
    });
    
  } catch (error) {
    console.error("❌ Proxy hatası:", error.message);
    
    res.json({
      success: false,
      error: "AI servisi geçici olarak kullanılamıyor",
      message: error.message
    });
  }
});

// 3. ESKİ UYUMLULUK
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { urun, link, apiKey } = req.body;
    
    if (!urun || !link) {
      return res.status(400).json({
        success: false,
        error: "Ürün adı ve linki gerekli"
      });
    }
    
    const prompt = `
    "${urun}" ürünü hakkında 3-5 cümlelik alışveriş tavsiyesi ver.
    
    BİLGİLER:
    - Ürün: ${urun}
    - Link: ${link}
    - Site: ${getSiteName(link)}
    
    KURALLAR:
    1. Sadece 3-5 cümle olsun
    2. Türkçe ve net olsun
    3. Ürün tipine uygun tavsiyeler ver
    4. Site güvenilirliğinden bahset
    5. Fiyat karşılaştırması yapmayı öner
    
    ÖRNEK: "Bu ürün için tavsiyelerim: 1) Site güvenilir, 2) Ürün kaliteli, 3) Fiyat karşılaştırın"
    `;
    
    if (!apiKey) {
      // API key yoksa basit fallback
      return res.json({
        success: true,
        aiYorum: `"${urun}" için:\n\n• ${getSiteName(link)} güvenilir.\n• Ürün özelliklerini inceleyin.\n• Kullanıcı yorumlarını okuyun.`,
        yorum: `"${urun}" için:\n\n• ${getSiteName(link)} güvenilir.\n• Ürün özelliklerini inceleyin.\n• Kullanıcı yorumlarını okuyun.`,
        isFallback: true
      });
    }
    
    // Gemini'ye yönlendir
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200
      }
    }, {
      timeout: 10000
    });
    
    const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı";
    
    res.json({
      success: true,
      aiYorum: aiResponse,
      yorum: aiResponse,
      isRealAI: true
    });
    
  } catch (error) {
    console.error("AI hatası:", error.message);
    
    res.json({
      success: true,
      aiYorum: `"${req.body.urun || 'Ürün'}" için AI analizi şu an yapılamıyor.`,
      yorum: `"${req.body.urun || 'Ürün'}" için AI analizi şu an yapılamıyor.`,
      isFallback: true
    });
  }
});

// 4. FİYAT ÇEKME (TEST)
app.post("/api/fiyat-cek", (req, res) => {
  const { urun } = req.body;
  
  res.json({
    success: true,
    query: urun || "test",
    toplamUrun: 4,
    fiyatlar: [
      {
        site: "Trendyol",
        urun: `${urun || "Ürün"} - Test 1`,
        fiyat: "1.299 TL",
        link: "https://www.trendyol.com/test1"
      },
      {
        site: "Hepsiburada",
        urun: `${urun || "Ürün"} - Test 2`,
        fiyat: "1.199 TL",
        link: "https://www.hepsiburada.com/test2"
      },
      {
        site: "n11",
        urun: `${urun || "Ürün"} - Test 3`,
        fiyat: "1.399 TL",
        link: "https://www.n11.com/test3"
      },
      {
        site: "Amazon",
        urun: `${urun || "Ürün"} - Test 4`,
        fiyat: "1.499 TL",
        link: "https://www.amazon.com.tr/test4"
      }
    ]
  });
});

// YARDIMCI FONKSİYON
function getSiteName(url) {
  if (!url) return "Site";
  if (url.includes('trendyol.com')) return 'Trendyol';
  if (url.includes('hepsiburada.com')) return 'Hepsiburada';
  if (url.includes('n11.com')) return 'n11';
  if (url.includes('amazon.com.tr')) return 'Amazon';
  if (url.includes('pazarama.com')) return 'Pazarama';
  if (url.includes('ciceksepeti.com')) return 'ÇiçekSepeti';
  if (url.includes('idefix.com')) return 'İdefix';
  return 'Alışveriş Sitesi';
}

// SUNUCU
app.listen(PORT, () => {
  console.log(`
✅ PROXY API ÇALIŞIYOR
📡 Port: ${PORT}
🌐 URL: https://fiyattakip-api.onrender.com
🤖 Gemini Proxy: AKTİF
  `);
});
