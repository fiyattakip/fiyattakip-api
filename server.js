import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50kb" }));

/* ================= HEALTH ================= */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ================= AI YORUM ================= */
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const apiKey = req.headers["x-gemini-key"];
    const { urun } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: "API KEY YOK" });
    }

    if (!urun) {
      return res.status(400).json({ error: "ÜRÜN YOK" });
    }

    const prompt = `
Kullanıcı bir ürün soruyor: "${urun}"

Kısa ve net bir değerlendirme yap.
- Alınır mı?
- Kimler için uygun?
- Artı / eksi

Fiyat yokmuş gibi davran.
Maksimum 5-6 cümle yaz.
`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await geminiRes.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "AI yorum üretilemedi";

    res.json({ yorum: text });
  } catch (err) {
    console.error("AI HATA:", err);
    res.status(500).json({ error: "AI SERVİS HATASI" });
  }
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("API çalışıyor:", PORT);
});
