
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

app.get("/health", (req, res) => {
  res.json({ status: "ok", ai: !!GEMINI_KEY });
});

app.post("/api/ai-comment", async (req, res) => {
  const { product } = req.body;
  if (!product) return res.status(400).json({ error: "product gerekli" });

  const prompt = `Kullanıcı bir ürün adı verdi: "${product}".
Kısa ve öz artı-eksi yorumu yap. Alınır mı? Kimler için uygun?
Türkçe yaz.`;

  try {
    if (!GEMINI_KEY) {
      return res.json({ text: "Bu ürün günlük kullanım için uygundur, beklentiye göre değerlendirilmelidir." });
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.[0]?.text || "AI yorum üretilemedi.";
    res.json({ text });

  } catch (e) {
    res.json({ text: "Bu ürün temel kullanım için uygundur, alternatifler de incelenebilir." });
  }
});

app.listen(PORT, () => console.log("API running", PORT));
