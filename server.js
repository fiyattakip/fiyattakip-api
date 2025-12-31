const express = require("express");
const cors = require("cors");
require("dotenv").config();

let genAI = null;
try {
  // Optional dependency (will exist if installed)
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
} catch (e) {
  genAI = null;
}

const app = express();

// CORS: allow GitHub Pages + local dev. (You can broaden if needed)
const ALLOWED_ORIGINS = [
  "https://fiyattakip.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];
app.use(cors({
  origin: function(origin, cb){
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Allow Render preview / custom domains (optional)
    if (origin.endsWith(".onrender.com")) return cb(null, true);
    return cb(null, true);
  }
}));

// PayloadTooLarge fix (AI camera / long texts etc.)
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true, limit: "3mb" }));

// =============
// HEALTH
// =============
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "v17",
    ai: genAI ? "gemini" : "fallback",
    time: new Date().toISOString(),
  });
});

// =============
// Helpers
// =============
function stablePick(arr, seedStr) {
  const h = require("crypto").createHash("sha256").update(seedStr).digest("hex");
  const n = parseInt(h.slice(0, 8), 16);
  return arr[n % arr.length];
}

function heuristicComment(product) {
  const p = String(product || "").trim();
  const lower = p.toLowerCase();

  const isPhone = /(iphone|samsung|galaxy|xiaomi|redmi|poco|honor|oppo|vivo|realme|pixel)/i.test(p);
  const isTablet = /(ipad|tablet|pad\s?\d|tab\s?\d|galaxy tab|matepad)/i.test(p);
  const isLaptop = /(laptop|notebook|thinkpad|ideapad|macbook|victus|tuf|rog|nitro|legion)/i.test(p);
  const isHeadphone = /(airpods|kulaklık|headphone|buds|earbuds)/i.test(p);

  const storage = (p.match(/(\d+)\s?(gb|tb)\b/i) || [])[0] || "";
  const ram = (p.match(/(\d+)\s?gb\s?ram/i) || [])[0] || "";
  const refresh = (p.match(/(\d+)\s?hz\b/i) || [])[0] || "";

  const category =
    isTablet ? "tablet" :
    isLaptop ? "laptop" :
    isHeadphone ? "kulaklık" :
    isPhone ? "telefon" : "ürün";

  const prosBank = {
    phone: [
      "günlük kullanımda akıcı deneyim",
      "kamera/ekran tarafı segmentine göre iyi",
      "yazılım desteği ve ikinci el değeri avantajı",
      "taşınabilirlik ve pil dengesi",
    ],
    tablet: [
      "ders/çalışma için geniş ekran konforu",
      "not alma + medya tüketiminde çok iyi",
      "kalem/klavye aksesuarlarıyla verimli",
      "pil ömrü genelde güçlü",
    ],
    laptop: [
      "çok yönlü kullanım (iş/okul) için uygun",
      "performans/taşınabilirlik dengesine bakılır",
      "SSD yükseltme ile çok hızlanır",
      "ekran ve soğutma önemli",
    ],
    headphone: [
      "konfor ve ses karakteri belirleyici",
      "ANC varsa toplu taşımada avantaj",
      "mikrofon kalitesi görüşmeler için önemli",
      "kutu/pil ömrü pratiklik sağlar",
    ],
    generic: [
      "ihtiyaca göre fiyat/performans değerlendirmesi",
      "garanti ve satıcı güvenilirliği önemli",
      "iade/servis süreçleri dikkate alınmalı",
      "benzer ürünlerle özellik karşılaştırması faydalı",
    ],
  };

  const consBank = {
    phone: [
      "yük altında ısınma/şarj hızı segmentine göre değişir",
      "depolama düşükse uzun vadede yetmeyebilir",
      "kamera beklentisi çok yüksekse araştırmak gerekir",
      "güncelleme süresi markaya göre değişebilir",
    ],
    tablet: [
      "bazı uygulamalar tablette tam optimize olmayabilir",
      "aksesuar (kalem/klavye) ekstra maliyet",
      "oyun/performans beklentisine göre model seçilmeli",
      "LTE yoksa mobilde sürekli hotspot gerekebilir",
    ],
    laptop: [
      "ince kasalarda fan sesi/ısınma görülebilir",
      "ekran parlaklığı ve renk doğruluğu modelden modele değişir",
      "batarya süreleri kullanım senaryosuna bağlı",
      "servis ağı ve parça bulunabilirliği önemli",
    ],
    headphone: [
      "kulak yapısına göre konfor değişebilir",
      "ANC performansı modelden modele çok farklı",
      "kodek desteği (AAC/LDAC) önemli olabilir",
      "kutusuz kullanımda pil kısa olabilir",
    ],
    generic: [
      "sadece fiyata değil, özelliklere bakmak gerekir",
      "satıcı/garanti tarafı risk yaratabilir",
      "piyasada çok benzer varyant olabilir (model kodu önemli)",
      "kampanya dönemleri fiyatı hızlı değiştirir",
    ],
  };

  const whoBank = {
    phone: [
      "günlük sosyal medya/iletişim için",
      "kamera ve ekranı önemseyenler için",
      "uzun süre kullanmayı planlayanlar için",
      "fiyat/performans arayanlar için",
    ],
    tablet: [
      "ders, not ve PDF okuma için",
      "Netflix/YouTube gibi medya için",
      "hafif oyun ve günlük işler için",
      "taşınabilir ikinci cihaz isteyenler için",
    ],
    laptop: [
      "ofis/okul işleri için",
      "orta seviye tasarım/çoklu görev için",
      "hafif-orta oyun için (modele bağlı)",
      "taşınabilir çalışma düzeni için",
    ],
    headphone: [
      "toplu taşımada/işte müzik için",
      "görüşme yapanlar için",
      "spor/aktif kullanım için (modele bağlı)",
      "bas/denge odaklı dinleyiciler için",
    ],
    generic: [
      "ihtiyacı net olan kullanıcılar için",
      "benzer ürünleri kıyaslayacaklar için",
      "garantiye önem verenler için",
      "kampanya takip edenler için",
    ],
  };

  const key =
    category === "telefon" ? "phone" :
    category === "tablet" ? "tablet" :
    category === "laptop" ? "laptop" :
    category === "kulaklık" ? "headphone" : "generic";

  const pro = stablePick(prosBank[key], p + "|pro");
  const con = stablePick(consBank[key], p + "|con");
  const who = stablePick(whoBank[key], p + "|who");

  const extras = [];
  if (storage) extras.push(`Depolama: ${storage}`);
  if (ram) extras.push(`RAM: ${ram.replace(/\s+/g," ")}`);
  if (refresh) extras.push(`Ekran: ${refresh}`);
  const extraLine = extras.length ? `\nÖne çıkan: ${extras.join(" • ")}` : "";

  return `Kısa değerlendirme (${p}):\n• Artı: ${pro}\n• Eksi: ${con}\n• Kimlere uygun: ${who}${extraLine}`.trim();
}

