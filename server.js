import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const HF_MODEL = "HuggingFaceH4/zephyr-7b-beta";

app.post("/ai/yorum", async (req, res) => {
  try {
    const { originalQuery } = req.body;

    if (!originalQuery) {
      return res.json({
        success: true,
        yorum: "🤖 Ürün adı bulunamadı."
      });
    }

    const HF_KEY = process.env.HUGGINGFACE_API_KEY;

    const prompt = `${originalQuery} ürünü hakkında kısa, samimi bir alışveriş yorumu yaz.`;

    const hfRes = await axios.post(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        inputs: prompt,
        parameters: { max_new_tokens: 120 }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const text =
      Array.isArray(hfRes.data) && hfRes.data[0]?.generated_text
        ? hfRes.data[0].generated_text.replace(prompt, "").trim()
        : "🤖 Ürün değerlendirmesi hazırlandı.";

    res.json({
      success: true,
      yorum: text
    });

  } catch (err) {
    res.json({
      success: true,
      yorum: "🤖 Ürün teknik olarak değerlendirildi. Fiyat/performans açısından incelenebilir."
    });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 10000);
