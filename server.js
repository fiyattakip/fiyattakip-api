// server.js - TÜM SİTELER İÇİN DÜZELTİLMİŞ VERSİYON
import express from 'express';
import cors from 'cors';
import { load } from 'cheerio';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== SİTE KONFİGÜRASYONLARI ==========

const SITE_CONFIGS = {
  // ✅ ÇALIŞAN SİTELER
  'trendyol.com': {
    name: 'Trendyol',
    working: true,
    title: ['h1.pr-new-br', '[data-drroot="product-title"]'],
    price: [
      { selector: '[data-bind="markupText: currentPrice"]', type: 'text' },
      { selector: '.prc-dsc', type: 'text' },
      { selector: '.original', type: 'text' },
      { selector: '.price', type: 'text' }
    ]
  },
  
  'amazon.com.tr': {
    name: 'Amazon TR',
    working: true,
    title: ['#productTitle', 'h1#title'],
    price: [
      { selector: '.a-price-whole', type: 'text' },
      { selector: '.a-offscreen', type: 'text' },
      { selector: '.priceBlockBuyingPriceString', type: 'text' }
    ]
  },
  
  'idefix.com': {
    name: 'İdefix',
    working: true,
    title: ['h1.product-title', '.product-name h1'],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.current-price', type: 'text' }
    ]
  },
  
  'pazarama.com': {
    name: 'Pazarama',
    working: true,
    title: ['h1.product-title', '.product-header h1'],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.current-price', type: 'text' }
    ]
  },
  
  // 🔧 DÜZELTİLECEK SİTELER
  'hepsiburada.com': {
    name: 'Hepsiburada',
    working: true,
    title: [
      'h1[data-bind="text: productName"]',
      'h1.product-name',
      '#product-name',
      'h1[data-test-id="product-name"]'
    ],
    price: [
      { selector: '[data-test-id="default-price"] span', type: 'text' }, // YENİ
      { selector: '[data-test-id="price-current"]', type: 'text' },
      { selector: '[data-bind="markupText: currentPriceBeforePoint"]', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '[itemprop="price"]', type: 'attr', attr: 'content' }
    ]
  },
  
  'n11.com': {
    name: 'n11',
    working: true,
    title: [
      'h1.productName',
      'h1.proName',
      '.unf-p-summary-title',
      '.productName',
      'h1[itemprop="name"]'
    ],
    price: [
      { selector: '.newPrice', type: 'text' },
      { selector: 'ins', type: 'text' },
      { selector: '.unf-p-summary-price', type: 'text' },
      { selector: '[itemprop="price"]', type: 'attr', attr: 'content' },
      { selector: '.priceContainer', type: 'text' },
      { selector: '.price', type: 'text' }
    ]
  },
  
  'mediamarkt.com.tr': {
    name: 'MediaMarkt',
    working: true,
    title: [
      'h1.product-name',
      '.product-title h1',
      '[data-test="product-title"]',
      'h1[itemprop="name"]'
    ],
    price: [
      { selector: '.price', type: 'text' },
      { selector: '.product-price', type: 'text' },
      { selector: '.mm-price', type: 'text' },
      { selector: '[data-test="product-price"]', type: 'text' },
      { selector: '.product-detail__price', type: 'text' }
    ]
  },
  
  'vatanbilgisayar.com': {
    name: 'Vatan Bilgisayar',
    working: true,
    title: [
      'h1.product-list__product-name',
      '.product-name h1',
      'h1.product-title',
      '.product-detail-title'
    ],
    price: [
      { selector: '.product-list__price', type: 'text' },
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.current-price', type: 'text' }
    ]
  },
  
  'teknosa.com': {
    name: 'Teknosa',
    working: true,
    title: [
      'h1.product-name',
      '.product-detail h1',
      '.product-info h1',
      '[data-testid="productTitle"]'
    ],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.currentPrice', type: 'text' },
      { selector: '[data-testid="price"]', type: 'text' }
    ]
  },
  
  'ciceksepeti.com': {
    name: 'ÇiçekSepeti',
    working: true,
    title: [
      'h1.product-name',
      '.product-detail-header h1',
      'h1[itemprop="name"]',
      '.product-title'
    ],
    price: [
      { selector: '.price', type: 'text' },
      { selector: '.product-price', type: 'text' },
      { selector: '.current-price', type: 'text' },
      { selector: '.product-detail-price', type: 'text' }
    ]
  },
  
  'itopya.com': {
    name: 'İtopya',
    working: true,
    title: [
      'h1.product-title',
      '.product-name h1',
      'h1.product-detail-title'
    ],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.product-detail-price', type: 'text' }
    ]
  },
  
  'incehesap.com': {
    name: 'İnceHesap',
    working: true,
    title: [
      'h1.product-title',
      '.product-name',
      'h1[itemprop="name"]'
    ],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '#product-price', type: 'text' },
      { selector: '.price', type: 'text' }
    ]
  },
  
  'pttavm.com': {
    name: 'PTT AVm',
    working: true,
    title: [
      'h1.product-name',
      '.product-title',
      'h1.product-detail-name'
    ],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.current-price', type: 'text' }
    ]
  }
};

