import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const HF_MODEL_URL =
  "https://api-inference.huggingface.co/models/google/flan-t5-large";

app.post("/ai/yorum", async (req, res) => {
  try {
    const { originalQuery } = req.body;
    if (!originalQuery) {
      return res.json({ success: true, yorum: "🤖 Ürün adı bulunamadı." });
    }

    const HF_KEY = process.env.HUGGINGFACE_API_KEY;
    if (!HF_KEY) {
      return res.json({ success: true, yorum: "🤖 AI anahtarı yok." });
    }

    const prompt = `Ürün: ${originalQuery}\nKısa ve kullanıcı dostu alışveriş yorumu yaz.`;

    const hfRes = await axios.post(
      HF_MODEL_URL,
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    let aiText = "";

    if (Array.isArray(hfRes.data) && hfRes.data[0]?.generated_text) {
      aiText = hfRes.data[0].generated_text
        .replace(prompt, "")
        .trim();
    }

    if (aiText.length > 5) {
      return res.json({ success: true, yorum: aiText });
    }

    return res.json({
      success: true,
      yorum: "🤖 Ürün değerlendirilebilir, fiyat/performans açısından incelenmeli."
    });

  } catch (err) {
    console.error("HF ERROR:", err.response?.data || err.message);
    return res.json({
      success: true,
      yorum: "🤖 AI şu anda cevap veremiyor."
    });
  }
});

app.listen(process.env.PORT || 10000);
