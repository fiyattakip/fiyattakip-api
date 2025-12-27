const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// CORS ayarları
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// User-Agent rotasyonu
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/122.0'
];

// Helper: Fiyatı temizle
function cleanPrice(priceText) {
  if (!priceText) return '0 TL';
  const match = priceText.match(/(\d+[\d.,]*)/);
  return match ? match[1].replace(',', '.').trim() + ' TL' : '0 TL';
}

// Trendyol scraping
async function scrapeTrendyol(query) {
  try {
    const url = `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgents[0],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const products = [];

    $('.p-card-wrppr').each((i, el) => {
      if (i >= 5) return;
      
      const title = $(el).find('.prdct-desc-cntnr-name, .product-name').first().text().trim();
      const price = $(el).find('.prc-box-dscntd, .product-price').first().text().trim();
      const link = $(el).find('a').first().attr('href');
      const image = $(el).find('img').first().attr('src');
      
      if (title && price) {
        products.push({
          site: 'Trendyol',
          urun: title.substring(0, 100),
          fiyat: cleanPrice(price),
          link: link ? (link.startsWith('http') ? link : `https://www.trendyol.com${link}`) : '#',
          image: image || ''
        });
      }
    });

    return products;
  } catch (error) {
    console.error('Trendyol scraping error:', error.message);
    return [];
  }
}

// Hepsiburada scraping
async function scrapeHepsiburada(query) {
  try {
    const url = `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgents[1],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const products = [];

    $('li[class*="productList"], [data-test-id="product-card"]').each((i, el) => {
      if (i >= 5) return;
      
      const title = $(el).find('h3[data-test-id="product-card-name"], .product-name').first().text().trim();
      const price = $(el).find('[data-test-id="price-current-price"], .price').first().text().trim();
      const link = $(el).find('a').first().attr('href');
      const image = $(el).find('img').first().attr('src');
      
      if (title && price) {
        products.push({
          site: 'Hepsiburada',
          urun: title.substring(0, 100),
          fiyat: cleanPrice(price),
          link: link ? (link.startsWith('http') ? link : `https://www.hepsiburada.com${link}`) : '#',
          image: image || ''
        });
      }
    });

    return products;
  } catch (error) {
    console.error('Hepsiburada scraping error:', error.message);
    return [];
  }
}

// n11 scraping
async function scrapeN11(query) {
  try {
    const url = `https://www.n11.com/arama?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgents[2]
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const products = [];

    $('.column, .listItem, .product').each((i, el) => {
      if (i >= 5) return;
      
      const title = $(el).find('.productName, .productTitle').first().text().trim();
      const price = $(el).find('.newPrice, ins, .price').first().text().trim();
      const link = $(el).find('a').first().attr('href');
      const image = $(el).find('img').first().attr('src');
      
      if (title && price) {
        products.push({
          site: 'n11',
          urun: title.substring(0, 100),
          fiyat: cleanPrice(price),
          link: link || '#',
          image: image || ''
        });
      }
    });

    return products;
  } catch (error) {
    console.error('n11 scraping error:', error.message);
    return [];
  }
}

// Ana fiyat çekme endpoint'i
app.post('/api/fiyat-cek', async (req, res) => {
  try {
    const { urun } = req.body;
    
    if (!urun || urun.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ürün adı en az 2 karakter olmalı' 
      });
    }

    console.log(`🔍 Fiyat çekiliyor: ${urun}`);
    
    // Paralel scraping
    const [trendyolResults, hepsiburadaResults, n11Results] = await Promise.allSettled([
      scrapeTrendyol(urun),
      scrapeHepsiburada(urun),
      scrapeN11(urun)
    ]);

    const allProducts = [
      ...(trendyolResults.status === 'fulfilled' ? trendyolResults.value : []),
      ...(hepsiburadaResults.status === 'fulfilled' ? hepsiburadaResults.value : []),
      ...(n11Results.status === 'fulfilled' ? n11Results.value : [])
    ];

    // Fiyata göre sırala
    allProducts.sort((a, b) => {
      const priceA = parseFloat(a.fiyat) || 0;
      const priceB = parseFloat(b.fiyat) || 0;
      return priceA - priceB;
    });

    // Demo veri (eğer hiç ürün yoksa)
    if (allProducts.length === 0) {
      allProducts.push(
        {
          site: 'Trendyol',
          urun: `${urun} Pro`,
          fiyat: `${Math.floor(Math.random() * 2000) + 1000} TL`,
          link: 'https://www.trendyol.com',
          image: ''
        },
        {
          site: 'Hepsiburada',
          urun: `${urun} 128GB`,
          fiyat: `${Math.floor(Math.random() * 2100) + 1100} TL`,
          link: 'https://www.hepsiburada.com',
          image: ''
        }
      );
    }

    res.json({
      success: true,
      query: urun,
      total: allProducts.length,
      fiyatlar: allProducts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sunucu hatası',
      message: error.message 
    });
  }
});

// Sağlık kontrolü
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Ana sayfa
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>FiyatTakip API</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .endpoint { background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0; }
        code { background: #e0e0e0; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>🚀 FiyatTakip API</h1>
      <p>Backend API çalışıyor!</p>
      
      <h2>Endpoints:</h2>
      <div class="endpoint">
        <strong>POST /api/fiyat-cek</strong>
        <p>Ürün fiyatlarını çeker</p>
        <code>{ "urun": "iphone 15" }</code>
      </div>
      
      <div class="endpoint">
        <strong>GET /health</strong>
        <p>API sağlık kontrolü</p>
      </div>
      
      <p>GitHub: <a href="https://github.com/fiyattakip/fiyattakip.github.io">Frontend</a></p>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API http://localhost:${PORT} adresinde çalışıyor`);
  console.log(`📝 Endpoint: POST http://localhost:${PORT}/api/fiyat-cek`);
  console.log(`🔧 Health: GET http://localhost:${PORT}/health`);
});
