import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 1. HEALTH CHECK (Render bunu kontrol eder)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'fiyattakip-api',
    timestamp: new Date().toISOString(),
    port: process.env.PORT 
  });
});

// 2. AI YORUM ENDPOINT (Basit ve çalışan)
app.post('/ai/yorum', (req, res) => {
  const { title, price, site } = req.body;
  
  // Akıllı yorumlar
  let yorum = '';
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('iphone') || titleLower.includes('telefon')) {
    yorum = `📱 ${title} için ${price || 'fiyat bilgisi yok'}. ${site || 'Sitede'} telefon pazarında iyi konumda.`;
  } 
  else if (titleLower.includes('ram') || titleLower.includes('bellek')) {
    yorum = `💾 ${title} - ${price || 'fiyat belirtilmemiş'}. ${site || 'Platformda'} bilgisayar bileşeni.`;
  }
  else {
    yorum = `${title} ürünü ${site || 'pazar yerinde'} listeleniyor. ${price ? `Fiyat: ${price}. ` : ''}Fiyat/performans değerlendirilebilir.`;
  }
  
  res.json({ success: true, yorum });
});

// 3. PORT AYARI (Render için çok önemli!)
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0'; // ⭐ Render bunu ister

app.listen(PORT, HOST, () => {
  console.log(`✅ BACKEND ÇALIŞIYOR: ${HOST}:${PORT}`);
  console.log(`🌐 Health: http://${HOST}:${PORT}/health`);
  console.log(`🚀 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});
