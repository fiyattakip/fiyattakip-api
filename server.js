const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// Anti-bot bypass için özel headers
const getRandomHeaders = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  ];

  return {
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'DNT': '1',
    'Referer': 'https://www.google.com/'
  };
};

// Delay fonksiyonu (rate limiting bypass)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Proxy rotasyonu için (ücretsiz proxy listesi)
const proxies = [
  '', // Direct connection (no proxy)
  'https://cors-anywhere.herokuapp.com/',
  'https://api.allorigins.win/raw?url='
];

// Gelişmiş scraper fonksiyonu
const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const proxy = proxies[Math.floor(Math.random() * proxies.length)];
      const targetUrl = proxy ? proxy + encodeURIComponent(url) : url;
      
      // Rastgele delay (1-3 saniye)
      await delay(1000 + Math.random() * 2000);
      
      const response = await axios.get(targetUrl, {
        ...options,
        headers: getRandomHeaders(),
        timeout: 15000,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(2000); // Retry öncesi bekle
    }
  }
};

// TRENDYOL - Güncellenmiş selector'lar
async function getTrendyolPrices(productName) {
  try {
    const searchUrl = `https://www.trendyol.com/sr?q=${encodeURIComponent(productName)}&qt=${encodeURIComponent(productName)}&st=${encodeURIComponent(productName)}&os=1`;
    
    const response = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(response.data);
    const products = [];
    
    // Birden fazla selector deneyelim
    const selectors = [
      'div[data-testid="product-card"]',
      'div.p-card-chldrn-cntnr',
      'div.p-card-wrppr'
    ];
    
    let selectedSelector = null;
    for (const selector of selectors) {
      if ($(selector).length > 0) {
        selectedSelector = selector;
        break;
      }
    }
    
    if (selectedSelector) {
      $(selectedSelector).each((i, element) => {
        if (products.length >= 3) return false;
        
        // Farklı title selector'ları
        const title = $(element).find('span.prdct-desc-cntnr-name, div.prdct-desc-cntnr-name, a.prdct-desc-cntnr-name').first().text().trim();
        
        // Farklı price selector'ları
        const price = $(element).find('div.prc-box-dscntd, div.product-price, div.discountedPrice').first().text().trim();
        
        // Link bulma
        let link = $(element).find('a').attr('href') || 
                  $(element).find('div[data-testid="product-card-name"] a').attr('href') ||
                  $(element).closest('a').attr('href');
        
        if (title && price) {
          products.push({
            site: "Trendyol",
            urun: title.substring(0, 60),
            fiyat: price.replace(/\s+/g, ' '),
            link: link ? (link.startsWith('http') ? link : `https://www.trendyol.com${link}`) : searchUrl
          });
        }
      });
    }
    
    return products;
  } catch (error) {
    console.error('Trendyol error:', error.message);
    return [];
  }
}

// HEPSİBURADA - Güncellenmiş
async function getHepsiburadaPrices(productName) {
  try {
    const searchUrl = `https://www.hepsiburada.com/ara?q=${encodeURIComponent(productName)}`;
    
    const response = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(response.data);
    const products = [];
    
    // Hepsiburada için selector'lar
    $('li[data-testid="product-card"], li.search-item, div.moria-ProductCard').each((i, element) => {
      if (products.length >= 3) return false;
      
      const title = $(element).find('h3[data-testid="product-title"], span[data-testid="product-card-name"], div.product-title').first().text().trim();
      const price = $(element).find('div[data-testid="price-current-price"], div.price-value, span.price').first().text().trim();
      let link = $(element).find('a').attr('href') || 
                $(element).find('div[data-testid="product-card-name"] a').attr('href');
    
      if (title && price) {
        products.push({
          site: "Hepsiburada",
          urun: title.substring(0, 60),
          fiyat: price.replace(/\s+/g, ' ') + ' TL',
          link: link ? (link.startsWith('http') ? link : `https://www.hepsiburada.com${link}`) : searchUrl
        });
      }
    });
    
    return products;
  } catch (error) {
    console.error('Hepsiburada error:', error.message);
    return [];
  }
}

// N11 - Güncellenmiş
async function getN11Prices(productName) {
  try {
    const searchUrl = `https://www.n11.com/arama?q=${encodeURIComponent(productName)}`;
    
    const response = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(response.data);
    const products = [];
    
    $('.listItem, .column, .product').each((i, element) => {
      if (products.length >= 3) return false;
      
      const title = $(element).find('.productName, .title, h3, .name').first().text().trim();
      const price = $(element).find('.newPrice, .priceContainer, .priceText, ins').first().text().trim();
      const link = $(element).find('a').attr('href');
      
      if (title && price) {
        products.push({
          site: "n11",
          urun: title.substring(0, 60),
          fiyat: price.replace(/\s+/g, ' '),
          link: link || searchUrl
        });
      }
    });
    
    return products;
  } catch (error) {
    console.error('n11 error:', error.message);
    return [];
  }
}

