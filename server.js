// server.js - UNIVERSAL FIYAT ÇEKME SİSTEMİ
import express from 'express';
import cors from 'cors';
import { load } from 'cheerio';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== EVRENSEL FIYAT ÇEKME MOTORU ==========
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
    
    console.log(`🌐 Universal fiyat çekme: ${url}`);
    
    // 1. SİTE TANIMA
    const siteInfo = detectSite(url);
    console.log(`📊 Site: ${siteInfo.name} (${siteInfo.type})`);
    
    // 2. SAYFAYI ÇEK (akıllı headers)
    const headers = getSmartHeaders(siteInfo);
    
    let response;
    try {
      response = await fetch(url, {
        headers,
        timeout: 10000,
        redirect: 'follow'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
    } catch (fetchError) {
      console.error('❌ Fetch hatası:', fetchError.message);
      return res.json({
        success: false,
        error: 'Sayfa yüklenemedi',
        fiyat: 'Fiyat çekilemedi',
        site: siteInfo.name,
        link: url
      });
    }
    
    const html = await response.text();
    const $ = load(html);
    
    // 3. AKILLI ÜRÜN ADI BULMA
    const title = extractTitle($, siteInfo, html);
    console.log(`📝 Ürün: ${title.substring(0, 60)}...`);
    
    // 4. AKILLI FİYAT BULMA (TÜM YÖNTEMLER)
    const price = await extractPrice($, siteInfo, html, url);
    
    // 5. SONUÇ
    if (price && price !== 'Fiyat çekilemedi') {
      console.log(`✅ BAŞARILI! ${siteInfo.name}: ${price}`);
      
      return res.json({
        success: true,
        urun: title,
        fiyat: price,
        site: siteInfo.name,
        link: url,
        timestamp: new Date().toISOString(),
        method: price.includes('₺') ? 'direct' : 'fallback'
      });
    } else {
      console.log(`❌ Fiyat bulunamadı, fallback deniyor...`);
      
      // FALLBACK: Meta data, JSON-LD, script tag'lerini ara
      const fallbackPrice = extractFallbackPrice($, html);
      
      if (fallbackPrice) {
        console.log(`🔄 Fallback başarılı: ${fallbackPrice}`);
        
        return res.json({
          success: true,
          urun: title,
          fiyat: fallbackPrice,
          site: siteInfo.name,
          link: url,
          timestamp: new Date().toISOString(),
          method: 'fallback',
          note: 'Alternatif yöntemle çekildi'
        });
      }
      
      // HİÇBİR YÖNTEM ÇALIŞMAZSA
      console.log(`💥 Tüm yöntemler başarısız`);
      
      return res.json({
        success: false,
        error: 'Fiyat bilgisi bulunamadı',
        urun: title || 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteInfo.name,
        link: url,
        note: 'HTML yapısı farklı olabilir'
      });
    }
    
  } catch (error) {
    console.error('🔥 Kritik hata:', error);
    
    return res.json({
      success: false,
      error: error.message,
      urun: 'Ürün',
      fiyat: 'Fiyat çekilemedi',
      site: 'Bilinmeyen',
      link: req.body?.url || ''
    });
  }
});

// ========== YARDIMCI FONKSİYONLAR ==========