async function geminiComment(product) {
  if (!genAI) return null;

  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro"];
  const prompt = `
Kullanıcı bir ürün adı yazdı. Sadece ürün ismi/modeli ve genel piyasa beklentisine göre KISA ve ÖZGÜN bir değerlendirme yaz.
Kurallar:
- Fiyat söyleme, link verme, mağaza adı verme.
- 3 madde: Artı, Eksi, Kimlere uygun.
- 2-4 cümle toplam, Türkçe, kısa.
Ürün: "${product}"
`.trim();

  for (const m of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.() || "";
      const cleaned = String(text).trim();
      if (cleaned) return cleaned;
    } catch (e) {
      // try next model
    }
  }
  return null;
}

// =============
// AI COMMENT API
// =============
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const product = (req.body?.product || req.body?.query || "").toString().trim();
    if (!product) return res.status(400).json({ error: "Ürün adı yok" });

    const gem = await geminiComment(product);
    if (gem) return res.json({ yorum: gem });

    const fallback = heuristicComment(product);
    return res.json({ yorum: fallback, fallback: true });
  } catch (err) {
    return res.status(500).json({ error: "AI yorum alınamadı" });
  }
});

// Backward compatible endpoints (some frontends call these)
app.get("/api/health", (req, res) => res.redirect(302, "/health"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ FiyatTakip API v17 running on port ${PORT}`);
});
