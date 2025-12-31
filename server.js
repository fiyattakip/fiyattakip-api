// server.js (STABLE + SECURE)
// Render ENV:
// - GEMINI_API_KEY : required for real Gemini output
// Optional:
// - PORT
//
// Endpoints:
// GET  /health        -> ok
// GET  /api/health    -> ok (compat)
// POST /api/ai-yorum  -> { urun } or { product } -> { text, provider }

const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();

// Allow larger JSON (camera base64 etc. even if we don't use yet)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"] }));

const PORT = process.env.PORT || 3000;

function okHealth(req, res){
  res.json({
    status: "online",
    time: new Date().toISOString(),
    provider: process.env.GEMINI_API_KEY ? "gemini" : "fallback"
  });
}
app.get("/", (req,res)=> res.status(200).send("OK"));
app.get("/health", okHealth);
app.get("/api/health", okHealth);

function heuristicComment(urun){
  const u = String(urun||"").trim();
  const lower = u.toLowerCase();
  const hints = [];
  if (/(gb|ram|rom|ssd|tb)/i.test(u)) hints.push("Depolama/RAM değerlerini ihtiyacına göre seç.");
  if (/(tablet|pad)/i.test(lower)) hints.push("Ekran, pil ve güncelleme desteğine özellikle bak.");
  if (/(telefon|phone|iphone|samsung|xiaomi|redmi|honor)/i.test(lower)) hints.push("Kamera, batarya ve yazılım güncelleme süresi bu sınıfta belirleyici.");
  if (/(oyun|gaming|rtx|gpu|ekran kart)/i.test(lower)) hints.push("Soğutma ve güç tüketimi (W) performansı ciddi etkiler.");
  if (!hints.length) hints.push("Ürünü almadan önce garanti/servis, iade koşulları ve kullanıcı yorumlarını kontrol et.");
  return `Kısa değerlendirme (${u}): ${hints.slice(0,2).join(" ")} Eğer fiyat farkı küçükse, daha iyi garanti/servis sunan satıcıyı tercih et.`;
}

function geminiGenerate(prompt){
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Promise.resolve({ ok:false, error:"NO_KEY" });

  const model = "gemini-1.5-flash";
  const urlPath = `/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 180
    }
  });

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: urlPath,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    }
  };

  return new Promise((resolve)=>{
    const req = https.request(options, (resp)=>{
      let data = "";
      resp.on("data", (c)=> data += c);
      resp.on("end", ()=>{
        if (resp.statusCode < 200 || resp.statusCode >= 300){
          return resolve({ ok:false, error:`HTTP_${resp.statusCode}`, raw:data });
        }
        try{
          const j = JSON.parse(data);
          const text = j?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("") || "";
          resolve({ ok: !!text, text: text.trim() });
        }catch(e){
          resolve({ ok:false, error:"BAD_JSON" });
        }
      });
    });
    req.on("error", (e)=> resolve({ ok:false, error:"REQ_ERR", raw:String(e) }));
    req.write(body);
    req.end();
  });
}

app.post("/api/ai-yorum", async (req, res) => {
  try{
    const urun = String(req.body?.urun || req.body?.product || "").trim();
    if (!urun) return res.status(400).json({ error: "urun gerekli" });

    const prompt =
`Kullanıcı Türkiye'de alışveriş yapacak.
Ürün: "${urun}"

Görev:
- Ürün hakkında kısa ve öz (2-4 cümle) değerlendirme yaz.
- Artı/eksi yönler ve kimlere uygun olduğuna değin.
- Fiyat çekemiyoruz, fiyat uydurma. "Fiyat karşılaştırın" gibi genel öneri olabilir.
- Kesin iddia yerine olasılıklı, akla uygun öneri yap.
Türkçe yaz.`;

    const g = await geminiGenerate(prompt);
    if (g.ok){
      return res.json({ text: g.text, provider: "gemini" });
    }
    // fallback
    return res.json({ text: heuristicComment(urun), provider: "fallback" });
  }catch(e){
    console.error("AI error:", e);
    return res.status(500).json({ error: "server" });
  }
});

// 404
app.use((req,res)=> res.status(404).json({ error:"not_found" }));

app.listen(PORT, ()=> console.log("API listening on", PORT));
