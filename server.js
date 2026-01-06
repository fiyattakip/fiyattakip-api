import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// ================================
// HUGGING FACE AYARLARI (YENİ)
// ================================
const HF_MODEL = "google/flan-t5-large";
const HF_TIMEOUT = 20000;
const HF_ENDPOINT = "https://router.huggingface.co/hf-inference/models";

// ================================
// AI YORUM ENDPOINT
// ================================
app.post("/ai/yorum", async (req, res) => {
  try {
    const { originalQuery } = req.body;

    if (!originalQuery || originalQuery.trim() === "") {
      return res.json({
        success: true,
        yorum: "🤖 Ürün adı bulunamadı."
      });
    }

    const HF_KEY = process.env.HUGGINGFACE_API_KEY;
    if (!HF_KEY) {
      return res.json({
        success: true,
        yorum: "🤖 AI servisi yapılandırılmamış."
      });
    }

    const prompt = `Ürün: ${originalQuery}\n\nBu ürün hakkında kısa, kullanıcı dostu bir alışveriş yorumu yaz. Avantajlarını belirt.`;

    // ================================
    // HUGGING FACE (ROUTER) ÇAĞRISI
    // ================================
    const hfRes = await axios.post(
      `${HF_ENDPOINT}/${HF_MODEL}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 120,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.05
        }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: HF_TIMEOUT
      }
    );

    // ================================
    // EVRENSEL HF RESPONSE OKUMA
    // ================================
    let aiText = "";
    const data = hfRes.data;

    if (typeof data === "string") {
      aiText = data;
    }

    if (Array.isArray(data) && data[0]) {
      aiText =
        data[0].generated_text ||
        data[0].text ||
        "";
    }

    if (typeof data === "object" && data.generated_text) {
      aiText = data.generated_text;
    }

    aiText = aiText.replace(prompt, "").trim();

    if (aiText.length > 5) {
      return res.json({
        success: true,
        yorum: aiText
      });
    }

    return res.json({
      success: true,
      yorum: "🤖 Ürün teknik özellikleri ve kullanım amacı açısından değerlendirilebilir."
    });

  } catch (error) {
    console.error("HF ERROR:", error?.response?.data || error.message);

    return res.json({
      success: true,
      yorum: "🤖 Ürün teknik olarak değerlendirildi. Fiyat/performans açısından incelenebilir."
    });
  }
});

// ================================
// HEALTH CHECK
// ================================
app.get("/health", (_, res) => {
  res.json({ ok: true });
});

// ================================
// SERVER
// ================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API çalışıyor : ${PORT}`);
});
