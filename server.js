const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// CORS: GitHub Pages + local dev
app.use(cors({
  origin: "*",
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","x-gemini-key","x-ai-key"]
}));

// Payload limit (kamera / uzun metin vs. için)
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 10000;

// ============= HEALTH =============
app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "v18", ai: "gemini-per-user-key" });
});

// ============= LINK MODE (NO SCRAPE) =============
// Bu endpoint bot/captcha sebebiyle fiyat çekmez; sadece arama linkleri döner.
function buildSearchLinks(q){
  const query = encodeURIComponent(q || "");
  return [
    { site: "Trendyol", url: `https://www.trendyol.com/sr?q=${query}` },
    { site: "Hepsiburada", url: `https://www.hepsiburada.com/ara?q=${query}` },
    { site: "n11", url: `https://www.n11.com/arama?q=${query}` },
    { site: "Amazon TR", url: `https://www.amazon.com.tr/s?k=${query}` }
  ];
}

app.post(["/api/fiyat-cek","/fiyat-cek"], (req, res) => {
  const q = (req.body && (req.body.q || req.body.query || req.body.search)) || "";
  if (!q) return res.status(400).json({ error: "q gerekli" });
  res.json({
    mode: "link",
    note: "Bot/Captcha nedeniyle fiyat çekilmiyor. Sadece arama linkleri üretildi.",
    results: buildSearchLinks(q)
  });
});

// ============= AI YORUM (GEMINI) =============
function getGeminiKey(req){
  // frontend: aiSettings.key -> header as x-gemini-key (or x-ai-key fallback)
  return (req.headers["x-gemini-key"] || req.headers["x-ai-key"] || "").toString().trim();
}

async function geminiComment({ apiKey, product, hints = {} }){
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
Türkçe yaz.
Ürün: "${product}"

Amaç: Fiyat/mağaza linklerini KULLANMADAN, sadece ürünün genel özellikleri ve kullanıcı ihtiyaçları üzerinden kısa ve özgün değerlendirme ver.
Aşağıdaki formatı kullan ve 6-8 satırı geçme:

• Öne çıkanlar: (2 madde)
• Eksiler: (2 madde)
• Kimlere uygun: (1 cümle)
• Alırken bak: (1 cümle)

Not: Ürün bilinmiyorsa "Genel olarak bu sınıftaki ürünlerde..." diye genelle, ama yine de ürün adından çıkarım yap.
`;

  const result = await model.generateContent(prompt);
  const text = result?.response?.text?.() || "";
  return text.trim();
}

app.post(["/api/ai-yorum","/ai-yorum"], async (req, res) => {
  try{
    const apiKey = getGeminiKey(req);
    const product = (req.body && (req.body.product || req.body.urun || req.body.name)) || "";
    if (!product) return res.status(400).json({ error: "product gerekli" });
    if (!apiKey) return res.status(400).json({ error: "Gemini API Key gerekli (Ayarlar > AI)" });

    const yorum = await geminiComment({ apiKey, product });

    if (!yorum) return res.status(502).json({ error: "AI yorum boş döndü" });
    res.json({ yorum });
  }catch(err){
    const msg = (err && err.message) ? err.message : "AI hata";
    // Kota bitti gibi durumlarda genelde 429
    const status = /429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? 429 : 500;
    res.status(status).json({ error: "AI yorum alınamadı", detail: msg });
  }
});

// 404 fallback
app.use((req,res)=>res.status(404).json({ error: "Not Found" }));

app.listen(PORT, () => console.log("✅ API running on", PORT));
