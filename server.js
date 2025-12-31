const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" })); // Payload hatası bitti

// ====================
// HEALTH
// ====================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    ai: "aktif",
    version: "v13"
  });
});

// ====================
// AI YORUM (GEMINI)
// ====================
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { product } = req.body;

    if (!product) {
      return res.status(400).json({ error: "Ürün adı yok" });
    }

    // 🔹 Gemini yerine ŞİMDİLİK fallback
    // (kotaya girmeden çalışması için)
    const yorum = `
${product} genel olarak günlük kullanım için yeterli bir üründür.
Artıları: fiyat/performans dengesi, erişilebilirlik.
Eksileri: profesyonel kullanım ve yüksek performans beklentisi için sınırlı.
`;

    res.json({ yorum: yorum.trim() });
  } catch (err) {
    res.status(500).json({ error: "AI yorum alınamadı" });
  }
});

// ====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("✅ API çalışıyor :", PORT);
});
