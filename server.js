// server.js - TAM VE ÇALIŞAN VERSİYON
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

console.log("🚀 FiyatTakip API başlatılıyor...");

// ==================== YARDIMCI FONKSİYONLAR ====================

// SİTE ADINI AL
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

// ARAMA KELİMESİNİ ÇIKAR
function extractSearchQuery(url) {
  try {
    if (!url) return "ürün";
    if (url.includes('trendyol.com')) {
      const match = url.match(/q=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : "ürün";
    }
    if (url.includes('hepsiburada.com')) {
      const match = url.match(/q=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : "ürün";
    }
    if (url.includes('n11.com')) {
      const match = url.match(/q=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : "ürün";
    }
    if (url.includes('amazon.com.tr')) {
      const match = url.match(/k=([^&]+)/) || url.match(/q=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : "ürün";
    }
    return "ürün";
  } catch {
    return "ürün";
  }
}

// ÜRÜN TİPİNE GÖRE TAVSİYE
function getProductTypeAdvice(searchQuery) {
  const query = (searchQuery || "").toLowerCase();
  
  if (query.includes('iphone') || query.includes('telefon') || query.includes('samsung')) {
    return {
      type: "Telefon",
      tips: [
        "Depolama kapasitesi (128GB/256GB)",
        "Kamera kalitesi ve video özellikleri",
        "Batarya ömrü ve şarj hızı",
        "İşlemci ve RAM performansı",
        "Ekran teknolojisi (OLED/AMOLED)"
      ]
    };
  }
  else if (query.includes('laptop') || query.includes('notebook') || query.includes('bilgisayar')) {
    return {
      type: "Laptop",
      tips: [
        "İşlemci (Intel i5/i7 veya AMD Ryzen)",
        "RAM (en az 8GB, tercihen 16GB)",
        "Depolama (SSD tercih edin)",
        "Ekran çözünürlüğü ve renk kalitesi",
        "Grafik kartı performansı"
      ]
    };
  }
  else if (query.includes('tablet') || query.includes('ipad')) {
    return {
      type: "Tablet",
      tips: [
        "Ekran boyutu ve çözünürlüğü",
        "Kalem (stylus) desteği",
        "İşlemci ve multitasking performansı",
        "Batarya ömrü",
        "Bağlantı seçenekleri"
      ]
    };
  }
  else if (query.includes('ram') || query.includes('bellek') || query.includes('soğutucu')) {
    return {
      type: "Bilgisayar Bileşeni",
      tips: [
        "Marka güvenilirliği",
        "Uyumluluk (DDR4/DDR5, MHz hızı)",
        "Soğutma performansı",
        "Garanti süresi",
        "Fiyat/performans oranı"
      ]
    };
  }
  else if (query.includes('süpürge') || query.includes('robot')) {
    return {
      type: "Robot Süpürge",
      tips: [
        "Emiş gücü (Pa değeri)",
        "Batarya ömrü ve otonomi",
        "Akıllı haritalama özelliği",
        "Ses seviyesi",
        "Toz haznesi kapasitesi"
      ]
    };
  }
  else if (query.includes('tv') || query.includes('televizyon')) {
    return {
      type: "Televizyon",
      tips: [
        "Ekran boyutu ve çözünürlüğü (4K/8K)",
        "Panel teknolojisi (QLED/OLED)",
        "Smart TV özellikleri",
        "Ses sistemi kalitesi",
        "HDMI ve bağlantı portları"
      ]
    };
  }
  else if (query.includes('kulaklık') || query.includes('headphone')) {
    return {
      type: "Kulaklık",
      tips: [
        "Ses kalitesi ve bass performansı",
        "Gürültü önleme (ANC) özelliği",
        "Kablosuz bağlantı ve batarya",
        "Konfor ve ergonomi",
        "Suya dayanıklılık"
      ]
    };
  }
  else {
    return {
      type: "Genel Ürün",
      tips: [
        "Teknik özellikleri detaylı inceleyin",
        "Kullanıcı yorumlarını ve puanlarını okuyun",
        "Marka güvenilirliğini araştırın",
        "Garanti ve iade koşullarını kontrol edin"
      ]
    };
  }
}

// SİTE ÖZELLİKLERİ
function getSiteFeatures(siteName) {
  const features = {
    "Trendyol": {
      reputation: "Çok güvenilir",
      features: ["Hızlı kargo", "Kolay iade", "Geniş ürün yelpazesi", "Trendyol Express"],
      advice: "Trendyol'da satıcı puanlarına ve yorumlara dikkat edin."
    },
    "Hepsiburada": {
      reputation: "Güvenilir",
      features: ["Çok satıcılı", "HepsiExpress", "Kampanyalar", "Puanlama sistemi"],
      advice: "Hepsiburada'da satıcı değerlendirmelerini kontrol edin."
    },
    "n11": {
      reputation: "Orta güvenilirlik",
      features: ["Süper Fırsatlar", "Mağaza puanları", "Kampanyalar"],
      advice: "n11'de mağaza güvenilirliğini araştırın."
    },
    "Amazon": {
      reputation: "Uluslararası güvenilir",
      features: ["Prime üyelik", "Global ürünler", "Hızlı kargo", "Amazon garantisi"],
      advice: "Amazon'da Prime üyeliği avantajlarından yararlanın."
    }
  };
  
  return features[siteName] || {
    reputation: "Güvenilir",
    features: ["Standart alışveriş"],
    advice: "Site güvenilirliğini kontrol edin."
  };
}

// ==================== API ENDPOINT'LER ====================

// 1. HEALTH CHECK
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "FiyatTakip AI API",
    version: "2.0",
    status: "çalışıyor",
    endpoints: {
      health: "GET /health",
      fiyatCek: "POST /api/fiyat-cek",
      aiYorum: "POST /api/ai-yorum",
      geminiProxy: "POST /api/gemini-proxy"
    },
    note: "Ürün tipi analizi ve site özellikleri entegre"
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// 2. GEMINI PROXY ENDPOINT
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
        maxOutputTokens: 400
      }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    
    const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı";
    
    res.json({
      success: true,
      response: aiResponse
    });
    
  } catch (error) {
    console.error("❌ Proxy hatası:", error.message);
    
    let errorMsg = "AI servisi geçici olarak kullanılamıyor";
    if (error.response?.status === 403) errorMsg = "API Key geçersiz veya kota doldu";
    if (error.response?.status === 404) errorMsg = "API endpoint bulunamadı";
    
    res.status(500).json({
      success: false,
      error: errorMsg,
      details: error.message
    });
  }
});