function detectSite(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // E-ticaret siteleri
    if (hostname.includes('trendyol')) {
      return { name: 'Trendyol', type: 'ecommerce', country: 'TR' };
    }
    if (hostname.includes('hepsiburada')) {
      return { name: 'Hepsiburada', type: 'ecommerce', country: 'TR' };
    }
    if (hostname.includes('n11.com')) {
      return { name: 'n11', type: 'ecommerce', country: 'TR' };
    }
    if (hostname.includes('amazon.com.tr')) {
      return { name: 'Amazon', type: 'ecommerce', country: 'TR' };
    }
    if (hostname.includes('pazarama')) {
      return { name: 'Pazarama', type: 'ecommerce', country: 'TR' };
    }
    if (hostname.includes('ciceksepeti')) {
      return { name: 'ÇiçekSepeti', type: 'ecommerce', country: 'TR' };
    }
    if (hostname.includes('teknosa')) {
      return { name: 'Teknosa', type: 'ecommerce', country: 'TR' };
    }
    if (hostname.includes('mediamarkt')) {
      return { name: 'MediaMarkt', type: 'ecommerce', country: 'TR' };
    }
    if (hostname.includes('vatan')) {
      return { name: 'Vatan', type: 'ecommerce', country: 'TR' };
    }
    if (hostname.includes('akakce')) {
      return { name: 'Akakçe', type: 'price_comparison', country: 'TR' };
    }
    if (hostname.includes('cimri')) {
      return { name: 'Cimri', type: 'price_comparison', country: 'TR' };
    }
    
    // Global siteler
    if (hostname.includes('amazon.')) {
      return { name: 'Amazon', type: 'ecommerce', country: 'global' };
    }
    if (hostname.includes('ebay.')) {
      return { name: 'eBay', type: 'auction', country: 'global' };
    }
    if (hostname.includes('aliexpress')) {
      return { name: 'AliExpress', type: 'ecommerce', country: 'global' };
    }
    
    // Domain'den isim çıkar
    const domainName = hostname.replace('www.', '').split('.')[0];
    return { 
      name: domainName.charAt(0).toUpperCase() + domainName.slice(1), 
      type: 'unknown', 
      country: 'unknown' 
    };
    
  } catch (error) {
    return { name: 'Bilinmeyen', type: 'unknown', country: 'unknown' };
  }
}

function getSmartHeaders(siteInfo) {
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1'
  };
  
  // Site'ye özel ek headers
  if (siteInfo.name === 'Amazon') {
    baseHeaders['Accept-Language'] = 'en-US,en;q=0.9';
  }
  
  if (siteInfo.name === 'Trendyol') {
    baseHeaders['Referer'] = 'https://www.trendyol.com/';
  }
  
  return baseHeaders;
}

function extractTitle($, siteInfo, html) {
  let title = '';
  
  // 1. Site'ye özel title selector'ları
  const siteSelectors = {
    'Trendyol': [
      'h1.pr-new-br',
      '[data-drroot="product-title"]',
      'h1.prd-desc-cntr-ttl',
      '.product-detail-container h1'
    ],
    'Hepsiburada': [
      'h1[data-bind="text: productName"]',
      'h1.product-name',
      '#product-name'
    ],
    'n11': [
      'h1.productName',
      'h1.proName',
      'h1.name'
    ],
    'Amazon': [
      '#productTitle',
      'h1#title'
    ],
    'default': [
      'h1',
      '.product-title',
      '.title',
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'title'
    ]
  };
  
  const selectors = siteSelectors[siteInfo.name] || siteSelectors.default;
  
  for (const selector of selectors) {
    if (selector.startsWith('meta')) {
      title = $(selector).attr('content') || '';
    } else {
      title = $(selector).first().text().trim();
    }
    
    if (title && title.length > 5) break;
  }
  
  // 2. Temizleme
  title = title || 'Ürün';
  title = title.replace(/\s+/g, ' ').trim();
  title = title.substring(0, 150);
  
  // 3. URL'den fallback
  if (title === 'Ürün' || title.length < 3) {
    try {
      const urlObj = new URL(siteInfo.url || '');
      const path = urlObj.pathname;
      const segments = path.split('/').filter(s => s && !s.includes('-p-') && !s.includes('product'));
      if (segments.length > 0) {
        title = segments.map(s => 
          s.replace(/-/g, ' ')
           .replace(/[0-9]/g, '')
           .trim()
        ).filter(s => s.length > 2).join(' ') || 'Ürün';
      }
    } catch (e) {}
  }
  
  return title;
}