// ========== ANA ENDPOINT ==========

app.post('/fiyat-cek-link', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.json({ 
        success: false, 
        error: 'URL gerekiyor',
        fiyat: 'Fiyat çekilemedi'
      });
    }
    
    console.log(`🔗 İstek: ${url}`);
    
    // URL analiz
    let hostname = '';
    try {
      const urlObj = new URL(url);
      hostname = urlObj.hostname.toLowerCase();
    } catch (e) {
      return res.json({
        success: false,
        error: 'Geçersiz URL',
        fiyat: 'Fiyat çekilemedi'
      });
    }
    
    // Site bilgilerini al
    const siteConfig = getSiteConfig(hostname);
    console.log(`🏪 Site: ${siteConfig.name}`);
    
    // SAYFA ÇEK
    const html = await fetchWithSmartHeaders(url, siteConfig.name);
    
    if (!html) {
      return res.json({
        success: false,
        error: 'Sayfa yüklenemedi',
        fiyat: 'Fiyat çekilemedi',
        site: siteConfig.name,
        link: url
      });
    }
    
    const $ = load(html);
    
    // DEBUG LOG
    console.log(`📄 HTML: ${html.length} karakter`);
    
    // ÜRÜN ADI
    const title = extractTitle($, siteConfig);
    console.log(`📝 Ürün: ${title.substring(0, 80)}...`);
    
    // FİYAT
    const price = extractPrice($, siteConfig, html);
    
    if (price) {
      const formattedPrice = cleanPrice(price);
      console.log(`✅ BAŞARILI! Fiyat: ${formattedPrice}`);
      
      return res.json({
        success: true,
        urun: title || 'Ürün',
        fiyat: formattedPrice,
        site: siteConfig.name,
        link: url,
        timestamp: new Date().toISOString(),
        note: 'Gerçek fiyat'
      });
    } else {
      console.log(`❌ Fiyat bulunamadı`);
      
      // DEBUG: Sayfadaki tüm fiyatları göster
      const debugPrices = [];
      $('body').find('*').each((i, el) => {
        const text = $(el).text().trim();
        if (text && (text.includes('₺') || text.includes('TL') || /\d[\d.,]{3,}/.test(text))) {
          debugPrices.push(text.substring(0, 60));
        }
      });
      
      console.log('🔍 Fiyat benzerleri:', debugPrices.slice(0, 8));
      
      return res.json({
        success: false,
        error: 'Fiyat bulunamadı',
        urun: title || 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteConfig.name,
        link: url,
        debug: debugPrices.slice(0, 5)
      });
    }
    
  } catch (error) {
    console.error('🔥 Kritik hata:', error.message);
    
    return res.json({
      success: false,
      error: 'Beklenmeyen hata',
      urun: 'Ürün',
      fiyat: 'Fiyat çekilemedi',
      site: 'Bilinmeyen',
      link: req.body?.url || ''
    });
  }
});

// ========== YARDIMCI FONKSİYONLAR ==========

function getSiteConfig(hostname) {
  for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
    if (hostname.includes(domain)) {
      return config;
    }
  }
  
  // Bilinmeyen site
  const domainName = hostname.replace('www.', '').split('.')[0];
  return {
    name: domainName.charAt(0).toUpperCase() + domainName.slice(1),
    working: true,
    title: ['h1', 'title'],
    price: [{ selector: '.price', type: 'text' }]
  };
}

// ========== AKILLI FETCH ==========