// 3. ANA AI YORUM ENDPOINT (GELİŞMİŞ)
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { urun, link, apiKey } = req.body;
    
    console.log(`📥 AI isteği: ${urun} - ${link?.substring(0, 50)}...`);
    
    if (!urun || !link) {
      return res.status(400).json({
        success: false,
        error: "Ürün adı ve linki gerekli"
      });
    }
    
    // ANALİZ YAP
    const siteName = getSiteName(link);
    const searchQuery = extractSearchQuery(link) || urun;
    const productAdvice = getProductTypeAdvice(searchQuery);
    const siteFeatures = getSiteFeatures(siteName);
    
    console.log("📊 Analiz:", {
      site: siteName,
      query: searchQuery,
      type: productAdvice.type
    });
    
    // API KEY YOKSA YEREL TAVSİYE
    if (!apiKey) {
      const localAdvice = generateLocalAdvice(urun, siteName, siteFeatures, productAdvice);
      
      return res.json({
        success: true,
        aiYorum: localAdvice,
        yorum: localAdvice,
        analysis: {
          site: siteName,
          productType: productAdvice.type,
          searchQuery: searchQuery
        },
        isRealAI: false,
        note: "API Key yok - Yerel tavsiye"
      });
    }
    
    // GELİŞMİŞ PROMPT OLUŞTUR
    const prompt = `
    "${urun}" ürünü hakkında 4-6 cümlelik alışveriş tavsiyesi ver.
    
    DETAYLI BİLGİLER:
    - Ürün: ${urun}
    - Arama Kelimesi: "${searchQuery}"
    - Site: ${siteName}
    - Site Güvenilirliği: ${siteFeatures.reputation}
    - Site Özellikleri: ${siteFeatures.features.join(', ')}
    - Ürün Tipi: ${productAdvice.type}
    
    ÜRÜN İÇİN ÖNEMLİ NOKTALAR:
    ${productAdvice.tips.map(tip => `• ${tip}`).join('\n')}
    
    SİTE TAVSİYESİ:
    ${siteFeatures.advice}
    
    İSTENEN FORMAT:
    1. ${siteName} sitesi hakkında kısa bilgi
    2. ${productAdvice.type} alırken dikkat edilmesi gereken 2-3 ana nokta
    3. Fiyat karşılaştırması için öneri
    4. Genel alışveriş tavsiyesi
    
    KURALLAR:
    • Sadece 4-6 cümle
    • Türkçe ve anlaşılır
    • Pratik tavsiyeler
    • Numara veya madde işareti kullanma
    `.trim();
    
    // GEMINI API ÇAĞRISI
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 350
      }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 12000
    });
    
    const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı";
    
    res.json({
      success: true,
      aiYorum: aiResponse,
      yorum: aiResponse,
      analysis: {
        site: siteName,
        productType: productAdvice.type,
        searchQuery: searchQuery,
        features: siteFeatures.features
      },
      isRealAI: true,
      model: "gemini-1.5-flash"
    });
    
  } catch (error) {
    console.error("💥 AI hatası:", error.message);
    
    // HATA DURUMUNDA YEREL TAVSİYE
    const siteName = getSiteName(req.body.link);
    const searchQuery = extractSearchQuery(req.body.link) || req.body.urun;
    const productAdvice = getProductTypeAdvice(searchQuery);
    const siteFeatures = getSiteFeatures(siteName);
    
    const localAdvice = generateLocalAdvice(
      req.body.urun || "Ürün",
      siteName,
      siteFeatures,
      productAdvice
    );
    
    res.json({
      success: true,
      aiYorum: localAdvice,
      yorum: localAdvice,
      analysis: {
        site: siteName,
        productType: productAdvice.type,
        searchQuery: searchQuery
      },
      isFallback: true,
      error: error.message
    });
  }
});

