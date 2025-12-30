// server.js - KESİN ÇALIŞAN VERSİYON
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

console.log("🚀 FiyatTakip API başlatılıyor...");

// ==================== TEST VERİSİ ====================
function getTestProducts(query) {
  return [
    {
      site: "Trendyol",
      urun: `${query} - Apple iPhone 13 128GB Mavi`,
      fiyat: "24.999 TL",
      link: "https://www.trendyol.com/apple/iphone-13-128gb-mavi-p-123456",
      image: "https://cdn.dummyjson.com/product-images/1/thumbnail.jpg"
    },
    {
      site: "Trendyol", 
      urun: `${query} - Samsung Galaxy S23 Ultra 256GB`,
      fiyat: "34.999 TL",
      link: "https://www.trendyol.com/samsung/galaxy-s23-ultra-256gb-p-789012",
      image: "https://cdn.dummyjson.com/product-images/2/thumbnail.jpg"
    },
    {
      site: "Hepsiburada",
      urun: `${query} - iPhone 13 128GB Midnight`,
      fiyat: "25.499 TL",
      link: "https://www.hepsiburada.com/apple-iphone-13-128gb-midnight-p-HBCV00000ABCDE",
      image: "https://cdn.dummyjson.com/product-images/3/thumbnail.jpg"
    },
    {
      site: "Hepsiburada",
      urun: `${query} - iPhone 13 Pro 256GB`,
      fiyat: "32.999 TL",
      link: "https://www.hepsiburada.com/apple-iphone-13-pro-256gb-p-HBCV00000FGHIJ",
      image: "https://cdn.dummyjson.com/product-images/4/thumbnail.jpg"
    }
  ];
}

// ==================== AI YORUM ====================
function getAIComment(urun, link) {
  console.log(`🤖 AI yorum: ${urun.substring(0, 30)}...`);
  
  const site = getSiteName(link);
  const lowerUrun = urun.toLowerCase();
  
  let tavsiye = `"${urun}" ürünü hakkında:\n\n`;
  
  // Site özellikleri
  if (site === "Trendyol") {
    tavsiye += `• Trendyol'dan alışveriş yapıyorsunuz. Hızlı kargo ve kolay iade seçenekleri mevcut.\n`;
  } else if (site === "Hepsiburada") {
    tavsiye += `• Hepsiburada güvenilir bir platform. HepsiExpress ile aynı gün teslimat alabilirsiniz.\n`;
  } else if (site === "Amazon") {
    tavsiye += `• Amazon'dan alışveriş yapıyorsunuz. Prime üyeliği ile ücretsiz kargo avantajı var.\n`;
  } else {
    tavsiye += `• ${site} sitesi güvenilir bir alışveriş platformudur.\n`;
  }
  
  // Ürün tipine göre tavsiye
  if (lowerUrun.includes('ram') || lowerUrun.includes('bellek') || lowerUrun.includes('soğutucu')) {
    tavsiye += `• RAM soğutucular bilgisayar performansını artırır ve bileşen ömrünü uzatır.\n`;
    tavsiye += `• Marka ve uyumluluk konusuna dikkat edin.\n`;
  } else if (lowerUrun.includes('telefon') || lowerUrun.includes('iphone')) {
    tavsiye += `• Telefon alırken depolama kapasitesi (128GB/256GB) önemli bir kriter.\n`;
    tavsiye += `• Kamera kalitesi ve batarya ömrüne dikkat edin.\n`;
  } else if (lowerUrun.includes('laptop') || lowerUrun.includes('notebook')) {
    tavsiye += `• Laptop seçerken işlemci, RAM ve ekran kalitesi performansı belirler.\n`;
    tavsiye += `• SSD depolama tercih edin, daha hızlıdır.\n`;
  } else {
    tavsiye += `• Ürünün teknik özelliklerini detaylı inceleyin.\n`;
    tavsiye += `• Diğer kullanıcıların yorumlarını mutlaka okuyun.\n`;
  }
  
  tavsiye += `• Farklı sitelerde fiyat karşılaştırması yaparak en uygun fiyatı bulun.`;
  
  return tavsiye;
}

