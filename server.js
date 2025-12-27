const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Cache mekanizması
let priceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

// TRENDYOL API kullanımı (daha güvenilir)
async function getTrendyolPrices(productName) {
  try {
    // Trendyol'un arama API'si
    const searchUrl = `https://api.trendyol.com/sr?q=${encodeURIComponent(productName)}&pi=1`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://www.trendyol.com',
        'Referer': 'https://www.trendyol.com/'
      },
      timeout: 10000
    });

    // API yanıtını parse et
    const products = [];
    
    if (response.data && response.data.products) {
      response.data.products.slice(0, 3).forEach(product => {
        if (product.name && product.price && product.url) {
          products.push({
            site: "Trendyol",
            urun: product.name.substring(0, 60),
            fiyat: `${product.price.sellingPrice?.text || product.price.discountedPrice?.text || 'Fiyat bilgisi yok'}`,
            link: product.url.startsWith('http') ? product.url : `https://www.trendyol.com${product.url}`,
            image: product.imageUrl,
            rating: product.ratingScore?.averageRating || 0
          });
        }
      });
    }

    return products.length > 0 ? products : [
      {
        site: "Trendyol",
        urun: productName,
        fiyat: "Fiyat için siteye git →",
        link: `https://www.trendyol.com/sr?q=${encodeURIComponent(productName)}`,
        not: "Canlı fiyat için tıkla"
      }
    ];
  } catch (error) {
    console.error('Trendyol API error:', error.message);
    return [
      {
        site: "Trendyol",
        urun: productName,
        fiyat: "Fiyat için siteye git →",
        link: `https://www.trendyol.com/sr?q=${encodeURIComponent(productName)}`
      }
    ];
  }
}

// Hepsiburada API
async function getHepsiburadaPrices(productName) {
  try {
    const searchUrl = `https://www.hepsiburada.com/ara?q=${encodeURIComponent(productName)}`;
    
    // Hepsiburada için HTML'den çekmek yerine daha basit
    return [
      {
        site: "Hepsiburada",
        urun: productName,
        fiyat: "Fiyatları gör →",
        link: searchUrl,
        not: "Siteden kontrol et"
      }
    ];
  } catch (error) {
    return [
      {
        site: "Hepsiburada",
        urun: productName,
        fiyat: "Siteye git →",
        link: `https://www.hepsiburada.com/ara?q=${encodeURIComponent(productName)}`
      }
    ];
  }
}

// n11 API
async function getN11Prices(productName) {
  return [
    {
      site: "n11",
      urun: productName,
      fiyat: "Fiyat karşılaştır →",
      link: `https://www.n11.com/arama?q=${encodeURIComponent(productName)}`,
      not: "Tıkla ve fiyatları gör"
    }
  ];
}

// Amazon API
async function getAmazonPrices(productName) {
  return [
    {
      site: "Amazon",
      urun: productName,
      fiyat: "Amazon'da kontrol et →",
      link: `https://www.amazon.com.tr/s?k=${encodeURIComponent(productName)}`,
      not: "Amazon fiyatları için"
    }
  ];
}

// Teknosa
async function getTeknosaPrices(productName) {
  return [
    {
      site: "Teknosa",
      urun: productName,
      fiyat: "Teknosa'da gör →",
      link: `https://www.teknosa.com/arama/?q=${encodeURIComponent(productName)}`,
      not: "Teknosa fiyatları"
    }
  ];
}

// Vatan Bilgisayar
async function getVatanPrices(productName) {
  return [
    {
      site: "Vatan",
      urun: productName,
      fiyat: "Vatan'da kontrol et →",
      link: `https://www.vatanbilgisayar.com/arama/${encodeURIComponent(productName)}/`,
      not: "Vatan fiyatları"
    }
  ];
}

