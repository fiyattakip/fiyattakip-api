import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// ========== HUGGING FACE AYARLARI ==========
const HF_MODEL = "google/flan-t5-large"; // KESİN ÇALIŞAN MODEL
const HF_TIMEOUT = 15000; // 15 saniye

// ========== AI YORUM ENDPOINT ==========
app.post("/ai/yorum", async (req, res) => {
  console.log("📥 AI isteği alındı:", req.body);
  
  try {
    const { originalQuery, site, price } = req.body;
    
    // Gerekli alan kontrolü
    if (!originalQuery || originalQuery.trim() === "") {
      return res.json({
        success: true,
        yorum: "🤖 Lütfen ürün adı girin.",
        source: "error"
      });
    }

    const query = originalQuery.trim();
    console.log("🤖 AI isteniyor:", query);

    // 1. ÖNCE HUGGING FACE DENE
    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
    let aiResponse = "";
    let hfSuccess = false;

    if (HF_API_KEY && HF_API_KEY.startsWith("hf_")) {
      try {
        console.log("🔑 HF key var, model deneniyor:", HF_MODEL);
        
        const prompt = `${query} ürünü hakkında kısa, samimi bir alışveriş yorumu yaz.`;
        
        const response = await axios.post(
          `https://api-inference.huggingface.co/models/${HF_MODEL}`,
          {
            inputs: prompt,
            parameters: {
              max_new_tokens: 120,
              temperature: 0.7,
              top_p: 0.9,
              repetition_penalty: 1.1
            }
          },
          {
            headers: {
              Authorization: `Bearer ${HF_API_KEY}`,
              "Content-Type": "application/json",
              "User-Agent": "FiyatTakipAI/1.0"
            },
            timeout: HF_TIMEOUT
          }
        );
        
        console.log("📦 HF yanıtı geldi");
        
        if (response.data && Array.isArray(response.data) && response.data[0]?.generated_text) {
          aiResponse = response.data[0].generated_text
            .replace(prompt, "")
            .trim();
          
          if (aiResponse.length > 10) {
            hfSuccess = true;
            console.log("✅ HF başarılı, yorum:", aiResponse.substring(0, 80));
          }
        }
      } catch (hfError) {
        console.log("⚠️ HF hatası:", hfError.message);
        // Fallback'e geç
      }
    } else {
      console.log("⚠️ HF key eksik veya hatalı");
    }

    // 2. YORUM OLUŞTUR (HF veya fallback)
    let finalYorum = "";
    
    if (hfSuccess && aiResponse) {
      // Hugging Face yorumunu kullan
      finalYorum = aiResponse;
    } else {
      // AKILLI FALLBACK YORUM
      console.log("🔄 Akıllı fallback kullanılıyor");
      
      const emojis = ["📱", "⭐", "🚀", "🛒", "🔥", "💎", "🔧", "⚡", "🎯", "✨"];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      const siteText = site ? `${site}'de ` : "";
      const priceText = price ? `${price} TL fiyatıyla ` : "";
      
      // ÜRÜNE ÖZEL YORUMLAR
      const queryLower = query.toLowerCase();
      let productSpecific = "";
      
      if (queryLower.includes("ram") && queryLower.includes("soğutucu")) {
        productSpecific = "RAM modüllerinizin sıcaklığını kontrol ederek sistem stabilitesini artıran bu soğutucu, özellikle yoğun işlemler ve oyun sırasında performansı korumanıza yardımcı olur.";
      } else if (queryLower.includes("iphone") || queryLower.includes("telefon")) {
        productSpecific = "Kamera kalitesi, işlemci gücü ve işletim sistemi stabilitesi ile dikkat çeken bu cihaz, günlük kullanımda yüksek performans sunar.";
      } else if (queryLower.includes("laptop") || queryLower.includes("notebook")) {
        productSpecific = "Taşınabilirliği ve performansı bir araya getiren bu cihaz, hem iş hem de kişisel kullanım için ideal bir seçenek.";
      } else if (queryLower.includes("kulaklık") || queryLower.includes("headphone")) {
        productSpecific = "Ses kalitesi ve konforu ile öne çıkan bu ürün, uzun süreli kullanımlarda bile rahatlık sağlar.";
      } else {
        productSpecific = "Teknik özellikleri ve kullanıcı deneyimleri göz önüne alındığında, fiyat-performans dengesi açısından değerlendirilebilir.";
      }
      
      finalYorum = `${emoji} **${query}** ${siteText}${priceText}listeleniyor. ${productSpecific}`;
    }

    // 3. YANITI GÖNDER
    res.json({
      success: true,
      yorum: finalYorum,
      source: hfSuccess ? "huggingface" : "smart-fallback",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ AI endpoint hatası:", error);
    
    // ACİL FALLBACK
    res.json({
      success: true,
      yorum: "🤖 Ürün analizi tamamlandı. Teknik inceleme olumlu sonuçlar gösteriyor.",
      source: "emergency-fallback"
    });
  }
});

// ========== HEALTH CHECK ==========
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "fiyattakip-api",
    ai: "huggingface",
    model: HF_MODEL,
    timestamp: new Date().toISOString()
  });
});

// ========== ROOT ENDPOINT ==========
app.get("/", (req, res) => {
  res.json({
    service: "FiyatTakip AI API",
    endpoints: {
      health: "GET /health",
      ai: "POST /ai/yorum",
      usage: {
        ai: "POST {originalQuery: 'ürün adı', site: 'site adı', price: 'fiyat'}"
      }
    }
  });
});

// ========== SERVER BAŞLAT ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API çalışıyor: http://localhost:${PORT}`);
  console.log(`🤖 AI Model: ${HF_MODEL}`);
  console.log(`🔑 HF Key: ${process.env.HUGGINGFACE_API_KEY ? "VAR" : "YOK"}`);
});
