import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ai/yorum", async (req, res) => {
  const { title, price, site, apiKey } = req.body; // ⭐ apiKey geldi!
  
  // 1. KULLANICI KEY'İ VAR MI?
  if (apiKey && apiKey.startsWith("AIza")) {
    try {
      // 2. KULLANICININ KEY'İ İLE GEMINI SOR
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `"${title}" ürününü analiz et. ${price ? `Fiyat: ${price}. ` : ''}${site ? `Site: ${site}. ` : ''}MAX 3 cümle, Türkçe, kısa ve net olsun.`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      
      return res.json({ 
        success: true, 
        yorum: text,
        source: "user_gemini" // Kullanıcının Gemini'si
      });
      
    } catch (error) {
      return res.json({ 
        success: false, 
        yorum: `API key hatası: ${error.message}`,
        source: "key_error"
      });
    }
  }
  
  // 3. KEY YOKSA SABİT YORUM (fallback)
  const fallback = `${title} ürünü ${site || ''} listeleniyor. ${price ? `Fiyat: ${price}. ` : ''}Fiyat/performans değerlendirilebilir.`;
  
  res.json({ 
    success: true, 
    yorum: fallback,
    source: "fallback",
    keyProvided: !!apiKey
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Kullanıcı-bazlı AI API ${PORT} portunda`);
});