// AKILLI FİYAT SİSTEMİ - GOOGLE SHOPPING BENZERİ
async function getSmartPrices(productName) {
  try {
    // Google Shopping API benzeri
    // Burada daha akıllı bir sistem kurabiliriz
    const searchQueries = [
      `${productName} fiyat`,
      `${productName} en ucuz`,
      `${productName} ne kadar`
    ];

    // Farklı siteler için linkler oluştur
    const sites = [
      {
        name: "Google Shopping",
        url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(productName)}`,
        icon: "🔍"
      },
      {
        name: "Epey",
        url: `https://www.epey.com/${encodeURIComponent(productName.replace(/\s+/g, '-'))}.html`,
        icon: "📊"
      },
      {
        name: "Cimri",
        url: `https://www.cimri.com/${encodeURIComponent(productName)}`,
        icon: "💰"
      },
      {
        name: "PriceRunner",
        url: `https://www.pricerunner.com/results?q=${encodeURIComponent(productName)}`,
        icon: "🏃"
      }
    ];

    return sites.map(site => ({
      site: site.name,
      urun: productName,
      fiyat: `${site.icon} Fiyat karşılaştır`,
      link: site.url,
      not: "Fiyat karşılaştırma sitesi"
    }));
  } catch (error) {
    return [];
  }
}

// ANA API ENDPOINT
app.post('/api/fiyat-cek', async (req, res) => {
  try {
    const urun = req.body.urun || "iphone 13";
    console.log(`🔍 Aranan ürün: ${urun}`);

    // Cache kontrolü
    const cacheKey = urun.toLowerCase();
    const cached = priceCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('Cache hit!');
      return res.json(cached.data);
    }

    // Tüm kaynaklardan veri çek
    const [trendyolResults, smartPrices] = await Promise.allSettled([
      getTrendyolPrices(urun),
      getSmartPrices(urun)
    ]);

    const fiyatlar = [];

    // Trendyol sonuçları
    if (trendyolResults.status === 'fulfilled' && trendyolResults.value) {
      fiyatlar.push(...trendyolResults.value);
    } else {
      fiyatlar.push({
        site: "Trendyol",
        urun: urun,
        fiyat: "Fiyat için tıkla →",
        link: `https://www.trendyol.com/sr?q=${encodeURIComponent(urun)}`
      });
    }

    // Akıllı fiyat sonuçları
    if (smartPrices.status === 'fulfilled' && smartPrices.value) {
      fiyatlar.push(...smartPrices.value.slice(0, 2));
    }

    // Diğer siteler (hızlı erişim için)
    fiyatlar.push(
      {
        site: "Hepsiburada",
        urun: urun,
        fiyat: "Fiyatları gör →",
        link: `https://www.hepsiburada.com/ara?q=${encodeURIComponent(urun)}`,
        not: "Hızlı karşılaştır"
      },
      {
        site: "n11",
        urun: urun,
        fiyat: "Fiyat karşılaştır →",
        link: `https://www.n11.com/arama?q=${encodeURIComponent(urun)}`,
        not: "Çoklu satıcı"
      }
    );

    // Benzersiz sonuçlar
    const uniqueResults = Array.from(new Map(fiyatlar.map(item => [item.site, item])).values());

    const response = {
      success: true,
      query: urun,
      fiyatlar: uniqueResults,
      timestamp: new Date().toISOString(),
      count: uniqueResults.length,
      not: "Fiyatları görmek için linklere tıklayın",
      tips: [
        "Fiyatlar anlık değişebilir",
        "Kampanyaları kontrol edin",
        "Kargo ücretlerine dikkat edin"
      ]
    };

    // Cache'e kaydet
    priceCache.set(cacheKey, {
      timestamp: Date.now(),
      data: response
    });

    // Cache temizleme (eski kayıtları sil)
    if (priceCache.size > 100) {
      const oldestKey = Array.from(priceCache.keys())[0];
      priceCache.delete(oldestKey);
    }

    res.json(response);

  } catch (error) {
    console.error('API error:', error.message);
    
    // Fallback yanıt
    res.json({
      success: true,
      query: req.body.urun || "ürün",
      fiyatlar: [
        {
          site: "Trendyol",
          urun: req.body.urun || "Ürün",
          fiyat: "Fiyatları gör →",
          link: `https://www.trendyol.com/sr?q=${encodeURIComponent(req.body.urun || "telefon")}`
        },
        {
          site: "Hepsiburada",
          urun: req.body.urun || "Ürün",
          fiyat: "Hepsiburada'da ara →",
          link: `https://www.hepsiburada.com/ara?q=${encodeURIComponent(req.body.urun || "telefon")}`
        }
      ],
      timestamp: new Date().toISOString(),
      not: "Doğrudan sitelere yönlendiriliyorsunuz"
    });
  }
});

