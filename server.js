const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// --- Middleware ---
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));
app.options("*", cors({ origin: true }));

// --- Config ---
const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const geminiAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// --- Helpers ---
function nowTR() {
  try { return new Date().toLocaleString("tr-TR"); } catch { return new Date().toISOString(); }
}
function normText(s="") {
  return String(s)
    .toLowerCase()
    .replace(/[’'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
// "8gb" <-> "8 gb", "256gb" <-> "256 gb", remove punctuation, normalize spaces
function normalizeForMatch(s="") {
  return normText(s)
    .replace(/([0-9])\s*(gb|tb|mb|mhz|hz|w|kw|v|mah)\b/g, "$1 $2")
    .replace(/[^a-z0-9ğüşöçı\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function safeJoinNewline(lines) {
  return (Array.isArray(lines) ? lines : []).join("\n"); // IMPORTANT: this is "\n" (no real newline inside quotes)
}

// --- Root route (avoid "Cannot GET /") ---
app.get("/", (req, res) => {
  res.status(200).json({ ok: true, status: "online", time: nowTR() });
});

// --- Health routes (both) ---
app.get("/health", (req, res) => {
  res.json({
    status: "online",
    zaman: nowTR(),
    versiyon: "4.3.0",
    ai: geminiAI ? "Aktif" : "Pasif",
    routes: ["/health", "/api/health", "/api/fiyat-cek", "/api/ai-yorum", "/api/kamera-ai"]
  });
});
app.get("/api/health", (req, res) => res.redirect(302, "/health"));

// --- Price scraping (simple, stable fallback) ---
// NOTE: Real scraping may face bot protections. We keep conservative and return partials.
async function fetchTrendyol(query) {
  const url = `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}`;
  const html = (await axios.get(url, { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } })).data;
  const $ = cheerio.load(html);
  const items = [];
  $("div.p-card-wrppr, div.p-card-chldrn-cntnr").slice(0, 8).each((_, el) => {
    const name = $(el).find("span.prdct-desc-cntnr-name, div.prdct-desc-cntnr-ttl").first().text().trim();
    const price = $(el).find("div.prc-box-dscntd, div.prc-box-sllng").first().text().trim();
    let link = $(el).find("a").first().attr("href") || "";
    if (link && link.startsWith("/")) link = "https://www.trendyol.com" + link;
    if (name && link) items.push({ site: "Trendyol", urun: name, fiyat: price || "", link });
  });
  return items;
}

async function fetchHepsiburada(query) {
  const url = `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`;
  const html = (await axios.get(url, { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } })).data;
  const $ = cheerio.load(html);
  const items = [];
  $('[data-test-id="product-card"], li[class*="productListContent"]').slice(0, 8).each((_, el) => {
    const name = $(el).find('[data-test-id="product-card-name"], h3, span').first().text().trim();
    const price = $(el).find('[data-test-id="price-current-price"], span[class*="price"]').first().text().trim();
    let link = $(el).find("a").first().attr("href") || "";
    if (link && link.startsWith("/")) link = "https://www.hepsiburada.com" + link;
    if (name && link) items.push({ site: "Hepsiburada", urun: name, fiyat: price || "", link });
  });
  return items;
}

function filterRelevant(query, items) {
  const q = normalizeForMatch(query);
  if (!q) return items;
  const qTokens = q.split(" ").filter(Boolean);
  if (qTokens.length === 0) return items;

  const scored = items.map(it => {
    const t = normalizeForMatch(it.urun || "");
    let score = 0;
    for (const tok of qTokens) if (t.includes(tok)) score++;
    return { it, score };
  });

  // Keep if score >= 30% tokens matched OR at least 2 tokens matched
  const minScore = Math.max(2, Math.ceil(qTokens.length * 0.3));
  const kept = scored.filter(x => x.score >= minScore).map(x => x.it);

  // Fallback: if filtering removes everything, return original (avoid "ürün bulunamadı")
  return kept.length ? kept : items;
}

function parsePriceToNumber(s="") {
  const txt = String(s).replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  const n = Number(txt);
  return Number.isFinite(n) ? n : null;
}

function sortByPrice(items, sort="asc") {
  const withNum = items.map(it => ({ ...it, _p: parsePriceToNumber(it.fiyat) }));
  withNum.sort((a,b) => {
    const ap = a._p ?? Number.POSITIVE_INFINITY;
    const bp = b._p ?? Number.POSITIVE_INFINITY;
    return sort === "desc" ? (bp - ap) : (ap - bp);
  });
  return withNum.map(({_p, ...rest}) => rest);
}

app.post("/api/fiyat-cek", async (req, res) => {
  const { urun, page = 1, sort = "asc" } = req.body || {};
  const query = String(urun || "").trim();
  if (!query) return res.status(400).json({ success: false, error: "urun gerekli" });

  try {
    let all = [];
    // Try both; failures are tolerated
    try { all = all.concat(await fetchTrendyol(query)); } catch (e) {}
    try { all = all.concat(await fetchHepsiburada(query)); } catch (e) {}

    all = filterRelevant(query, all);
    all = sortByPrice(all, sort);

    const pageSize = 4;
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const p = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const slice = all.slice((p-1)*pageSize, (p-1)*pageSize + pageSize);

    res.json({
      success: true,
      query,
      toplamUrun: total,
      sayfa: p,
      toplamSayfa: totalPages,
      siralama: sort,
      fiyatlar: slice
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Fiyat çekilemedi", detail: String(err?.message || err) });
  }
});

// Alias endpoints (support older frontend)
app.post("/fiyat-cek", (req,res)=> app._router.handle({ ...req, url: "/api/fiyat-cek" }, res, ()=>{}));

// --- AI Comment ---
app.post("/api/ai-yorum", async (req, res) => {
  const body = req.body || {};
  const urun = String(body.urun || body.product || "").trim();
  const fiyatListesi = Array.isArray(body.fiyatlar) ? body.fiyatlar : (Array.isArray(body.prices) ? body.prices : []);

  if (!urun) return res.status(400).json({ success:false, error:"urun gerekli" });

  // Build lines even if prices missing
  const lines = fiyatListesi.map(f => {
    const site = (f.site || f.siteName || "Site");
    const fiyat = (f.fiyat || f.price || "");
    return `- ${site}: ${fiyat}`;
  });
  const fiyatMetni = lines.length ? safeJoinNewline(lines) : "Fiyat bilgisi paylaşılmadı.";

  const prompt = `
Ürün: ${urun}

Fiyat Bilgisi:
${fiyatMetni}

Kural:
- Fiyat varsa: fiyat farkını kısaca yorumla.
- Fiyat yoksa: bu ürün alınır mı/değer mi, kimlere uygun, kimlere değil değerlendir.
- 3-4 cümle, kısa ve net.
- "Fiyatlar karşılaştırıldı", "en uygun seçeneği tercih edin" gibi klişe cümleler KULLANMA.
- Kullanıcıya hitap eden sade Türkçe kullan.
`.trim();

  // If Gemini not configured, return fallback
  if (!geminiAI) {
    return res.json({
      success: true,
      yorum: `Bu ürün günlük kullanım için beklentine göre değerlendirilmeli. Eğer performans/kalite beklentin yüksekse aynı segmentte alternatiflere de bakmak mantıklı olur. İhtiyacını karşılıyorsa alınabilir; değilse biraz daha bütçe ayırmak daha iyi sonuç verir.`
    });
  }

  try {
    const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = (result && result.response && typeof result.response.text === "function") ? result.response.text() : "";
    const cleaned = String(text || "").trim();
    if (!cleaned) throw new Error("empty ai response");
    res.json({ success: true, yorum: cleaned });
  } catch (err) {
    // Fallback (avoid frontend "AI yorum alınamadı")
    res.json({
      success: true,
      yorum: `Bu ürünün değip değmeyeceği beklentine bağlı. Temel ihtiyaç için uygunsa alınabilir; daha üst seviye performans istiyorsan muadil güçlü modellere bakman daha doğru olur.`,
      aiError: String(err?.message || err)
    });
  }
});
app.post("/ai-yorum", (req,res)=> app._router.handle({ ...req, url: "/api/ai-yorum" }, res, ()=>{}));

// --- Camera AI placeholder (kept for compatibility) ---
app.post("/api/kamera-ai", async (req, res) => {
  // This endpoint expects base64; implementing full vision is optional.
  res.json({ success: true, urunTahmini: "telefon" });
});
app.post("/kamera-ai", (req,res)=> app._router.handle({ ...req, url: "/api/kamera-ai" }, res, ()=>{}));

app.listen(PORT, () => console.log("API listening on", PORT));
