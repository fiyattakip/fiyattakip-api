import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'fiyattakip-api',
    timestamp: new Date().toISOString()
  });
});

// AI endpoint (BASİT ve HIZLI)
app.post('/ai/yorum', (req, res) => {
  console.log('AI isteği:', req.body);
  
  const { title, price, site, apiKey } = req.body;
  
  // HEMEN yanıt ver (timeout yok)
  const response = {
    success: true,
    yorum: `🤖 ${title} ${site ? site + "'de" : ""} listeleniyor. ${price ? `Fiyat: ${price}. ` : ""}Fiyat/performans değerlendirilebilir.`,
    source: 'fast_fallback',
    keyProvided: !!apiKey,
    timestamp: new Date().toISOString()
  };
  
  console.log('AI yanıtı:', response);
  res.json(response);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ BACKEND ${PORT} PORTUNDA ÇALIŞIYOR (HIZLI MOD)`);
});
