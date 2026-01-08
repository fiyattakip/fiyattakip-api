// server.js - ÇALIŞAN SİTELER + DİĞERLERİ DÜZELT
import express from 'express';
import cors from 'cors';
import { load } from 'cheerio';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== ÇALIŞAN ve ÇALIŞMAYAN SİTELER ==========

const WORKING_SITES = {
  // ÇALIŞAN SİTELER
  'trendyol.com': {
    name: 'Trendyol',
    working: true,
    title: ['h1.pr-new-br', '[data-drroot="product-title"]'],
    price: [
      { selector: '[data-bind="markupText: currentPrice"]', type: 'text' },
      { selector: '.prc-dsc', type: 'text' },
      { selector: '.original', type: 'text' }, // 690 TL
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
  
  // ÇALIŞMAYAN SİTELER (DÜZELTİLECEK)
  'hepsiburada.com': {
    name: 'Hepsiburada',
    working: false,
    title: ['h1[data-bind="text: productName"]', 'h1.product-name'],
    price: [
      { selector: '#offering-price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.product-price', type: 'text' },
      { selector: '[itemprop="price"]', type: 'attr', attr: 'content' }
    ],
    problem: 'Selector değişmiş olabilir'
  },
  
  'n11.com': {
    name: 'n11',
    working: false,
    title: ['h1.productName', 'h1.proName'],
    price: [
      { selector: '.newPrice', type: 'text' },
      { selector: 'ins', type: 'text' },
      { selector: '.unf-p-summary-price', type: 'text' }
    ]
  },
  
  'mediamarkt.com.tr': {
    name: 'MediaMarkt',
    working: false,
    title: ['h1.product-name', '.product-title h1'],
    price: [
      { selector: '.price', type: 'text' },
      { selector: '.product-price', type: 'text' },
      { selector: '.mm-price', type: 'text' }
    ],
    problem: 'Bot engelleme'
  },
  
  'vatanbilgisayar.com': {
    name: 'Vatan Bilgisayar',
    working: false,
    title: ['h1.product-list__product-name', '.product-name h1'],
    price: [
      { selector: '.product-list__price', type: 'text' },
      { selector: '.product-price', type: 'text' }
    ]
  },
  
  'teknosa.com': {
    name: 'Teknosa',
    working: false,
    title: ['h1.product-name', '.product-detail h1'],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' }
    ]
  },
  
  'ciceksepeti.com': {
    name: 'ÇiçekSepeti',
    working: false,
    title: ['h1.product-name', '.product-detail-header h1'],
    price: [
      { selector: '.price', type: 'text' },
      { selector: '.product-price', type: 'text' }
    ]
  },
  
  'itopya.com': {
    name: 'İtopya',
    working: false,
    title: ['h1.product-title', '.product-name h1'],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' }
    ]
  },
  
  'incehesap.com': {
    name: 'İnceHesap',
    working: false,
    title: ['h1.product-title', '.product-name'],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '#product-price', type: 'text' }
    ]
  },
  
  'pttavm.com': {
    name: 'PTT AVm',
    working: false,
    title: ['h1.product-name', '.product-title'],
    price: [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' }
    ],
    problem: 'Bot engelleme'
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
    console.log(`🏪 Site: ${siteConfig.name} (Çalışıyor: ${siteConfig.working ? '✅' : '❌'})`);
    
    // ÇALIŞMAYAN SİTE UYARISI
    if (!siteConfig.working) {
      console.log(`⚠️ ${siteConfig.name} şu an çalışmıyor`);
      return res.json({
        success: false,
        error: `${siteConfig.name} şu an desteklenmiyor`,
        urun: 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteConfig.name,
        link: url,
        note: siteConfig.problem || 'Site yapısı değişmiş olabilir'
      });
    }
    
    // SAYFA ÇEK
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'tr-TR,tr;q=0.9'
    };
    
    let response;
    try {
      response = await fetch(url, { headers, timeout: 10000 });
      
      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}`);
        return res.json({
          success: false,
          error: `HTTP ${response.status}`,
          fiyat: 'Fiyat çekilemedi',
          site: siteConfig.name,
          link: url
        });
      }
      
    } catch (fetchError) {
      console.error('Fetch hatası:', fetchError.message);
      return res.json({
        success: false,
        error: 'Sayfa yüklenemedi',
        fiyat: 'Fiyat çekilemedi',
        site: siteConfig.name,
        link: url
      });
    }
    
    const html = await response.text();
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
  for (const [domain, config] of Object.entries(WORKING_SITES)) {
    if (hostname.includes(domain)) {
      return config;
    }
  }
  
  // Bilinmeyen site
  const domainName = hostname.replace('www.', '').split('.')[0];
  return {
    name: domainName.charAt(0).toUpperCase() + domainName.slice(1),
    working: false,
    title: ['h1', 'title'],
    price: [{ selector: '.price', type: 'text' }],
    problem: 'Desteklenmeyen site'
  };
}

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
  
  // 3. Regex ile tüm sayfada ara
  const priceRegex = /(?:₺|TL)\s*[\d.,]{3,}|[\d.,]{3,}\s*(?:₺|TL)/gi;
  const matches = html.match(priceRegex);
  
  if (matches && matches.length > 0) {
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
    
    const mostCommon = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    console.log(`🎯 Regex (${counts[mostCommon]} kez): ${mostCommon}`);
    return mostCommon;
  }
  
  return null;
}

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
  
  return formatted;
}

// ========== SİTE DURUMU ENDPOINT'İ ==========
app.get('/site-durum', (req, res) => {
  const sites = {};
  
  for (const [domain, config] of Object.entries(WORKING_SITES)) {
    sites[config.name] = {
      calisiyor: config.working,
      domain: domain,
      problem: config.problem || null
    };
  }
  
  res.json({
    success: true,
    sites: sites,
    calisan: Object.values(WORKING_SITES).filter(s => s.working).length,
    toplam: Object.keys(WORKING_SITES).length
  });
});

// ========== SELECTOR TEST ENDPOINT'İ ==========
app.post('/selector-test', async (req, res) => {
  try {
    const { url, selectors } = req.body;
    
    if (!url) {
      return res.json({ success: false, error: 'URL gerekiyor' });
    }
    
    console.log(`🧪 Selector test: ${url}`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    };
    
    const response = await fetch(url, { headers, timeout: 10000 });
    
    if (!response.ok) {
      return res.json({ success: false, error: `HTTP ${response.status}` });
    }
    
    const html = await response.text();
    const $ = load(html);
    
    const results = {};
    
    // Varsayılan selector'ları test et
    const defaultSelectors = [
      '.price', '.product-price', '#price', '[itemprop="price"]',
      '.current-price', '.newPrice', 'ins', '.fiyat',
      '.original', '.prc-dsc', '.a-price-whole'
    ];
    
    const testSelectors = selectors || defaultSelectors;
    
    for (const selector of testSelectors) {
      const elements = $(selector);
      results[selector] = {
        count: elements.length,
        values: []
      };
      
      elements.each((i, el) => {
        if (i < 3) { // İlk 3'ü göster
          results[selector].values.push({
            text: $(el).text().trim().substring(0, 100),
            html: $(el).html()?.substring(0, 150) || '',
            attrs: Object.keys(el.attribs).map(k => `${k}="${el.attribs[k]}"`).join(' ')
          });
        }
      });
    }
    
    // HTML'de fiyat benzeri text'ler
    const priceMatches = html.match(/(?:₺|TL)\s*[\d.,]{3,}|[\d.,]{3,}\s*(?:₺|TL)/gi) || [];
    
    return res.json({
      success: true,
      url: url,
      results: results,
      price_matches: priceMatches.slice(0, 10),
      html_length: html.length,
      sample_title: $('title').text().trim(),
      sample_h1: $('h1').first().text().trim()
    });
    
  } catch (error) {
    console.error('Test hatası:', error);
    return res.json({ success: false, error: error.message });
  }
});

// ========== DİĞER ENDPOINT'LER ==========

app.get('/health', (req, res) => {
  const workingSites = Object.values(WORKING_SITES).filter(s => s.working).map(s => s.name);
  
  res.json({ 
    status: 'OK', 
    message: 'Fiyat API çalışıyor',
    version: '9.0.0',
    calisan_siteler: workingSites,
    toplam_site: Object.keys(WORKING_SITES).length,
    note: 'Çalışmayan siteler için /selector-test ile debug yapın'
  });
});

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  const working = Object.values(WORKING_SITES).filter(s => s.working).length;
  const total = Object.keys(WORKING_SITES).length;
  
  console.log(`
  🚀 FIYAT API v9.0
  📍 Port: ${PORT}
  ✅ Çalışan: ${working}/${total} site
  🎯 Trendyol: ✅
  🎯 Amazon: ✅
  🎯 İdefix: ✅  
  🎯 Pazarama: ✅
  ❌ Diğerleri: Çalışmıyor
  🔧 /selector-test ile debug
  📊 /site-durum ile durum kontrol
  `);
});