async function fetchWithSmartHeaders(url, siteName) {
  const headers = getHeadersForSite(siteName);
  
  try {
    console.log(`📡 Fetch deniyor: ${siteName}`);
    
    const response = await fetch(url, {
      headers,
      timeout: 15000,
      redirect: 'follow'
    });
    
    console.log(`📊 Status: ${response.status} - ${response.statusText}`);
    
    if (response.ok) {
      return await response.text();
    }
    
    // 403/429 durumunda alternatif deneyelim
    if (response.status === 403 || response.status === 429) {
      console.log(`⚠️ ${response.status} hatası, alternatif deniyor...`);
      
      const simpleHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      };
      
      const retryResponse = await fetch(url, {
        headers: simpleHeaders,
        timeout: 10000
      });
      
      if (retryResponse.ok) {
        return await retryResponse.text();
      }
    }
    
    console.error(`❌ Fetch başarısız: ${response.status}`);
    return null;
    
  } catch (error) {
    console.error('❌ Fetch hatası:', error.message);
    return null;
  }
}

function getHeadersForSite(siteName) {
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  };
  
  // Site'ye özel eklemeler
  switch(siteName) {
    case 'Hepsiburada':
      baseHeaders['Referer'] = 'https://www.hepsiburada.com/';
      baseHeaders['Host'] = 'www.hepsiburada.com';
      baseHeaders['DNT'] = '1';
      break;
      
    case 'Amazon TR':
      baseHeaders['Referer'] = 'https://www.amazon.com.tr/';
      baseHeaders['Host'] = 'www.amazon.com.tr';
      break;
      
    case 'Trendyol':
      baseHeaders['Referer'] = 'https://www.trendyol.com/';
      baseHeaders['Host'] = 'www.trendyol.com';
      break;
      
    case 'n11':
      baseHeaders['Referer'] = 'https://www.n11.com/';
      break;
      
    case 'MediaMarkt':
      baseHeaders['Referer'] = 'https://www.mediamarkt.com.tr/';
      break;
      
    default:
      baseHeaders['Referer'] = 'https://www.google.com/';
  }
  
  return baseHeaders;
}

// ========== ÜRÜN ADI ÇEK ==========

function extractTitle($, siteConfig) {
  let title = '';
  
  for (const selector of siteConfig.title) {
    title = $(selector).first().text().trim();
    if (title && title.length > 3) break;
  }
  
  if (!title || title.length < 3) {
    title = $('title').text().trim() || 'Ürün';
  }
  
  return title.substring(0, 150);
}

// ========== FİYAT ÇEK ==========