// YEREL TAVSİYE OLUŞTUR
function generateLocalAdvice(urun, siteName, siteFeatures, productAdvice) {
  let advice = `"${urun}" ürünü için tavsiyeler:\n\n`;
  
  advice += `📍 ${siteName}: ${siteFeatures.reputation}\n`;
  advice += `📱 Ürün Tipi: ${productAdvice.type}\n\n`;
  
  advice += `💡 Önemli Noktalar:\n`;
  productAdvice.tips.slice(0, 3).forEach(tip => {
    advice += `• ${tip}\n`;
  });
  
  advice += `\n🏪 Site Özellikleri: ${siteFeatures.features.slice(0, 2).join(', ')}\n`;
  advice += `🔍 ${siteFeatures.advice}\n`;
  advice += `💰 Fiyat karşılaştırması için diğer siteleri de kontrol edin.`;
  
  return advice;
}

// 4. FİYAT ÇEKME (TEST)
app.post("/api/fiyat-cek", (req, res) => {
  const { urun } = req.body;
  const query = urun || "ürün";
  
  const products = [
    {
      site: "Trendyol",
      urun: `${query} - Model A`,
      fiyat: "1.299 TL",
      link: `https://www.trendyol.com/${query.replace(/\s/g, '-')}-p-123456`
    },
    {
      site: "Hepsiburada",
      urun: `${query} - Model B`,
      fiyat: "1.199 TL",
      link: `https://www.hepsiburada.com/${query.replace(/\s/g, '-')}-p-HBCV00001`
    },
    {
      site: "n11",
      urun: `${query} - Model C`,
      fiyat: "1.399 TL",
      link: `https://www.n11.com/urun/${query.replace(/\s/g, '-')}-123456`
    },
    {
      site: "Amazon",
      urun: `${query} - Model D`,
      fiyat: "1.499 TL",
      link: `https://www.amazon.com.tr/dp/ABCDEFGHIJ`
    }
  ];
  
  res.json({
    success: true,
    query: query,
    toplamUrun: products.length,
    fiyatlar: products,
    note: "Test verileri - gerçek scraping yapılmıyor"
  });
});

// 5. ANALİZ TEST ENDPOINT
app.post("/api/analyze", (req, res) => {
  const { link, urun } = req.body;
  
  const siteName = getSiteName(link);
  const searchQuery = extractSearchQuery(link) || urun;
  const productAdvice = getProductTypeAdvice(searchQuery);
  const siteFeatures = getSiteFeatures(siteName);
  
  res.json({
    success: true,
    link: link,
    analysis: {
      site: siteName,
      searchQuery: searchQuery,
      productType: productAdvice.type,
      siteReputation: siteFeatures.reputation,
      siteFeatures: siteFeatures.features,
      productTips: productAdvice.tips
    }
  });
});

// ==================== SUNUCU ====================
app.listen(PORT, () => {
  console.log(`
✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
🚀 GELİŞMİŞ AI API ÇALIŞIYOR!
📡 Port: ${PORT}
🌐 URL: https://fiyattakip-api.onrender.com
🤖 Özellikler:
   • Ürün tipi analizi
   • Site özellikleri
   • Akıllı prompt oluşturma
   • Yerel fallback sistemi
✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
  `);
  console.log("✅ Backend hazır! Frontend'den test edebilirsiniz.");
});
