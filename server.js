const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

/* ================== MIDDLEWARE ================== */
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

/* ================== YARDIMCI ================== */
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

/* ================== AI YORUM ENDPOINT ================== */
/* Frontend bunu çağırıyor – sakın ismini değiştirme */
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { urun } = req.body;

    if (!urun) {
      return res.json({
        success: false,
        error: "ÜRÜN_GEREKLİ",
      });
    }

    const gemini = getGeminiFromReq(req);

    if (!gemini) {
      return res.json({
        success: false,
        error: "GEMINI_API_KEY_GEREKLİ",
      });
    }

    const model = gemini.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
Bir teknoloji uzmanı gibi davran.

Ürün: ${urun}

Şunları yap:
- Artılarını söyle
- Eksilerini söyle
- Kimler için uygun
- KISA ve ÖZGÜN yorum yaz

Maksimum 4–5 cümle.
Türkçe yaz.
Emoji kullan.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return res.json({
      success: true,
      aiYorum: text,
      tarih: new Date().toISOString(),
    });
  } catch (err) {
    console.error("AI HATA:", err.message);
    return res.json({
      success: false,
      error: "AI_HATA",
      aiYorum: "🤖 AI şu anda yanıt veremiyor.",
    });
  }
});

/* ================== HEALTH ================== */
app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    service: "FiyatTakip API",
    ai: "Gemini (per-user)",
    time: new Date().toISOString(),
  });
});

/* ================== SERVER ================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 FiyatTakip API çalışıyor");
  console.log("📍 Port:", PORT);
});