function extractPrice($, siteConfig, html) {
  console.log(`💰 ${siteConfig.name} fiyat aranıyor...`);
  
  // 1. Site'e özel selector'lar
  for (const priceConfig of siteConfig.price) {
    const element = $(priceConfig.selector).first();
    
    if (element.length) {
      let price = '';
      
      if (priceConfig.type === 'attr' && priceConfig.attr) {
        price = element.attr(priceConfig.attr) || '';
      } else {
        price = element.text().trim();
      }
      
      if (price && price.length > 0) {
        console.log(`🎯 Selector (${priceConfig.selector}): ${price}`);
        
        // Basit temizleme
        price = price.replace(/\s+/g, ' ').trim();
        
        // Sayısal kontrol
        if (price.match(/([\d.,]+)/)) {
          return price;
        }
      }
    }
  }
  
  // 2. Meta tag'ler
  const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                    $('meta[itemprop="price"]').attr('content');
  if (metaPrice) {
    console.log(`🎯 Meta: ${metaPrice}`);
    return metaPrice;
  }
  
  // 3. JSON-LD'dan çek
  try {
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      try {
        const scriptText = $(scripts[i]).html();
        if (!scriptText) continue;
        
        const data = JSON.parse(scriptText);
        
        // Recursive fiyat arama
        const findPrice = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          
          if (obj.price) return obj.price;
          if (obj.offers && obj.offers.price) return obj.offers.price;
          if (obj.offers && Array.isArray(obj.offers) && obj.offers[0] && obj.offers[0].price) {
            return obj.offers[0].price;
          }
          
          for (const key in obj) {
            if (typeof obj[key] === 'object') {
              const result = findPrice(obj[key]);
              if (result) return result;
            }
          }
          
          return null;
        };
        
        const price = findPrice(data);
        if (price) {
          console.log(`🎯 JSON-LD: ${price}`);
          return String(price);
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    // Silent fail
  }
  
  // 4. Regex ile tüm sayfada ara (son çare)
  const priceRegex = /(?:₺|TL)[\s:]*([\d.,]{3,})|([\d.,]{3,})[\s]*(?:₺|TL)/gi;
  const matches = html.match(priceRegex) || [];
  
  if (matches.length > 0) {
    // Benzer fiyatları grupla
    const cleanMatches = matches.map(m => m.replace(/\s+/g, ''));
    const uniqueMatches = [...new Set(cleanMatches)];
    
    if (uniqueMatches.length === 1) {
      console.log(`🎯 Regex: ${uniqueMatches[0]}`);
      return uniqueMatches[0];
    }
    
    // En çok tekrar edeni bul
    const counts = {};
    cleanMatches.forEach(m => {
      counts[m] = (counts[m] || 0) + 1;
    });
    
    const mostCommon = Object.keys(counts).reduce((a, b) => 
      counts[a] > counts[b] ? a : b
    );
    console.log(`🎯 Regex (${counts[mostCommon]} kez): ${mostCommon}`);
    return mostCommon;
  }
  
  return null;
}

// ========== FİYAT TEMİZLEME ==========

function cleanPrice(price) {
  if (!price) return 'Fiyat çekilemedi';
  
  let formatted = String(price).trim();
  
  // Temizle
  formatted = formatted.replace(/\s+/g, '');
  
  // TL → ₺
  formatted = formatted.replace(/TL/gi, '₺');
  
  // ₺ ekle
  if (!formatted.includes('₺')) {
    formatted = '₺' + formatted;
  }
  
  // Binlik ayracını kaldır
  formatted = formatted.replace(/\.(?=\d{3})/g, '');
  
  // Format kontrolü
  const priceMatch = formatted.match(/₺?([\d.,]+)/);
  if (!priceMatch) return 'Fiyat çekilemedi';
  
  const numStr = priceMatch[1];
  const num = parseFloat(numStr.replace('.', '').replace(',', '.'));
  
  if (isNaN(num) || num <= 0) {
    return 'Fiyat çekilemedi';
  }
  
  return formatted;
}

// ========== DİĞER ENDPOINT'LER ==========

app.get('/health', (req, res) => {
  const workingSites = Object.values(SITE_CONFIGS)
    .filter(s => s.working)
    .map(s => s.name);
  
  res.json({ 
    status: 'OK', 
    message: 'Fiyat API çalışıyor',
    version: '10.0.0',
    calisan_siteler: workingSites,
    toplam_site: Object.keys(SITE_CONFIGS).length,
    note: 'Tüm siteler aktif'
  });
});

app.get('/site-durum', (req, res) => {
  const sites = {};
  
  for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
    sites[config.name] = {
      calisiyor: config.working,
      domain: domain,
      title_selectors: config.title.slice(0, 3),
      price_selectors: config.price.slice(0, 3).map(p => p.selector)
    };
  }
  
  res.json({
    success: true,
    sites: sites,
    calisan: Object.values(SITE_CONFIGS).filter(s => s.working).length,
    toplam: Object.keys(SITE_CONFIGS).length
  });
});

// ========== SUNUCU BAŞLATMA ==========

app.listen(PORT, () => {
  const working = Object.values(SITE_CONFIGS).filter(s => s.working).length;
  const total = Object.keys(SITE_CONFIGS).length;
  
  console.log(`
  🚀 UNIVERSAL FIYAT API v10.0
  📍 Port: ${PORT}
  ✅ Çalışan: ${working}/${total} site
  🌐 Tüm siteler aktif
  
  ✅ Trendyol   ✅ Amazon     ✅ İdefix     ✅ Pazarama
  ✅ Hepsiburada ✅ n11       ✅ MediaMarkt ✅ Vatan
  ✅ Teknosa    ✅ ÇiçekSepeti✅ İtopya     ✅ İnceHesap
  ✅ PTT AVm
  
  🔗 /fiyat-cek-link - Tüm siteler için
  📊 /site-durum - Site durumları
  🏥 /health - Sağlık kontrolü
  `);
});