async function extractPrice($, siteInfo, html, url) {
  console.log(`🔍 ${siteInfo.name} için fiyat aranıyor...`);
  
  // 1. DIRECT SELECTOR YÖNTEMİ (site'ye özel)
  let price = findPriceBySelectors($, siteInfo);
  
  if (price) {
    console.log(`🎯 Direct selector: ${price}`);
    return formatPrice(price, siteInfo.country);
  }
  
  // 2. META ETİKET YÖNTEMİ
  price = findPriceInMeta($);
  if (price) {
    console.log(`📱 Meta tag: ${price}`);
    return formatPrice(price, siteInfo.country);
  }
  
  // 3. JSON-LD YÖNTEMİ (structured data)
  price = findPriceInJsonLd($, html);
  if (price) {
    console.log(`📊 JSON-LD: ${price}`);
    return formatPrice(price, siteInfo.country);
  }
  
  // 4. SCRIPT TAG YÖNTEMİ (JavaScript verileri)
  price = findPriceInScriptTags($, html);
  if (price) {
    console.log(`💻 Script tag: ${price}`);
    return formatPrice(price, siteInfo.country);
  }
  
  // 5. REGEX YÖNTEMİ (tüm sayfada ara)
  price = findPriceByRegex(html, siteInfo.country);
  if (price) {
    console.log(`🔎 Regex: ${price}`);
    return formatPrice(price, siteInfo.country);
  }
  
  // 6. CLASS/ATTR YÖNTEMİ (price/fiyat/amount class'ları)
  price = findPriceByClassAttributes($);
  if (price) {
    console.log(`🏷️ Class/Attr: ${price}`);
    return formatPrice(price, siteInfo.country);
  }
  
  return null;
}

function findPriceBySelectors($, siteInfo) {
  const selectorGroups = {
    'Trendyol': [
      '[data-bind="markupText: currentPrice"]',
      '.prc-dsc',
      '.prc-box-dscntd',
      '[data-product-new-price]',
      '.product-price-container',
      '.price-container'
    ],
    'Hepsiburada': [
      '[data-bind="text: price"]',
      '[itemprop="price"]',
      '.price',
      '#offering-price',
      '.product-price'
    ],
    'n11': [
      '.newPrice',
      'ins',
      '.unf-p-summary-price',
      '.price'
    ],
    'Amazon': [
      '.a-price-whole',
      '.priceBlockBuyingPriceString',
      '.a-color-price'
    ],
    'default': [
      '.price',
      '.fiyat',
      '.product-price',
      '.current-price',
      '[class*="price"]',
      '[class*="Price"]',
      '[class*="fiyat"]',
      'span.price',
      'div.price',
      'ins'
    ]
  };
  
  const selectors = selectorGroups[siteInfo.name] || selectorGroups.default;
  
  for (const selector of selectors) {
    if (selector.includes('[') && !selector.includes(']=')) {
      // Attribute selector
      const element = $(selector).first();
      if (element.length) {
        const price = element.attr(selector.match(/\[(.*?)\]/)[1]);
        if (price) return price;
      }
    } else {
      // Normal selector
      const price = $(selector).first().text().trim();
      if (price && price.length > 0) {
        return price;
      }
    }
  }
  
  return null;
}

function findPriceInMeta($) {
  const metaSelectors = [
    'meta[property="product:price:amount"]',
    'meta[itemprop="price"]',
    'meta[name="twitter:data1"]',
    'meta[property="og:price:amount"]'
  ];
  
  for (const selector of metaSelectors) {
    const price = $(selector).attr('content');
    if (price) return price;
  }
  
  return null;
}

