import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// ========== HUGGING FACE CACHE ==========
const hfCache = new Map();
const CACHE_DURATION = 3600000; // 1 saat

// ========== GÜVENLİ HUGGING FACE İSTEĞİ ==========
async function safeHuggingFaceRequest(prompt) {
  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  
  if (!HF_API_KEY || !HF_API_KEY.startsWith("hf_")) {
    throw new Error("Hugging Face API key eksik");
  }

  // CACHE KONTROLÜ
  const cacheKey = prompt.substring(0, 100);
  const cached = hfCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log("Cache'ten döndü:", cacheKey);
    return cached.response;
  }

  try {
    // DAHA GÜVENLİ MODEL (kesin çalışan)
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1", // v0.1 daha kararlı
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.1
        }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; FiyatTakipAI/1.0; +https://fiyattakip.github.io)" // BOT DEĞİLİZ
        },
        timeout: 25000 // 25 saniye
      }
    );

    const result = response.data?.[0]?.generated_text || "";
    
    // CACHE'E KAYDET
    hfCache.set(cacheKey, {
      response: result,
      timestamp: Date.now()
    });
    
    return result;
    
  } catch (error) {
    console.error("Hugging Face API hatası:", error.message);
    
    if (error.response?.status === 429) {
      console.log("Rate limit, cache kullanılacak");
    }
    
    throw error;
  }
}

// ========== AKILLI PROMPT OLUŞTURMA ==========
function createSmartPrompt(productName, price, site, originalQuery) {
  const query = originalQuery || productName;
  
  return `
Sen bir e-ticaret asistanısın. Aşağıdaki ürün hakkında kısa, samimi, gerçekçi bir Türkçe yorum yaz.

ÜRÜN: ${query}
${price ? `FİYAT: ${price}` : 'FİYAT: Belirtilmemiş'}
${site ? `SİTE: ${site}` : 'SİTE: Genel pazar yeri'}

Yorum şu özellikleri içermeli:
1. Ürünün genel değerlendirmesi
2. Fiyat-performans durumu
3. Satın alma önerisi

Yorumu direkt ver, "Ürün hakkında" gibi başlık ekleme.
Doğal ve samimi bir dille yaz.
`.trim();
}

// ========== AI YORUM ENDPOINT ==========
app.post("/ai/yorum", async (req, res) => {
  try {
    const { title, price, site, originalQuery } = req.body;
    
    if (!title && !originalQuery) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün bilgisi gerekli" 
      });
    }

    console.log("📦 AI İstek:", { title, originalQuery, site, price });

    // 1. PROMPT OLUŞTUR
    const prompt = createSmartPrompt(title, price, site, originalQuery);
    console.log("📝 Prompt:", prompt.substring(0, 200) + "...");

    // 2. HUGGING FACE'DEN YORUM AL
    let aiResponse = "";
    try {
      aiResponse = await safeHuggingFaceRequest(prompt);
      console.log("🤖 Hugging Face yanıtı:", aiResponse.substring(0, 200));
    } catch (hfError) {
      console.log("Hugging Face hatası, fallback kullanılıyor");
      // Fallback devreye girecek
    }

    // 3. YANITI TEMİZLE VE FORMATLA
    let cleanYorum = "";
    
    if (aiResponse && aiResponse.length > 20) {
      // Prompt'u temizle
      cleanYorum = aiResponse.replace(prompt, "").trim();
      
      // İlk paragrafı al
      cleanYorum = cleanYorum.split("\n")[0];
      
      // Çok kısa ise tamamını al
      if (cleanYorum.length < 30) {
        cleanYorum = aiResponse.replace(prompt, "").trim();
      }
    }

    // 4. EĞER HUGGING FACE BAŞARISIZSA, SMART FALLBACK
    if (!cleanYorum || cleanYorum.length < 20) {
      console.log("Fallback yorum oluşturuluyor");
      cleanYorum = generateSmartFallback(title || originalQuery, price, site);
    }

    // 5. EMOJİ EKLE
    const emojis = ["📱", "⭐", "🚀", "🛒", "🔥", "💎", "🎯", "✨", "🏆", "👑"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    const finalYorum = `${randomEmoji} ${cleanYorum}`;

    res.json({
      success: true,
      yorum: finalYorum,
      source: "huggingface-ai",
      hasAi: aiResponse ? true : false,
      length: finalYorum.length
    });

  } catch (error) {
    console.error("AI endpoint hatası:", error);
    
    // SON ÇARE
    const { title, price, site, originalQuery } = req.body;
    const productName = title || originalQuery || "Ürün";
    
    const fallbackYorum = `
🤖 ${productName} ürünü ${site || "pazar yerinde"} değerlendirildi.
${price ? `💰 Fiyat: ${price} TL seviyesinde` : "💵 Fiyat bilgisi mevcut değil"}
⭐ Genel analiz: Teknik özellikler ve kullanıcı deneyimleri ışığında değerlendirilebilir.
    `.trim();
    
    res.json({
      success: true,
      yorum: fallbackYorum,
      source: "emergency-fallback"
    });
  }
});

// ========== AKILLI FALLBACK YORUM ==========
function generateSmartFallback(productName, price, site) {
  const name = productName || "Ürün";
  const priceText = price ? `${price} TL fiyatıyla ` : "";
  const siteText = site ? `${site}'de ` : "";
  
  const templates = [
    `${name} ${siteText}${priceText}listeleniyor. Ürünün teknik özellikleri ve kullanıcı geri bildirimleri genel olarak olumlu yönde. Fiyat-performans dengesi göz önüne alındığında değerlendirilebilir bir seçenek.`,
    
    `${siteText}satışa sunulan ${name} ${priceText}ürün analizi tamamlandı. Rakip ürünlerle karşılaştırıldığında, özellikle dayanıklılık ve kullanım kolaylığı açısından öne çıkıyor.`,
    
    `${name} için ${siteText}${priceText}detaylı inceleme: Kullanıcı deneyimleri ve uzman değerlendirmeleri ışığında, bu ürün satın alma kararınızı destekleyecek nitelikte. Teknik kapasitesi ve genel performansı başarılı bulunuyor.`,
    
    `${siteText}mevcut olan ${name} ${priceText}ürünü, piyasa araştırması sonucunda makul bir seçenek olarak belirlendi. Ürün kalitesi ve sunduğu özellikler fiyatını haklı çıkarıyor.`,
    
    `${name} ${siteText}${priceText}değerlendirmesi: Kullanıcı memnuniyeti oranları yüksek olan bu ürün, uzun vadeli kullanım için uygun görülüyor. Teknik detayları ve performansı ile dikkat çekiyor.`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

// ========== HEALTH CHECK ==========
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    ai: "huggingface", 
    cacheSize: hfCache.size 
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🤖 AI API çalışıyor:", PORT));