// AMAZON TR (ekstra site)
async function getAmazonPrices(productName) {
  try {
    const searchUrl = `https://www.amazon.com.tr/s?k=${encodeURIComponent(productName)}&__mk_tr_TR=%C3%85M%C3%85%C5%BD%C3%95%C3%91&ref=nb_sb_noss`;
    
    const response = await fetchWithRetry(searchUrl, {
      headers: {
        ...getRandomHeaders(),
        'Host': 'www.amazon.com.tr',
        'Accept-Encoding': 'identity'
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    $('.s-result-item, .s-card-container').each((i, element) => {
      if (products.length >= 2) return false;
      
      const title = $(element).find('h2 a span').text().trim();
      const priceWhole = $(element).find('.a-price-whole').text().trim();
      const priceFraction = $(element).find('.a-price-fraction').text().trim();
      const link = $(element).find('h2 a').attr('href');
      
      if (title && (priceWhole || priceFraction)) {
        const price = priceWhole && priceFraction ? `${priceWhole}.${priceFraction} TL` : priceWhole || priceFraction;
        
        products.push({
          site: "Amazon",
          urun: title.substring(0, 60),
          fiyat: price,
          link: link ? `https://www.amazon.com.tr${link}` : searchUrl
        });
      }
    });
    
    return products;
  } catch (error) {
    console.error('Amazon error:', error.message);
    return [];
  }
}

// ANA API ENDPOINT
app.post('/api/fiyat-cek', async (req, res) => {
  try {
    const urun = req.body.urun || "iphone 13";
    console.log(`🔍 Aranan ürün: ${urun}`);
    
    // Tüm sitelerden paralel veri çek (timeout ile)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 30000)
    );
    
    const scrapersPromise = Promise.allSettled([
      getTrendyolPrices(urun),
      getHepsiburadaPrices(urun),
      getN11Prices(urun),
      getAmazonPrices(urun)
    ]);
    
    const [trendyolResults, hepsiburadaResults, n11Results, amazonResults] = 
      await Promise.race([scrapersPromise, timeoutPromise]);
    
    // Sonuçları birleştir
    const fiyatlar = [];
    
    const addResults = (results, siteName) => {
      if (results.status === 'fulfilled' && results.value && results.value.length > 0) {
        fiyatlar.push(...results.value);
      } else {
        console.warn(`${siteName} veri çekemedi`);
        // Fallback link
        const fallbackLinks = {
          'Trendyol': `https://www.trendyol.com/sr?q=${encodeURIComponent(urun)}`,
          'Hepsiburada': `https://www.hepsiburada.com/ara?q=${encodeURIComponent(urun)}`,
          'n11': `https://www.n11.com/arama?q=${encodeURIComponent(urun)}`,
          'Amazon': `https://www.amazon.com.tr/s?k=${encodeURIComponent(urun)}`
        };
        
        fiyatlar.push({
          site: siteName,
          urun: `${urun}`,
          fiyat: "Ürün listeleniyor...",
          link: fallbackLinks[siteName],
          not: "Canlı veriye ulaşılamadı"
        });
      }
    };
    
    addResults(trendyolResults || {}, 'Trendyol');
    addResults(hepsiburadaResults || {}, 'Hepsiburada');
    addResults(n11Results || {}, 'n11');
    addResults(amazonResults || {}, 'Amazon');
    
    // Benzersiz ürünler (link'e göre)
    const uniqueProducts = [];
    const seenLinks = new Set();
    
    for (const product of fiyatlar) {
      if (!seenLinks.has(product.link)) {
        seenLinks.add(product.link);
        uniqueProducts.push(product);
      }
    }
    
    // Eğer hiç veri yoksa fallback
    const finalProducts = uniqueProducts.length > 0 ? uniqueProducts : [
      {
        site: "Trendyol",
        urun: `${urun}`,
        fiyat: "Fiyat kontrolü için siteye git",
        link: `https://www.trendyol.com/sr?q=${encodeURIComponent(urun)}`,
        not: "Tıklayarak ürünü gör"
      },
      {
        site: "Hepsiburada",
        urun: `${urun}`,
        fiyat: "Fiyat kontrolü için siteye git",
        link: `https://www.hepsiburada.com/ara?q=${encodeURIComponent(urun)}`,
        not: "Tıklayarak ürünü gör"
      }
    ];
    
    res.json({
      success: true,
      query: urun,
      fiyatlar: finalProducts,
      timestamp: new Date().toISOString(),
      count: finalProducts.length,
      not: "Anti-bot bypass aktif. Linkler doğrudan ürün sayfalarına yönlendirir."
    });
    
  } catch (error) {
    console.error('API error:', error.message);
    res.status(500).json({
      success: false,
      error: "Sunucu zaman aşımı",
      fiyatlar: [
        {
          site: "Trendyol",
          urun: req.body.urun || "Ürün",
          fiyat: "Siteye git →",
          link: `https://www.trendyol.com/sr?q=${encodeURIComponent(req.body.urun || "iphone")}`
        }
      ]
    });
  }
});

// Hızlı test endpoint'i
app.get('/api/test/:urun?', async (req, res) => {
  const urun = req.params.urun || "samsung galaxy";
  res.json(await getTrendyolPrices(urun));
});

// Sağlık kontrolü
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    time: new Date().toISOString(),
    service: 'FiyatTakip API v2.0',
    features: ['Anti-bot bypass', 'Multi-site', 'Real-time scraping']
  });
});

