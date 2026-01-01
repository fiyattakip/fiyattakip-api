const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

/* ================== MIDDLEWARE ================== */
app.use(cors());
app.use(bodyParser.json({ limit: "256kb" }));

/* ================== GEMINI ================== */
function getGeminiFromReq(req) {
  const key =
    req.headers["x-gemini-key"] ||
    req.headers["x-gemini-api-key"] ||
    req.body?.apiKey ||
    "";

  if (!key) return null;

  try {
    return new GoogleGenerativeAI(key.trim());
  } catch {
    return null;
  }
}

/* ================== AI YORUM ================== */
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { urun } = req.body;
    if (!urun) {
      return res.json({ success: false, error: "URUN_GEREKLİ" });
    }

    const gemini = getGeminiFromReq(req);
    if (!gemini) {
      return res.json({ success: false, error: "API_KEY_GEREKLİ" });
    }

    const model = gemini.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
Bir teknoloji uzmanı gibi davran.

Ürün: ${urun}

Şunları yap:
- Artıları
- Eksileri
- Kimler için uygun
- Alınır mı alınmaz mı

KISA, NET ve ÖZGÜN yaz.
Türkçe yaz.
Emoji kullan.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({
      success: true,
      aiYorum: text,
      tarih: new Date().toISOString(),
    });
  } catch (e) {
    console.error("AI HATA:", e);
    res.json({
      success: false,
      aiYorum: "🤖 AI şu anda yanıt veremedi.",
    });
  }
});

/* ================== HEALTH ================== */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    ai: "gemini-per-user",
    time: new Date().toISOString(),
  });
});

/* ================== SERVER ================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 API ÇALIŞIYOR:", PORT);
});