// ÖNERİLEN ARAMALAR
app.get('/api/oneriler', (req, res) => {
  const suggestions = [
    { urun: "iphone 15", tip: "popüler" },
    { urun: "samsung galaxy s24", tip: "yeni çıkan" },
    { urun: "airpods pro", tip: "aksesuar" },
    { urun: "macbook air m2", tip: "bilgisayar" },
    { urun: "playstation 5", tip: "oyun" },
    { urun: "xiaomi redmi note", tip: "uygun fiyat" },
    { urun: "huawei p smart", tip: "orta seviye" },
    { urun: "logitech mouse", tip: "çevre birimi" }
  ];
  
  res.json({
    success: true,
    oneriler: suggestions,
    not: "Bu ürünlerde fiyat karşılaştırması yapabilirsiniz"
  });
});

// POPÜLER ÜRÜNLER
app.get('/api/populer', (req, res) => {
  res.json({
    success: true,
    urunler: [
      {
        name: "Apple iPhone 15 Pro",
        image: "📱",
        link: "https://www.trendyol.com/sr?q=iphone+15+pro"
      },
      {
        name: "Samsung Galaxy S24 Ultra",
        image: "📲",
        link: "https://www.hepsiburada.com/ara?q=samsung+s24+ultra"
      },
      {
        name: "PlayStation 5 Slim",
        image: "🎮",
        link: "https://www.n11.com/arama?q=playstation+5+slim"
      },
      {
        name: "MacBook Air M3",
        image: "💻",
        link: "https://www.vatanbilgisayar.com/arama/macbook+air+m3/"
      }
    ]
  });
});

// Sağlık kontrolü
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    time: new Date().toISOString(),
    service: 'FiyatTakip API v3.0',
    features: ['Cache', 'Smart Links', 'Multi-site'],
    cacheSize: priceCache.size,
    uptime: process.uptime()
  });
});

// Cache temizleme
app.get('/api/cache-temizle', (req, res) => {
  const oldSize = priceCache.size;
  priceCache.clear();
  res.json({
    success: true,
    message: `Cache temizlendi (${oldSize} kayıt silindi)`,
    newSize: priceCache.size
  });
});

