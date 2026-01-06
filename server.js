import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const HF_ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
const HF_TIMEOUT = 25000;

app.post("/ai/yorum", async (req, res) => {
  try {
    const { originalQuery } = req.body;
    if (!originalQuery) {
      return res.json({ success: true, yorum: "🤖 Ürün adı bulunamadı." });
    }

    const HF_KEY = process.env.HUGGINGFACE_API_KEY;
    if (!HF_KEY) {
      return res.json({ success: true, yorum: "🤖 AI servisi yapılandırılmamış." });
    }

    const hfRes = await axios.post(
      HF_ENDPOINT,
      {
        model: "google/flan-t5-large",
        messages: [
          { role: "user", content: originalQuery }
        ],
        temperature: 0.7,
        max_tokens: 120
      },
      {
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: HF_TIMEOUT
      }
    );

    const aiText =
      hfRes.data?.choices?.[0]?.message?.content?.trim() || "";

    if (aiText.length > 5) {
      return res.json({ success: true, yorum: aiText });
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

app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 API running on", PORT));
