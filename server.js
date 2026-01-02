import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(express.json());

// AI YORUM - KULLANICI KEY AL
app.post("/ai/yorum", async (req, res) => {
  const { title, price, site, apiKey } = req.body;
  
  if (!title) return res.json({ success: false, error: "Ürün yok" });
  
  // KULLANICI KEY VARSA GEMINI KULLAN
  if (apiKey && apiKey.startsWith("AIza")) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `"${title}" ürünü hakkında 2 cümle yorum yap. ${price ? `Fiyat: ${price}. ` : ""}${site ? `Site: ${site}. ` : ""}Kısa ve Türkçe olsun.`;
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      return res.json({ success: true, yorum: text, source: "gemini" });
    } catch (error) {
      return res.json({ success: false, yorum: `Key hatası: ${error.message}` });
    }
  }
  
  // KEY YOKSA BASİT YORUM
  const fallback = `${title} ürünü ${site || ""} listeleniyor. ${price ? `Fiyat: ${price}. ` : ""}Fiyat/performans değerlendirilebilir.`;
  res.json({ success: true, yorum: fallback, source: "fallback" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("API çalışıyor:", PORT));