// Ana sayfa
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>FiyatTakip API v3.0</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
          color: #333;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          backdrop-filter: blur(10px);
        }
        header {
          text-align: center;
          margin-bottom: 40px;
        }
        h1 {
          font-size: 3rem;
          background: linear-gradient(45deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 10px;
        }
        .tagline {
          font-size: 1.2rem;
          color: #666;
          margin-bottom: 30px;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .feature-card {
          background: white;
          padding: 25px;
          border-radius: 15px;
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
          transition: transform 0.3s;
          text-align: center;
        }
        .feature-card:hover {
          transform: translateY(-5px);
        }
        .feature-card h3 {
          color: #667eea;
          margin-bottom: 15px;
          font-size: 1.3rem;
        }
        .test-area {
          background: #f8f9fa;
          padding: 30px;
          border-radius: 15px;
          margin: 30px 0;
        }
        input[type="text"] {
          width: 100%;
          padding: 15px;
          border: 2px solid #ddd;
          border-radius: 10px;
          font-size: 1.1rem;
          margin-bottom: 15px;
          transition: border-color 0.3s;
        }
        input[type="text"]:focus {
          outline: none;
          border-color: #667eea;
        }
        button {
          background: linear-gradient(45deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 10px;
          font-size: 1.1rem;
          cursor: pointer;
          transition: transform 0.3s, box-shadow 0.3s;
          width: 100%;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }
        .results {
          margin-top: 30px;
          display: none;
        }
        .result-card {
          background: white;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 15px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.1);
          border-left: 5px solid #667eea;
        }
        .site-badge {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 0.9rem;
          margin-bottom: 10px;
        }
        .price {
          font-size: 1.5rem;
          color: #2d3748;
          font-weight: bold;
          margin: 10px 0;
        }
        .product-name {
          color: #4a5568;
          margin: 10px 0;
        }
        .link-btn {
          display: inline-block;
          background: #48bb78;
          color: white;
          padding: 8px 20px;
          border-radius: 5px;
          text-decoration: none;
          margin-top: 10px;
          transition: background 0.3s;
        }
        .link-btn:hover {
          background: #38a169;
        }
        .endpoints {
          background: #edf2f7;
          padding: 25px;
          border-radius: 15px;
          margin-top: 40px;
        }
        .endpoint {
          margin: 15px 0;
          padding: 15px;
          background: white;
          border-radius: 10px;
        }
        code {
          background: #e2e8f0;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
        }
        footer {
          text-align: center;
          margin-top: 40px;
          color: #718096;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
        @media (max-width: 768px) {
          .container { padding: 20px; }
          h1 { font-size: 2rem; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>💰 FiyatTakip API</h1>
          <p class="tagline">Akıllı fiyat karşılaştırma sistemi • Gerçek zamanlı yönlendirme</p>
        </header>

        <div class="features">
          <div class="feature-card">
            <h3>🎯 Akıllı Yönlendirme</h3>
            <p>Doğrudan ürün arama sayfalarına yönlendirir</p>
          </div>
          <div class="feature-card">
            <h3>⚡ Hızlı Erişim</h3>
            <p>5+ farklı sitede anında arama</p>
          </div>
          <div class="feature-card">
            <h3>🔒 Güvenilir Linkler</h3>
            <p>Resmi site linkleri ile güvenli alışveriş</p>
          </div>
        </div>

        <div class="test-area">
          <h2>🔍 Ürün Fiyatlarını Karşılaştır</h2>
          <input type="text" id="urunInput" placeholder="Örn: iPhone 15 Pro, Samsung Galaxy S24, PlayStation 5..." value="airpods pro">
          <button onclick="testAPI()">🚀 Fiyatları Karşılaştır</button>
          
          <div id="results" class="results">
            <h3>📊 Karşılaştırma Sonuçları</h3>
            <div id="resultsContainer"></div>
          </div>
        </div>

        <div class="endpoints">
          <h2>📡 API Endpoint'leri</h2>
          <div class="endpoint">
            <strong>POST</strong> <code>/api/fiyat-cek</code>
            <p>Body: <code>{"urun": "ürün adı"}</code></p>
          </div>
          <div class="endpoint">
            <strong>GET</strong> <code>/api/oneriler</code>
            <p>Popüler ürün önerileri</p>
          </div>
          <div class="endpoint">
            <strong>GET</strong> <code>/health</code>
            <p>API sağlık durumu</p>
          </div>
        </div>

        <footer>
          <p>FiyatTakip API v3.0 • Mobil uygulama için optimize edilmiştir</p>
          <p>GitHub: <a href="https://github.com/fiyattakip/fiyattakip-api" target="_blank">fiyattakip-api</a></p>
        </footer>
      </div>

      <script>
        async function testAPI() {
          const urun = document.getElementById('urunInput').value || 'airpods pro';
          const resultsDiv = document.getElementById('results');
          const container = document.getElementById('resultsContainer');
          
          resultsDiv.style.display = 'block';
          container.innerHTML = '<p>⏳ Fiyatlar karşılaştırılıyor...</p>';
          
          try {
            const response = await fetch('/api/fiyat-cek', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urun: urun })
            });
            
            const data = await response.json();
            
            if (data.success && data.fiyatlar && data.fiyatlar.length > 0) {
              let html = '';
              data.fiyatlar.forEach(item => {
                html += \`
                  <div class="result-card">
                    <span class="site-badge">\${item.site}</span>
                    <div class="product-name">\${item.urun}</div>
                    <div class="price">\${item.fiyat}</div>
                    <a href="\${item.link}" target="_blank" class="link-btn">🔗 Siteye Git</a>
                    \${item.not ? '<p><small>' + item.not + '</small></p>' : ''}
                  </div>
                \`;
              });
              
              html += \`<p><small>\${data.count} farklı kaynak • \${new Date(data.timestamp).toLocaleTimeString('tr-TR')}</small></p>\`;
              container.innerHTML = html;
            } else {
              container.innerHTML = '<p>❌ Sonuç bulunamadı</p>';
            }
          } catch (error) {
            container.innerHTML = '<p>❌ API bağlantı hatası</p>';
          }
        }

        // Enter tuşu ile arama
        document.getElementById('urunInput').addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            testAPI();
          }
        });

        // Sayfa yüklendiğinde örnek göster
        window.onload = function() {
          setTimeout(() => {
            if (document.getElementById('urunInput').value) {
              testAPI();
            }
          }, 500);
        };
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 FiyatTakip API v3.0 ${PORT} portunda çalışıyor`);
  console.log(`💰 AKILLI FİYAT SİSTEMİ AKTİF`);
  console.log(`🎯 Özellikler: Cache, Smart Links, Multi-site`);
  console.log(`🔗 Ana sayfa: http://localhost:${PORT}`);
});
