import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

// ✅ PayloadTooLargeError fix: allow bigger JSON bodies (camera base64 vs. etc.)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

app.get("/health", (req, res) => {
  res.json({ status: "ok", ai: !!GEMINI_KEY });
});

// Accept ONLY the fields we need, ignore the rest (prevents huge objects breaking logic)
app.post("/api/ai-comment", async (req, res) => {
  const product = (req.body?.product || "").toString().slice(0, 200);

  if (!product) return res.status(400).json({ error: "product gerekli" });

  const prompt = `Kullanıcı bir ürün adı verdi: "${product}".
Fiyat bilgisi olmadan, kısa ve öz (max 5-6 cümle) artı-eksi yorumu yap.
Alınır mı? Kimler için uygun? Türkçe yaz.`;

  try {
    if (!GEMINI_KEY) {
      return res.json({
        text: "Bu ürün günlük kullanım için uygundur. Beklentine göre teknik özellikleri (ekran, pil, garanti) kontrol ederek karar ver."
      });
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
    const text =
      j.candidates?.[0]?.content?.parts?.[0]?.text ||
      "AI yorum üretilemedi.";

    res.json({ text });
  } catch (e) {
    res.json({
      text: "Bu ürün için genel değerlendirme: günlük kullanım için mantıklı olabilir; ihtiyaçların yüksekse alternatifleri de incele."
    });
  }
});

// Optional: consistent 404
app.use((req, res) => res.status(404).json({ error: "not_found" }));

app.listen(PORT, () => console.log("API running on", PORT));
