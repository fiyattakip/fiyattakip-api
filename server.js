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
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ API ${HOST}:${PORT} çalışıyor`);
  console.log(`🌐 Health: http://${HOST}:${PORT}/health`);
  console.log(`🚀 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Process ID: ${process.pid}`);
});

// ⭐ RENDER İÇİN GEREKLİ: Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM sinyali alındı, kapanıyor...');
  server.close(() => {
    console.log('Server kapandı');
    process.exit(0);
  });
});

// Process'i alive tut
setInterval(() => {
  console.log('🫀 Heartbeat:', new Date().toISOString());
}, 30000);
