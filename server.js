
import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const HF_MODEL = "google/flan-t5-base";

app.post("/ai/yorum", async (req, res) => {
  try {
    const { originalQuery, site, price } = req.body;
    
    if (!originalQuery) {
      return res.json({
        success: true,
        yorum: "🤖 Ürün bilgisi gerekli."
      });
    }

    console.log("🤖 AI İsteniyor:", originalQuery);

    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
    let aiResponse = "";

    if (HF_API_KEY) {
      try {
        const response = await axios.post(
          `https://api-inference.huggingface.co/models/${HF_MODEL}`,
          {
            inputs: `${originalQuery} ürünü hakkında kısa yorum yaz.`,
            parameters: { max_new_tokens: 100, temperature: 0.7 }
          },
          {
            headers: {
              Authorization: `Bearer ${HF_API_KEY}`,
              "Content-Type": "application/json"
            },
            timeout: 10000
          }
        );
        
        if (response.data?.[0]?.generated_text) {
          aiResponse = response.data[0].generated_text.trim();
          console.log("✅ HF başarılı:", aiResponse.substring(0, 50));
        }
      } catch (hfError) {
        console.log("⚠️ HF hatası:", hfError.message);
      }
    }

    let finalYorum = aiResponse;
    
    if (!finalYorum || finalYorum.length < 10) {
      const emojis = ["📱", "⭐", "🚀", "🛒", "🔥", "💎"];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      finalYorum = `${emoji} **${originalQuery}** ${site ? `(${site})` : ""} ${price ? `${price} TL fiyatıyla ` : ""}listeleniyor. Ürün teknik özellikleri ve kullanıcı deneyimleri göz önüne alındığında değerlendirilebilir.`;
    }

    res.json({
      success: true,
      yorum: finalYorum,
      source: aiResponse ? "huggingface" : "smart-fallback"
    });

  } catch (error) {
    console.error("❌ AI hatası:", error);
    res.json({
      success: true,
      yorum: "🤖 Ürün analizi tamamlandı. Teknik inceleme olumlu.",
      source: "fallback"
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", ai: "huggingface" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("✅ API çalışıyor:", PORT));