function findPriceInJsonLd($, html) {
  try {
    // JSON-LD script tag'lerini bul
    const scriptTags = $('script[type="application/ld+json"]');
    
    for (let i = 0; i < scriptTags.length; i++) {
      try {
        const jsonText = $(scriptTags[i]).html();
        if (!jsonText) continue;
        
        const data = JSON.parse(jsonText);
        
        // Recursive olarak fiyat ara
        const findPriceInObject = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          
          // Check common price properties
          if (obj.price || obj.offers?.price || obj.aggregateRating?.price) {
            return obj.price || obj.offers?.price || obj.aggregateRating?.price;
          }
          
          // Recursively search
          for (const key in obj) {
            if (typeof obj[key] === 'object') {
              const result = findPriceInObject(obj[key]);
              if (result) return result;
            }
          }
          
          return null;
        };
        
        const price = findPriceInObject(data);
        if (price) return price;
        
      } catch (e) {
        // JSON parse hatası, devam et
        continue;
      }
    }
  } catch (error) {
    // Hata yok say
  }
  
  return null;
}

function findPriceInScriptTags($, html) {
  try {
    // Tüm script tag'lerini kontrol et
    const scriptTags = $('script');
    const pricePatterns = [
      /"price"\s*:\s*["']?([\d.,]+)["']?/gi,
      /"amount"\s*:\s*["']?([\d.,]+)["']?/gi,
      /"value"\s*:\s*["']?([\d.,]+)["']?/gi,
      /price:\s*["']?([\d.,]+)["']?/gi,
      /fiyat\s*["']?:\s*["']?([\d.,]+)["']?/gi
    ];
    
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html() || '';
      
      for (const pattern of pricePatterns) {
        const matches = scriptContent.match(pattern);
        if (matches) {
          for (const match of matches) {
            const priceMatch = match.match(/([\d.,]+)/);
            if (priceMatch && priceMatch[1]) {
              return priceMatch[1];
            }
          }
        }
      }
    }
  } catch (error) {
    // Hata yok say
  }
  
  return null;
}

function findPriceByRegex(html, country) {
  // Ülkeye göre para birimi pattern'leri
  const currencyPatterns = {
    'TR': [/(?:₺|TL)\s*([\d.,]+)|([\d.,]+)\s*(?:₺|TL)/gi],
    'global': [/\$?\s*([\d.,]+)|([\d.,]+)\s*\$?/gi, /€?\s*([\d.,]+)|([\d.,]+)\s*€?/gi]
  };
  
  const patterns = currencyPatterns[country] || [...currencyPatterns.TR, ...currencyPatterns.global];
  
  const allPrices = [];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (matches) {
      allPrices.push(...matches);
    }
  }
  
  if (allPrices.length > 0) {
    // En mantıklı fiyatı seç (genelde 3+ basamaklılar gerçek fiyat)
    const numericPrices = allPrices
      .map(p => p.replace(/[^\d.,]/g, ''))
      .filter(p => {
        const num = parseFloat(p.replace('.', '').replace(',', '.'));
        return !isNaN(num) && num > 10; // 10'dan küçük fiyatlar genelde yanlış
      });
    
    if (numericPrices.length > 0) {
      // En uzun/sabit fiyatı al
      return numericPrices.reduce((a, b) => a.length > b.length ? a : b);
    }
  }
  
  return null;
}

function findPriceByClassAttributes($) {
  // price/fiyat içeren class veya attribute'ları ara
  const priceElements = $('[class*="price"], [class*="Price"], [class*="fiyat"], [class*="Fiyat"]');
  
  const prices = [];
  
  priceElements.each((i, el) => {
    const text = $(el).text().trim();
    if (text && (text.includes('₺') || text.includes('TL') || /\d[\d.,]{3,}/.test(text))) {
      prices.push(text);
    }
  });
  
  if (prices.length > 0) {
    // En sık geçeni al
    const frequency = {};
    prices.forEach(p => {
      frequency[p] = (frequency[p] || 0) + 1;
    });
    
    return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
  }
  
  return null;
}

function extractFallbackPrice($, html) {
  // Son çare: HTML'deki tüm text'leri tarama
  const bodyText = $('body').text();
  
  // Fiyat pattern'leri
  const pricePatterns = [
    /₺\s*[\d.,]{4,}/g,      // ₺ ile başlayan 4+ haneli
    /TL\s*[\d.,]{4,}/g,     // TL ile başlayan 4+ haneli
    /[\d.,]{4,}\s*₺/g,      // 4+ haneli ₺ ile biten
    /[\d.,]{4,}\s*TL/g      // 4+ haneli TL ile biten
  ];
  
  for (const pattern of pricePatterns) {
    const matches = bodyText.match(pattern);
    if (matches && matches.length > 0) {
      // Benzer fiyatları grupla
      const uniqueMatches = [...new Set(matches.map(m => m.replace(/\s+/g, '')))];
      
      if (uniqueMatches.length === 1) {
        // Tek benzersiz fiyat varsa onu al
        return uniqueMatches[0];
      } else if (uniqueMatches.length > 1) {
        // En çok tekrar edeni bul
        const counts = {};
        matches.forEach(m => {
          const clean = m.replace(/\s+/g, '');
          counts[clean] = (counts[clean] || 0) + 1;
        });
        
        const mostCommon = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        return mostCommon;
      }
    }
  }
  
  return null;
}

function formatPrice(price, country) {
  if (!price) return 'Fiyat çekilemedi';
  
  let formatted = String(price);
  
  // Para birimi ekle
  if (country === 'TR') {
    if (!formatted.includes('₺') && !formatted.includes('TL')) {
      formatted = '₺' + formatted;
    }
  } else if (country === 'global') {
    if (!formatted.includes('$') && !formatted.includes('€') && !formatted.includes('₺')) {
      formatted = '$' + formatted;
    }
  }
  
  // Format temizleme
  formatted = formatted.replace(/\s+/g, '').trim();
  
  // Binlik ayracı düzelt (1.000 → 1000)
  formatted = formatted.replace(/\.(?=\d{3})/g, '');
  
  // Ondalık ayracı düzelt
  if (formatted.includes(',') && formatted.includes('.')) {
    // Hem , hem . varsa, son ,'yı . yap
    formatted = formatted.replace(/,(\d{2})$/, '.$1');
  } else if (formatted.includes(',')) {
    // Sadece , varsa ve 2 haneden sonra geliyorsa . yap
    const match = formatted.match(/,(\d{2})$/);
    if (match) {
      formatted = formatted.replace(/,(\d{2})$/, '.$1');
    }
  }
  
  return formatted;
}

// ========== DİĞER ENDPOINT'LER (kısa tutalım) ==========

app.post('/fiyat-cek', async (req, res) => {
  try {
    const { urun } = req.body;
    res.json({
      success: true,
      fiyatlar: [{
        urun: `${urun} - Arama sonucu`,
        fiyat: 'Linke tıklayın',
        site: 'Arama',
        link: `https://www.google.com/search?q=${encodeURIComponent(urun)}+site:trendyol.com+OR+site:hepsiburada.com`
      }],
      query: urun
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

app.post('/ai/yorum', (req, res) => {
  const { title, site } = req.body;
  res.json({
    success: true,
    yorum: `${site}'daki ${title} ürünü inceleniyor...`,
    urun: title,
    site: site
  });
});

app.post('/ai/compare', (req, res) => {
  const { products } = req.body;
  res.json({
    success: true,
    analysis: `${products?.length || 0} ürün karşılaştırıldı.`
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Universal FiyatTakip API çalışıyor',
    version: '4.0.0',
    note: 'Her linke göre akıllı fiyat çekme'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    endpoints: ['/health', '/fiyat-cek', '/fiyat-cek-link', '/ai/yorum', '/ai/compare'],
    capability: 'universal_price_extraction'
  });
});

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  console.log(`
  🚀 UNIVERSAL FİYAT ÇEKME API
  📍 Port: ${PORT}
  🔧 Özellik: Her siteye uyumlu
  🎯 Yöntem: 6 farklı fiyat bulma tekniği
  ✅ Hazır: /fiyat-cek-link
  `);
});
