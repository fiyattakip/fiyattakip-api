// server.js - EN BASİT ÇALIŞAN VERSİYON
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FiyatTakip API çalışıyor",
    endpoints: ["/health", "/api/fiyat-cek"]
  });
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "healthy" });
});

app.post("/api/fiyat-cek", (req, res) => {
  const { urun } = req.body;
  
  // Test verisi - scraping olmadan
  const testProducts = [
    {
      site: "Trendyol",
      urun: `${urun} - Test ürünü 1`,
      fiyat: "1.299,99 TL",
      link: "https://www.trendyol.com/test",
      image: ""
    },
    {
      site: "Hepsiburada",
      urun: `${urun} - Test ürünü 2`,
      fiyat: "1.199,99 TL",
      link: "https://www.hepsiburada.com/test",
      image: ""
    },
    {
      site: "n11",
      urun: `${urun} - Test ürünü 3`,
      fiyat: "1.399,99 TL",
      link: "https://www.n11.com/test",
      image: ""
    }
  ];
  
  res.json({
    success: true,
    query: urun,
    toplamUrun: 3,
    fiyatlar: testProducts,
    note: "Test modu - gerçek scraping yapılmıyor"
  });
});

app.post("/api/ai-yorum", (req, res) => {
  const { urun } = req.body;
  
  res.json({
    success: true,
    aiYorum: `"${urun}" ürünü için tarayıcınızdaki AI özelliğini kullanın.`,
    yorum: `"${urun}" ürünü için tarayıcınızdaki AI özelliğini kullanın.`,
    isFallback: true
  });
});

app.listen(PORT, () => {
  console.log(`✅ API http://localhost:${PORT} adresinde çalışıyor`);
});
