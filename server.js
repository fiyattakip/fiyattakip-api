// FiyatTakip API - Render uyumlu (CORS + limit + AI fallback)
// Not: E-ticaret siteleri bot/captcha nedeniyle fiyat çekimi çoğu zaman 403 döndürebilir.
// Bu API, "AI yorum" için ürün adına göre kısa yorum üretir. Gemini varsa dener, yoksa/bozulursa fallback yapar.

import express from "express";
import cors from "cors";
import axios from "axios";
import { load } from "cheerio";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();

// ---- Body limits (PayloadTooLarge fix) ----
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ---- CORS ----
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ---- Helpers ----
const PORT = process.env.PORT || 10000;

// Normalized route mounting: support both "/api/*" and "/*"
function mountDual(path, handler) {
  app.all(path, handler);
  app.all("/api" + path, handler);
}

function ok(res, data) {
  res.set("Cache-Control", "no-store");
  res.json(data);
}

function bad(res, code, message, extra = {}) {
  res.status(code).json({ ok: false, error: message, ...extra });
}

// ---- Health ----
mountDual("/health", async (_req, res) => ok(res, { ok: true, service: "fiyattakip-api", ts: Date.now() }));

// ---- Basic "price" fetch (best-effort) ----
async function fetchHtml(url) {
  const r = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.7,en;q=0.6",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    // many sites block; keep it simple
    validateStatus: (s) => s >= 200 && s < 500,
  });
  return { status: r.status, html: r.data };
}

function parsePriceFromHtml(html) {
  try {
    const $ = load(html || "");
    // very naive fallbacks (sites differ a lot)
    const text = $("body").text().replace(/\s+/g, " ").toLowerCase();
    // look for TL like "12.999,00" or "12999"
    const m = text.match(/(\d{1,3}(\.\d{3})*|\d+)(,\d{2})?\s*tl/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

mountDual("/fiyat-cek", async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") return bad(res, 400, "url zorunlu");
  try {
    const { status, html } = await fetchHtml(url);
    if (status === 403) {
      return bad(res, 403, "Site bot/captcha nedeniyle engelledi (403).");
    }
    const priceText = parsePriceFromHtml(html);
    return ok(res, { ok: true, status, priceText, note: "Best-effort parser" });
  } catch (e) {
    return bad(res, 500, "Fiyat çekme hatası", { details: String(e?.message || e) });
  }
});

// ---- AI: Gemini (if available) + fallback ----
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// light heuristic fallback – short, neutral, "artı/eksi"
function fallbackReview(productName = "") {
  const p = (productName || "").trim();
  if (!p) return "Ürün adı gelmedi. Model/kapasite gibi bilgileri yazarsan kısa artı-eksi yorumlayabilirim.";

  const lower = p.toLowerCase();
  const pros = [];
  const cons = [];

  if (/(256|512)\s*gb|1\s*tb/.test(lower)) pros.push("Depolama kapasitesi günlük kullanım için rahat.");
  if (/8\s*gb|12\s*gb|16\s*gb/.test(lower)) pros.push("RAM seviyesi çoklu uygulamada avantaj sağlar.");
  if (/oled|amoled/.test(lower)) pros.push("Ekran tipi (OLED/AMOLED) canlı renk ve iyi kontrast sunar.");
  if (/ips/.test(lower)) pros.push("IPS ekran genelde dengeli renkler ve iyi görüş açısı verir.");
  if (/snapdragon|dimensity|mediatek|apple\s*a/.test(lower)) pros.push("İşlemci tarafı performansı belirleyen ana etken; segmentine göre iyi olabilir.");
  if (/wifi\s*6|wifi\s*7/.test(lower)) pros.push("Kablosuz bağlantı standardı güncel.");
  if (/5g/.test(lower)) pros.push("5G desteği olan bölgelerde daha hızlı mobil internet sağlar.");

  if (/lite|se|mini/.test(lower)) cons.push("‘Lite/SE/Mini’ ibareleri bazen kırpılmış özellik anlamına gelebilir.");
  if (/(4\s*gb|6\s*gb)\s*ram/.test(lower)) cons.push("RAM düşükse uzun vadede çoklu görevde zorlayabilir.");
  if (/128\s*gb/.test(lower)) cons.push("128GB depolama, yoğun foto/video kullananlarda çabuk dolabilir.");
  if (/11\b|11\.\d|12\.\d/.test(lower)) pros.push("Ekran boyutu tablet kullanımında konfor sağlar.");
  if (/tablet/.test(lower)) cons.push("Tabletlerde yazılım/aksesuar (kalem-klavye) ek maliyet getirebilir.");

  const prosTxt = pros.length ? `Artılar: ${pros.slice(0, 3).join(" • ")}.` : "Artılar: Segmentine göre denge sunabilir.";
  const consTxt = cons.length ? `Eksiler: ${cons.slice(0, 2).join(" • ")}.` : "Eksiler: Net yorum için işlemci/RAM/depolama ve kullanım amacını bilmek lazım.";
  const tip = "İpucu: Kullanım amacın (ders/oyun/iş) ve bütçe aralığın yazarsan daha nokta atışı yorumlarım.";
  return `${p}\n${prosTxt}\n${consTxt}\n${tip}`;
}

async function geminiReview(productName, extra = "") {
  if (!genAI) return null;

  // Model seçimi: ücretsiz/uygun olanlar değişebiliyor; hata verirse fallback'e döneceğiz.
  const candidates = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-pro"];
  const prompt = `Kısa, tarafsız bir teknoloji değerlendirmesi yaz.
Ürün: ${productName}
Ek bağlam: ${extra || "-"}
Çıktı formatı:
- 2 cümle genel özet
- Artılar: 3 madde
- Eksiler: 2 madde
- Kimlere uygun: 1 cümle
Fiyat verme, webden veri çekme, link isteme.`;

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.() || "";
      if (text && text.trim().length > 10) return text.trim();
    } catch (e) {
      // try next model
      continue;
    }
  }
  return null;
}

mountDual("/ai-yorum", async (req, res) => {
  const { productName, product, query, extra } = req.body || {};
  const name = (productName || product || query || "").toString().trim();

  // Avoid huge payloads (front should send only strings)
  if (name.length > 500) return bad(res, 413, "productName çok uzun (maks 500 karakter)");

  try {
    const gem = await geminiReview(name, (extra || "").toString().slice(0, 500));
    const text = gem || fallbackReview(name);
    return ok(res, { ok: true, provider: gem ? "gemini" : "fallback", text });
  } catch (e) {
    // last resort
    return ok(res, { ok: true, provider: "fallback", text: fallbackReview(name) });
  }
});

// ---- 404 ----
app.use((_req, res) => bad(res, 404, "Not Found"));

app.listen(PORT, () => {
  console.log("///////////////////////////////////////////////////////////");
  console.log(`FiyatTakip API ready on :${PORT}`);
  console.log("Health (both): /health and /api/health");
  console.log("AI (both): /ai-yorum and /api/ai-yorum");
  console.log("Price (both): /fiyat-cek and /api/fiyat-cek");
  console.log("///////////////////////////////////////////////////////////");
});
