const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Fiyat API
app.post('/api/fiyat-cek', (req, res) => {
  const urun = req.body.urun || "iphone";
  
  const fiyatlar = [
    { 
      site: "Trendyol", 
      fiyat: `${Math.floor(Math.random() * 2000) + 1000} TL`, 
      urun: `${urun} Pro`,
      link: "https://www.trendyol.com"
    },
    { 
      site: "Hepsiburada", 
      fiyat: `${Math.floor(Math.random() * 2100) + 1100} TL`, 
      urun: `${urun} 128GB`,
      link: "https://www.hepsiburada.com"
    },
    { 
      site: "n11", 
      fiyat: `${Math.floor(Math.random() * 1900) + 900} TL`, 
      urun: `${urun} Siyah`,
      link: "https://www.n11.com"
    }
  ];
  
  res.json({ 
    success: true, 
    query: urun, 
    fiyatlar: fiyatlar,
    timestamp: new Date().toISOString()
  });
});

// Sağlık kontrolü
app.get('/health', (req, res) => {
  res.json({ status: 'online', time: new Date().toISOString() });
});

// Ana sayfa
app.get('/', (req, res) => {
  res.send(`
    <h1>FiyatTakip API</h1>
    <p>Çalışıyor! Endpoint: POST /api/fiyat-cek</p>
    <p>Health: GET /health</p>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API ${PORT} portunda çalışıyor`);
});
