import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/ai/yorum", async (req, res) => {
  try {
    const { title, price, site } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: "Ürün başlığı yok" });
    }

    const yorum = `
${title} ürünü ${site || "pazar yerinde"} listelenmektedir.
${price ? `Yaklaşık fiyat: ${price} TL` : ""}
Genel olarak fiyat/performans açısından değerlendirilebilir.
    `.trim();

    res.json({ success: true, yorum });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, yorum: "AI yorumu alınamadı" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("API çalışıyor:", PORT));

// ========== AI YORUM ENDPOINT ==========
app.post('/ai/yorum', async (req, res) => {
  try {
    const { title, price, site } = req.body;
    
    // Site güvenilirlik kontrolü
    let siteTrust = "🔍 Araştırın";
    if (site) {
      const siteLower = site.toLowerCase();
      if (siteLower.includes('trendyol') || siteLower.includes('hepsiburada') || 
          siteLower.includes('amazon') || siteLower.includes('n11')) {
        siteTrust = "✅ Güvenilir";
      }
    }
    
    // Fiyat analizi
    let priceAnalysis = "";
    if (price) {
      const priceNum = parseFloat(price.replace(/[^\d.]/g, ''));
      if (!isNaN(priceNum)) {
        if (priceNum < 100) priceAnalysis = "🔥 Çok ucuz";
        else if (priceNum < 500) priceAnalysis = "💰 Uygun";
        else if (priceNum < 2000) priceAnalysis = "⚖️ Normal";
        else priceAnalysis = "💸 Pahalı";
      }
    }
    
    // Akıllı yorum
    const smartComment = `🤖 AKILLI ANALİZ

📦 Ürün: ${title || "Bilinmeyen ürün"}
🏪 Site: ${site || "Bilinmeyen site"} (${siteTrust})
${price ? `💰 Fiyat: ${price} ${priceAnalysis ? `(${priceAnalysis})` : ''}` : ''}

💡 TAVSİYELER:
• Ürünü 2-3 sitede karşılaştırın
• Satıcı yorumlarını mutlaka okuyun
• Kargo ve iade politikasına bakın
• Fiyat takip uygulamaları kullanın

${siteTrust === "✅ Güvenilir" ? "✅ Bu site güvenilirdir" : "⚠️ Siteyi araştırın"}`;

    res.json({ 
      success: true, 
      yorum: smartComment 
    });
    
  } catch (error) {
    console.error("AI yorum hatası:", error);
    res.json({ 
      success: true, 
      yorum: "🤖 Basit Analiz: Ürünü karşılaştırmanızı öneririm." 
    });
  }
});
// ========== SON ========== 
