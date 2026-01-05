import express from "express";
import cors from "cors";
import axios from "axios";  // <--- YENİ EKLENEN SATIR

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ========== HUGGING FACE AI YORUM ENDPOINT ==========
app.post("/ai/yorum", async (req, res) => {
  try {
    const { title, price, site } = req.body;

    if (!title) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün başlığı yok" 
      });
    }

    // Hugging Face API'si için prompt
    const prompt = `
    Ürün: ${title}
    ${price ? `Fiyat: ${price}` : "Fiyat bilgisi yok"}
    Site: ${site || "genel pazar yeri"}
    
    Bu ürün için kısa, samimi, gerçekçi bir alışveriş yorumu yaz.
    Yorum şu unsurları içersin:
    1. Ürünün genel değerlendirmesi
    2. Fiyat-performans durumu
    3. Satın alma önerisi (olumlu/olumsuz)
    
    Yorumu direkt olarak ver, başlık veya açıklama ekleme.
    `;

    // Hugging Face API çağrısı
    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
    
    if (!HF_API_KEY) {
      // API key yoksa fallback yorum
      const fallbackYorum = `
${title} ürünü ${site || "pazar yerinde"} listelenmektedir.
${price ? `Yaklaşık fiyat: ${price} TL` : ""}
Genel olarak fiyat/performans açısından değerlendirilebilir.
      `.trim();
      
      return res.json({
        success: true,
        yorum: fallbackYorum,
        note: "Hugging Face API key eksik, fallback yorum"
      });
    }

    // Daha hızlı bir model (Mistral-7B)
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.1
        }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000 // 30 saniye timeout
      }
    );

    let aiYorum = "";
    
    if (response.data && response.data[0]?.generated_text) {
      aiYorum = response.data[0].generated_text
        .replace(prompt, "") // Prompt'u temizle
        .trim()
        .split("\n")[0]; // İlk paragrafı al
    }

    // Eğer AI yorum boşsa, fallback yorum
    if (!aiYorum || aiYorum.length < 10) {
      aiYorum = `
${title} ürünü ${site || "pazar yerinde"} listelenmektedir.
${price ? `Yaklaşık fiyat: ${price} TL` : ""}
Genel olarak fiyat/performans açısından değerlendirilebilir.
      `.trim();
    }

    res.json({
      success: true,
      yorum: aiYorum,
      source: "huggingface"
    });

  } catch (error) {
    console.error("Hugging Face API hatası:", error.message);
    
    // Fallback: mevcut basit yorum
    const { title, price, site } = req.body;
    const fallbackYorum = `
${title} ürünü ${site || "pazar yerinde"} listelenmektedir.
${price ? `Yaklaşık fiyat: ${price} TL` : ""}
Genel olarak fiyat/performans açısından değerlendirilebilir.
    `.trim();
    
    res.json({
      success: true,
      yorum: fallbackYorum,
      error: error.message,
      note: "Fallback yorum (API hatası)"
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("API çalışıyor:", PORT));