// Ana sayfa
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>FiyatTakip API v2.0</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; max-width: 1000px; margin: 0 auto; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .endpoint { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #4CAF50; }
        code { background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
        .feature { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 5px 10px; border-radius: 20px; margin: 5px; font-size: 14px; }
        .test-form { background: #e3f2fd; padding: 20px; border-radius: 10px; }
        input, button { padding: 10px; margin: 5px; border-radius: 5px; border: 1px solid #ddd; }
        button { background: #4CAF50; color: white; border: none; cursor: pointer; }
        button:hover { background: #45a049; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 FiyatTakip API v2.0</h1>
        <p>Gerçek zamanlı fiyat takip API servisi - <strong>Anti-bot bypass aktif</strong></p>
        
        <div>
          <span class="feature">Trendyol</span>
          <span class="feature">Hepsiburada</span>
          <span class="feature">n11</span>
          <span class="feature">Amazon</span>
          <span class="feature">Real-time</span>
          <span class="feature">Anti-bot</span>
        </div>
        
        <div class="endpoint">
          <h3>📊 FİYAT ÇEKME</h3>
          <p><strong>POST</strong> <code>/api/fiyat-cek</code></p>
          <p><strong>Body:</strong> <code>{"urun": "iphone 13 pro"}</code></p>
          <p><strong>Desteklenen siteler:</strong> Trendyol, Hepsiburada, n11, Amazon</p>
        </div>
        
        <div class="test-form">
          <h3>🎯 Hızlı Test</h3>
          <input type="text" id="urunInput" placeholder="Ürün adı girin (örn: airpods pro)" value="airpods">
          <button onclick="testAPI()">Test Et</button>
          <div id="testResult" style="margin-top: 15px;"></div>
        </div>
        
        <div class="endpoint">
          <h3>💓 Sağlık Kontrolü</h3>
          <p><strong>GET</strong> <code>/health</code></p>
          <p><a href="/health" target="_blank">Test et</a></p>
        </div>
        
        <div class="endpoint">
          <h3>⚡ Hızlı Test Endpoint</h3>
          <p><strong>GET</strong> <code>/api/test/ürün-adı</code></p>
          <p>Örnek: <a href="/api/test/samsung" target="_blank">/api/test/samsung</a></p>
        </div>
        
        <p>GitHub: <a href="https://github.com/fiyattakip/fiyattakip-api" target="_blank">fiyattakip-api</a></p>
      </div>
      
      <script>
        async function testAPI() {
          const urun = document.getElementById('urunInput').value || 'airpods';
          const resultDiv = document.getElementById('testResult');
          resultDiv.innerHTML = '<p>⏳ Test ediliyor...</p>';
          
          try {
            const response = await fetch('/api/fiyat-cek', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urun: urun })
            });
            
            const data = await response.json();
            
            let html = '<h4>Sonuçlar:</h4>';
            if (data.success && data.fiyatlar && data.fiyatlar.length > 0) {
              html += '<ul>';
              data.fiyatlar.forEach(item => {
                html += \`<li><strong>\${item.site}:</strong> \${item.urun} - \${item.fiyat} <a href="\${item.link}" target="_blank">→ Git</a></li>\`;
              });
              html += '</ul>';
              html += \`<p><small>\${data.count} sonuç bulundu</small></p>\`;
            } else {
              html += '<p>❌ Sonuç bulunamadı</p>';
            }
            
            resultDiv.innerHTML = html;
          } catch (error) {
            resultDiv.innerHTML = '<p>❌ API hatası</p>';
          }
        }
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API v2.0 ${PORT} portunda çalışıyor`);
  console.log(`🛡️  Anti-bot bypass aktif`);
  console.log(`🌐 Desteklenen siteler: Trendyol, Hepsiburada, n11, Amazon`);
});