function getSiteName(url) {
  if (!url) return "Bilinmeyen Site";
  if (url.includes('trendyol.com')) return 'Trendyol';
  if (url.includes('hepsiburada.com')) return 'Hepsiburada';
  if (url.includes('n11.com')) return 'n11';
  if (url.includes('amazon.com.tr')) return 'Amazon';
  if (url.includes('pazarama.com')) return 'Pazarama';
  return 'Diğer Site';
}

// ==================== API ENDPOINT'LER ====================
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "FiyatTakip API",
    version: "3.0",
    status: "çalışıyor",
    endpoints: {
      fiyatCek: "POST /api/fiyat-cek",
      aiYorum: "POST /api/ai-yorum",
      health: "GET /health"
    },
    note: "Test modunda çalışıyor"
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 1. FIYAT ÇEKME
app.post("/api/fiyat-cek", (req, res) => {
  try {
    const { urun } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün adı gerekli (en az 2 karakter)" 
      });
    }
    
    const query = urun.trim();
    console.log(`✅ Fiyat isteği: "${query}"`);
    
    const products = getTestProducts(query);
    
    res.json({
      success: true,
      query: query,
      toplamUrun: products.length,
      fiyatlar: products,
      note: "Test verileri gösteriliyor"
    });
    
  } catch (error) {
    console.error("Hata:", error);
    res.json({
      success: true,
      query: req.body.urun || "bilinmeyen",
      toplamUrun: 4,
      fiyatlar: getTestProducts("ürün"),
      isError: true
    });
  }
});

// 2. AI YORUM
app.post("/api/ai-yorum", (req, res) => {
  try {
    console.log("📨 AI isteği alındı");
    
    // Frontend'den gelen veriler
    const { 
      urun,        // asıl isim
      link,        // asıl link
      urunAdi,     // alternatif
      urunLink,    // alternatif
      apiKey       // opsiyonel
    } = req.body;
    
    console.log("📊 Gelen veri:", { 
      urun: urun || urunAdi,
      link: link || urunLink,
      hasApiKey: !!apiKey 
    });
    
    // İsim ve linki al (eski ve yeni format desteği)
    const productName = urun || urunAdi || "Ürün";
    const productLink = link || urunLink || "https://example.com";
    
    if (!productName || !productLink) {
      return res.status(400).json({
        success: false,
        error: "Ürün bilgisi eksik",
        received: req.body
      });
    }
    
    console.log(`🤖 AI analiz ediyor: ${productName.substring(0, 50)}...`);
    
    // AI yorumunu oluştur
    const aiYorum = getAIComment(productName, productLink);
    
    console.log("✅ AI yanıtı hazır");
    
    res.json({
      success: true,
      aiYorum: aiYorum,
      yorum: aiYorum,
      urun: productName,
      link: productLink,
      site: getSiteName(productLink),
      isRealAI: false, // Test modu
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("💥 AI hatası:", error);
    
    res.json({
      success: true,
      aiYorum: `"${req.body.urun || 'Ürün'}" için AI analizi şu an yapılamıyor.`,
      yorum: `"${req.body.urun || 'Ürün'}" için AI analizi şu an yapılamıyor.`,
      isFallback: true
    });
  }
});

// 3. Eski endpoint'ler için yönlendirme
app.post("/fiyat-cek", (req, res) => {
  console.log("🔄 /fiyat-cek -> /api/fiyat-cek yönlendiriliyor");
  req.url = "/api/fiyat-cek";
  app.handle(req, res);
});

app.post("/ai-yorum", (req, res) => {
  console.log("🔄 /ai-yorum -> /api/ai-yorum yönlendiriliyor");
  req.url = "/api/ai-yorum";
  app.handle(req, res);
});

// 4. 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint bulunamadı",
    available: ["GET /", "GET /health", "POST /api/fiyat-cek", "POST /api/ai-yorum"]
  });
});

// ==================== SUNUCUYU BAŞLAT ====================
app.listen(PORT, () => {
  console.log(`
✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
🚀 FIYATTAKİP API ÇALIŞIYOR!
📡 Port: ${PORT}
🌐 URL: https://fiyattakip-api.onrender.com
✅ Durum: HAZIR
✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
`);
  console.log("🎯 Frontend'den hemen test edebilirsiniz!");
});
