// server.js - NORMAL KULLANICI GİBİ DAVRANAN SİSTEM
import express from 'express';
import cors from 'cors';
import { load } from 'cheerio';

// IMPORT DÜZELTMESİ: node-fetch yerine normal fetch kullan
// Render.com'da node 18+ olduğu için fetch built-in

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== GERÇEK KULLANICI GİBİ HEADERS ==========
function getRealUserHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'DNT': '1'
  };
}

// ========== EPEY ve AKAÇKE'DEN FİYAT ÇEKME ==========
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
    
    console.log(`🌐 Sayfa açılıyor: ${url}`);
    
    // URL analizi
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
    
    const siteName = getSiteName(hostname);
    console.log(`🏪 Site: ${siteName}`);
    
    // ===== ÖZEL DURUMLAR =====
    
    // 1. EPEY.COM - Farklı yaklaşım
    if (hostname.includes('epey.com')) {
      return await handleEpey(url, res);
    }
    
    // 2. AKAÇKE.COM - Farklı yaklaşım  
    if (hostname.includes('akakce.com')) {
      return await handleAkakce(url, res);
    }
    
    // 3. DİĞER SİTELER - Normal fetch
    return await handleNormalSite(url, hostname, siteName, res);
    
  } catch (error) {
    console.error('❌ Genel hata:', error.message);
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

// ========== EPEY.COM HANDLER ==========
async function handleEpey(url, res) {
  console.log('🎯 Epey.com özel handler');
  
  try {
    // Epey genelde kolay, normal fetch
    const response = await fetch(url, {
      headers: getRealUserHeaders(),
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const $ = load(html);
    
    // Epey'de ürün adı
    let title = $('h1').first().text().trim() ||
                $('title').text().trim().replace(' - Epey.com', '');
    
    // Epey'de fiyat (genelde bu class'larda)
    let price = '';
    
    // Farklı epey fiyat selector'ları
    const priceSelectors = [
      '.price',
      '.fiyat',
      '.urun-fiyati',
      '.current-price',
      '[itemprop="price"]'
    ];
    
    for (const selector of priceSelectors) {
      const element = $(selector).first();
      if (element.length) {
        price = element.text().trim();
        if (price && price.length > 0) break;
      }
    }
    
    // Meta tag fallback
    if (!price) {
      price = $('meta[itemprop="price"]').attr('content');
      if (price) price = '₺' + price;
    }
    
    if (price) {
      price = price.replace(/\s+/g, '').trim();
      if (!price.includes('₺') && !price.includes('TL')) {
        price = '₺' + price;
      }
      
      return res.json({
        success: true,
        urun: title || 'Ürün',
        fiyat: price,
        site: 'Epey',
        link: url,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Fiyat bulunamadı');
    }
    
  } catch (error) {
    console.error('Epey hatası:', error.message);
    return res.json({
      success: false,
      error: 'Epey.com\'dan fiyat çekilemedi',
      urun: 'Ürün',
      fiyat: 'Fiyat çekilemedi',
      site: 'Epey',
      link: url
    });
  }
}

// ========== AKAÇKE HANDLER ==========
async function handleAkakce(url, res) {
  console.log('🎯 Akakçe.com özel handler');
  
  try {
    // Akakçe bazen bot engelleyebilir, dikkatli ol
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'tr-TR,tr;q=0.9',
      'Referer': 'https://www.google.com/'
    };
    
    const response = await fetch(url, {
      headers,
      timeout: 15000  // Akakçe yavaş olabilir
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const $ = load(html);
    
    // Akakçe'de ürün adı
    let title = $('h1').first().text().trim() ||
                $('title').text().trim().replace(' - Akakçe', '');
    
    // Akakçe fiyat selector'ları
    let price = '';
    
    // En yaygın Akakçe fiyat class'ları
    const akakcePriceSelectors = [
      '.pt_v8',           // Ana fiyat
      '.pt_v9',           // İndirimli fiyat
      '.price',           // Genel price
      '.currentPrice',    // Mevcut fiyat
      '[itemprop="price"]' // Schema
    ];
    
    for (const selector of akakcePriceSelectors) {
      const element = $(selector).first();
      if (element.length) {
        price = element.text().trim();
        if (price && price.length > 0) break;
      }
    }
    
    // Listelenen mağaza fiyatlarını da kontrol et
    if (!price) {
      const storePrices = $('.pl_v8'); // Mağaza fiyat listesi
      if (storePrices.length > 0) {
        price = $(storePrices[0]).text().trim();
      }
    }
    
    if (price) {
      price = price.replace(/\s+/g, '').trim();
      
      // TL → ₺ çevir
      price = price.replace('TL', '₺').replace('tl', '₺');
      
      if (!price.includes('₺')) {
        price = '₺' + price;
      }
      
      return res.json({
        success: true,
        urun: title || 'Ürün',
        fiyat: price,
        site: 'Akakçe',
        link: url,
        timestamp: new Date().toISOString(),
        note: 'Akakçe fiyat karşılaştırma'
      });
    } else {
      throw new Error('Fiyat bulunamadı');
    }
    
  } catch (error) {
    console.error('Akakçe hatası:', error.message);
    return res.json({
      success: false,
      error: 'Akakçe.com\'dan fiyat çekilemedi',
      urun: 'Ürün',
      fiyat: 'Fiyat çekilemedi',
      site: 'Akakçe',
      link: url,
      note: 'Akakçe bot engellemiş olabilir'
    });
  }
}

// ========== NORMAL SİTE HANDLER ==========
async function handleNormalSite(url, hostname, siteName, res) {
  console.log(`🔄 ${siteName} - Normal fetch`);
  
  try {
    // NORMAL KULLANICI GİBİ DAVRAN
    const headers = getRealUserHeaders();
    
    // Site'ye özel referer ekle
    if (hostname.includes('mediamarkt')) {
      headers['Referer'] = 'https://www.google.com/search?q=mediamarkt';
    } else if (hostname.includes('pttavm')) {
      headers['Referer'] = 'https://www.google.com/';
    } else if (hostname.includes('incehesap')) {
      headers['Referer'] = 'https://www.akakce.com/';
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    // HTTP DURUM KONTROLÜ
    if (response.status === 403 || response.status === 429) {
      console.log(`🚫 ${siteName}: HTTP ${response.status} - Erişim engellendi`);
      return res.json({
        success: false,
        error: 'Site erişimi engellendi',
        urun: 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteName,
        link: url,
        note: 'Lütfen bu siteyi manuel kontrol edin'
      });
    }
    
    if (!response.ok) {
      console.log(`❌ ${siteName}: HTTP ${response.status}`);
      return res.json({
        success: false,
        error: `HTTP ${response.status}`,
        urun: 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteName,
        link: url
      });
    }
    
    const html = await response.text();
    
    // BOT ENGEL KONTROLÜ
    if (isBotBlockedPage(html, siteName)) {
      console.log(`🚫 ${siteName}: Bot engel sayfası`);
      return res.json({
        success: false,
        error: 'Bot engellendi',
        urun: 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteName,
        link: url,
        note: 'Cloudflare veya güvenlik duvarı'
      });
    }
    
    const $ = load(html);
    
    // ÜRÜN ADI
    const title = extractTitleFromSite($, siteName, url);
    
    // FİYAT - SİTEYE ÖZEL
    const price = extractPriceFromSite($, siteName, html);
    
    if (price) {
      const formattedPrice = formatPrice(price);
      
      return res.json({
        success: true,
        urun: title || 'Ürün',
        fiyat: formattedPrice,
        site: siteName,
        link: url,
        timestamp: new Date().toISOString(),
        note: 'Gerçek fiyat'
      });
    } else {
      console.log(`❌ ${siteName}: Fiyat bulunamadı`);
      
      // EXTRA: Sayfadaki tüm fiyatları logla (debug için)
      const allPrices = [];
      $('body').find('*').each((i, el) => {
        const text = $(el).text().trim();
        if (text && (text.includes('₺') || text.includes('TL') || /\d[\d.,]{4,}/.test(text))) {
          allPrices.push(text.substring(0, 50));
        }
      });
      
      console.log('🔍 Bulunan fiyat benzeri textler:', allPrices.slice(0, 5));
      
      return res.json({
        success: false,
        error: 'Fiyat bulunamadı',
        urun: title || 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteName,
        link: url,
        note: 'HTML yapısı farklı'
      });
    }
    
  } catch (error) {
    console.error(`❌ ${siteName} hatası:`, error.message);
    
    return res.json({
      success: false,
      error: error.message.includes('aborted') ? 'Timeout' : error.message,
      urun: 'Ürün',
      fiyat: 'Fiyat çekilemedi',
      site: siteName,
      link: url
    });
  }
}

// ========== YARDIMCI FONKSİYONLAR ==========

function getSiteName(hostname) {
  const siteMap = {
    'trendyol.com': 'Trendyol',
    'hepsiburada.com': 'Hepsiburada',
    'n11.com': 'n11',
    'amazon.com.tr': 'Amazon TR',
    'pazarama.com': 'Pazarama',
    'ciceksepeti.com': 'ÇiçekSepeti',
    'teknosa.com': 'Teknosa',
    'mediamarkt.com.tr': 'MediaMarkt',
    'vatanbilgisayar.com': 'Vatan Bilgisayar',
    'itopya.com': 'İtopya',
    'incehesap.com': 'İnceHesap',
    'pttavm.com': 'PTT AVm',
    'idefix.com': 'İdefix',
    'epey.com': 'Epey',
    'akakce.com': 'Akakçe'
  };
  
  for (const [domain, name] of Object.entries(siteMap)) {
    if (hostname.includes(domain)) {
      return name;
    }
  }
  
  return hostname.replace('www.', '').split('.')[0].toUpperCase();
}

function isBotBlockedPage(html, siteName) {
  const blockedIndicators = [
    'cloudflare',
    'cf-browser-verification',
    'access denied',
    'security check',
    'captcha',
    'robot',
    'bot detected',
    'forbidden'
  ];
  
  const lowerHtml = html.toLowerCase();
  
  for (const indicator of blockedIndicators) {
    if (lowerHtml.includes(indicator)) {
      console.log(`🚫 ${siteName}: ${indicator} bulundu`);
      return true;
    }
  }
  
  // Çok kısa HTML (genelde redirect/block)
  if (html.length < 3000 && !html.includes(siteName.toLowerCase())) {
    console.log(`🚫 ${siteName}: Çok kısa HTML (${html.length} karakter)`);
    return true;
  }
  
  return false;
}

function extractTitleFromSite($, siteName, url) {
  let title = '';
  
  const titleSelectors = {
    'Trendyol': ['h1.pr-new-br', '[data-drroot="product-title"]'],
    'Hepsiburada': ['h1[data-bind="text: productName"]', 'h1.product-name'],
    'n11': ['h1.productName', 'h1.proName'],
    'MediaMarkt': ['h1.product-name', '.product-title h1'],
    'Vatan Bilgisayar': ['h1.product-list__product-name'],
    'İnceHesap': ['h1.product-title'],
    'PTT AVm': ['h1.product-name'],
    'default': ['h1', '.product-title', '[itemprop="name"]', 'title']
  };
  
  const selectors = titleSelectors[siteName] || titleSelectors.default;
  
  for (const selector of selectors) {
    title = $(selector).first().text().trim();
    if (title && title.length > 3) break;
  }
  
  // Meta fallback
  if (!title || title.length < 3) {
    title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text().trim();
  }
  
  // URL fallback
  if (!title || title.length < 3) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      if (pathParts.length > 0) {
        title = pathParts[pathParts.length - 1]
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/\.html$/, '')
          .trim();
      }
    } catch (e) {}
  }
  
  title = title || 'Ürün';
  title = title.substring(0, 200);
  
  return title;
}

function extractPriceFromSite($, siteName, html) {
  // Site'ye özel fiyat selector'ları
  const priceSelectors = {
    'Trendyol': [
      '[data-bind="markupText: currentPrice"]',
      '.prc-dsc',
      '.product-price-container'
    ],
    'Hepsiburada': [
      '[data-bind="text: price"]',
      '[itemprop="price"]',
      '.price',
      '#offering-price'
    ],
    'n11': [
      '.newPrice',
      'ins',
      '.unf-p-summary-price'
    ],
    'MediaMarkt': [
      '.product-price',
      '.mm-price',
      '[itemprop="price"]'
    ],
    'Vatan Bilgisayar': [
      '.product-list__price',
      '.product-price'
    ],
    'İnceHesap': [
      '.product-price',
      '[itemprop="price"]'
    ],
    'PTT AVm': [
      '.product-price',
      '.price',
      '.sales-price'
    ],
    'default': [
      '.price',
      '.product-price',
      '[itemprop="price"]',
      '.current-price',
      '[class*="price"]',
      '[class*="fiyat"]'
    ]
  };
  
  const selectors = priceSelectors[siteName] || priceSelectors.default;
  
  // 1. DIRECT SELECTOR'ları dene
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      let price = element.text().trim();
      
      // Attribute'dan da kontrol et
      if (!price && element.attr('content')) {
        price = element.attr('content');
      }
      
      if (price && (price.includes('₺') || price.includes('TL') || /\d[\d.,]{3,}/.test(price))) {
        console.log(`🎯 ${siteName}: ${selector} → ${price}`);
        return price;
      }
    }
  }
  
  // 2. META TAG'ler
  const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                    $('meta[itemprop="price"]').attr('content');
  if (metaPrice) {
    console.log(`🎯 ${siteName}: meta → ${metaPrice}`);
    return metaPrice;
  }
  
  // 3. SAYFADA REGEX ile ara
  const priceRegex = /(?:₺|TL)\s*[\d.,]{3,}|[\d.,]{3,}\s*(?:₺|TL)/gi;
  const matches = html.match(priceRegex);
  if (matches && matches.length > 0) {
    // Benzer fiyatları grupla
    const cleanMatches = matches.map(m => m.replace(/\s+/g, ''));
    const uniqueMatches = [...new Set(cleanMatches)];
    
    if (uniqueMatches.length === 1) {
      console.log(`🎯 ${siteName}: regex → ${uniqueMatches[0]}`);
      return uniqueMatches[0];
    }
    
    // En çok tekrar edeni bul
    const counts = {};
    cleanMatches.forEach(m => {
      counts[m] = (counts[m] || 0) + 1;
    });
    
    const mostCommon = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    console.log(`🎯 ${siteName}: regex (common) → ${mostCommon}`);
    return mostCommon;
  }
  
  return null;
}

function formatPrice(price) {
  if (!price || price === 'undefined' || price === 'null') {
    return 'Fiyat çekilemedi';
  }
  
  let formatted = String(price).trim();
  
  // Temizle
  formatted = formatted.replace(/\s+/g, '');
  
  // TL → ₺
  formatted = formatted.replace(/TL/gi, '₺');
  
  // ₺ ekle (yoksa)
  if (!formatted.includes('₺')) {
    formatted = '₺' + formatted;
  }
  
  // Binlik ayracını kaldır (1.000 → 1000)
  formatted = formatted.replace(/\.(?=\d{3})/g, '');
  
  return formatted;
}

// ========== EPEY/AKAÇKE ARAMA ENDPOINT'İ ==========
app.post('/fiyat-ara', async (req, res) => {
  try {
    const { urun } = req.body;
    
    if (!urun) {
      return res.json({ 
        success: false, 
        error: 'Ürün adı gerekiyor'
      });
    }
    
    console.log(`🔍 Arama: ${urun}`);
    
    // EPEY arama URL'si
    const epeyUrl = `https://www.epey.com/arama/${encodeURIComponent(urun)}/`;
    
    // AKAÇKE arama URL'si  
    const akakceUrl = `https://www.akakce.com/arama/?q=${encodeURIComponent(urun)}`;
    
    const headers = getRealUserHeaders();
    
    // İkisini de dene
    let results = [];
    
    // Epey'den dene
    try {
      const epeyResponse = await fetch(epeyUrl, { headers, timeout: 10000 });
      if (epeyResponse.ok) {
        const html = await epeyResponse.text();
        const $ = load(html);
        
        // Epey arama sonuçları
        $('.urun').each((i, el) => {
          if (i < 5) { // İlk 5 ürün
            const title = $(el).find('.urun-adi a').text().trim();
            const price = $(el).find('.urun-fiyati').text().trim();
            const link = $(el).find('.urun-adi a').attr('href');
            
            if (title && price && link) {
              results.push({
                urun: title,
                fiyat: price.replace('TL', '₺'),
                site: 'Epey',
                link: link.startsWith('http') ? link : `https://www.epey.com${link}`
              });
            }
          }
        });
      }
    } catch (e) {
      console.log('Epey arama hatası:', e.message);
    }
    
    // Akakçe'den dene
    try {
      const akakceResponse = await fetch(akakceUrl, { headers, timeout: 10000 });
      if (akakceResponse.ok) {
        const html = await akakceResponse.text();
        const $ = load(html);
        
        // Akakçe arama sonuçları
        $('.pw_v8').each((i, el) => {
          if (i < 5) {
            const title = $(el).find('a').text().trim();
            const price = $(el).find('.pt_v8').text().trim();
            const link = $(el).find('a').attr('href');
            
            if (title && price && link) {
              results.push({
                urun: title,
                fiyat: price.replace('TL', '₺'),
                site: 'Akakçe',
                link: link.startsWith('http') ? link : `https://www.akakce.com${link}`
              });
            }
          }
        });
      }
    } catch (e) {
      console.log('Akakçe arama hatası:', e.message);
    }
    
    if (results.length > 0) {
      return res.json({
        success: true,
        fiyatlar: results,
        query: urun,
        note: 'Epey ve Akakçe arama sonuçları'
      });
    } else {
      return res.json({
        success: false,
        error: 'Arama sonucu bulunamadı',
        fiyatlar: [],
        query: urun
      });
    }
    
  } catch (error) {
    console.error('Arama hatası:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Arama servisi hatası' 
    });
  }
});

// ========== DİĞER ENDPOINT'LER ==========

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Normal Kullanıcı API çalışıyor',
    version: '7.0.0',
    features: ['epey-support', 'akakce-support', 'real-user-headers'],
    note: 'Bot gibi değil, normal kullanıcı gibi davranıyor'
  });
});

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  console.log(`
  🚀 NORMAL KULLANICI API v7.0
  📍 Port: ${PORT}
  👤 Davranış: Normal tarayıcı gibi
  🎯 Destek: Epey, Akakçe, tüm e-ticaret
  🛡️  Bot engel yok - Sadece sayfa açma
  ✅ Endpoints: /fiyat-cek-link, /fiyat-ara
  `);
});
