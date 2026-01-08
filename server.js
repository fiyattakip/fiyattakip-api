// server.js - TÜM SİTELER İÇİN UNIVERSAL SYSTEM
import express from 'express';
import cors from 'cors';
import { load } from 'cheerio';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== TÜM SİTELER İÇİN FIYAT ÇEKME ==========
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
    
    console.log(`🌐 Fiyat çekme: ${url}`);
    
    // SİTE TANIMA (TÜM SİTELER)
    const siteInfo = detectAllSites(url);
    console.log(`🏪 Site: ${siteInfo.name} (${siteInfo.category})`);
    
    // SAYFA ÇEKME
    const headers = getHeadersForSite(siteInfo);
    
    let response;
    try {
      response = await fetch(url, {
        headers,
        timeout: 12000,
        redirect: 'follow'
      });
      
      if (!response.ok) {
        console.log(`⚠️ HTTP ${response.status} for ${siteInfo.name}`);
        
        // Bazı siteler 403/429 verebilir, fallback dene
        if (response.status === 403 || response.status === 429) {
          return tryAlternativeMethod(url, siteInfo, res);
        }
        
        throw new Error(`HTTP ${response.status}`);
      }
      
    } catch (fetchError) {
      console.error('❌ Fetch hatası:', fetchError.message);
      
      // Fallback yöntemini dene
      return tryAlternativeMethod(url, siteInfo, res);
    }
    
    const html = await response.text();
    const $ = load(html);
    
    // DEBUG: Küçük bir HTML örneği logla
    if (html.length < 10000) {
      console.log('📄 HTML (kısa):', html.substring(0, 500));
    }
    
    // ÜRÜN ADI ÇEK
    const title = extractProductTitle($, siteInfo, html, url);
    console.log(`📝 Ürün: ${title.substring(0, 80)}...`);
    
    // FİYAT ÇEK (TÜM YÖNTEMLERLE)
    const priceResult = await extractPriceUniversal($, siteInfo, html, url);
    
    if (priceResult.success) {
      console.log(`✅ BAŞARILI! ${siteInfo.name}: ${priceResult.price}`);
      
      return res.json({
        success: true,
        urun: title,
        fiyat: priceResult.price,
        site: siteInfo.name,
        link: url,
        timestamp: new Date().toISOString(),
        method: priceResult.method,
        confidence: priceResult.confidence
      });
    } else {
      console.log(`❌ Tüm yöntemler başarısız: ${priceResult.error}`);
      
      return res.json({
        success: false,
        error: priceResult.error,
        urun: title,
        fiyat: 'Fiyat çekilemedi',
        site: siteInfo.name,
        link: url,
        note: 'HTML yapısı farklı veya site engelledi'
      });
    }
    
  } catch (error) {
    console.error('🔥 Kritik hata:', error.message);
    
    return res.json({
      success: false,
      error: 'Beklenmeyen sunucu hatası',
      urun: 'Ürün',
      fiyat: 'Fiyat çekilemedi',
      site: 'Bilinmeyen',
      link: req.body?.url || ''
    });
  }
});

// ========== YENİ SİTELERİ TANIMA ==========

function detectAllSites(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    
    // TÜRK E-TİCARET SİTELERİ
    const siteMap = {
      // Büyük Marketler
      'trendyol.com': { name: 'Trendyol', category: 'marketplace', difficulty: 'medium' },
      'hepsiburada.com': { name: 'Hepsiburada', category: 'marketplace', difficulty: 'easy' },
      'n11.com': { name: 'n11', category: 'marketplace', difficulty: 'easy' },
      'amazon.com.tr': { name: 'Amazon TR', category: 'marketplace', difficulty: 'medium' },
      'pazarama.com': { name: 'Pazarama', category: 'marketplace', difficulty: 'medium' },
      'ciceksepeti.com': { name: 'ÇiçekSepeti', category: 'marketplace', difficulty: 'medium' },
      
      // Teknoloji Marketleri
      'teknosa.com': { name: 'Teknosa', category: 'tech', difficulty: 'easy' },
      'mediamarkt.com.tr': { name: 'MediaMarkt', category: 'tech', difficulty: 'medium' },
      'vatanbilgisayar.com': { name: 'Vatan Bilgisayar', category: 'tech', difficulty: 'easy' },
      'itopya.com': { name: 'İtopya', category: 'tech', difficulty: 'hard' },
      'incehesap.com': { name: 'İnceHesap', category: 'tech', difficulty: 'hard' },
      
      // Kitap/Kültür
      'idefix.com': { name: 'İdefix', category: 'books', difficulty: 'medium' },
      
      // Diğer
      'pttavm.com': { name: 'PTT AVm', category: 'marketplace', difficulty: 'hard' },
      
      // Global
      'amazon.': { name: 'Amazon', category: 'global', difficulty: 'medium' },
      'ebay.': { name: 'eBay', category: 'auction', difficulty: 'hard' },
      'aliexpress.com': { name: 'AliExpress', category: 'global', difficulty: 'hard' },
    };
    
    // Hostname'e göre ara
    for (const [domain, info] of Object.entries(siteMap)) {
      if (hostname.includes(domain)) {
        return {
          name: info.name,
          category: info.category,
          difficulty: info.difficulty,
          hostname: hostname,
          url: url
        };
      }
    }
    
    // Domain'den isim çıkar
    const domainName = hostname.replace('www.', '').split('.')[0];
    return { 
      name: domainName.charAt(0).toUpperCase() + domainName.slice(1), 
      category: 'unknown', 
      difficulty: 'hard',
      hostname: hostname,
      url: url
    };
    
  } catch (error) {
    return { 
      name: 'Bilinmeyen', 
      category: 'unknown', 
      difficulty: 'hard',
      hostname: 'unknown',
      url: url
    };
  }
}

// ========== SİTEYE ÖZEL HEADERS ==========

function getHeadersForSite(siteInfo) {
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  };
  
  // Site'ye özel eklemeler
  switch(siteInfo.name) {
    case 'Trendyol':
      baseHeaders['Referer'] = 'https://www.trendyol.com/';
      break;
      
    case 'Hepsiburada':
      baseHeaders['Referer'] = 'https://www.hepsiburada.com/';
      break;
      
    case 'Amazon TR':
    case 'Amazon':
      baseHeaders['Accept-Language'] = 'en-US,en;q=0.9,tr;q=0.8';
      baseHeaders['Referer'] = 'https://www.amazon.com.tr/';
      break;
      
    case 'MediaMarkt':
      baseHeaders['Referer'] = 'https://www.mediamarkt.com.tr/';
      break;
      
    case 'Vatan Bilgisayar':
      baseHeaders['Referer'] = 'https://www.vatanbilgisayar.com/';
      break;
      
    case 'İtopya':
    case 'İnceHesap':
      // Bu siteler bot engelleme kullanabilir
      baseHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0';
      break;
  }
  
  return baseHeaders;
}

// ========== ALTERNATİF YÖNTEM (403/429 için) ==========

async function tryAlternativeMethod(url, siteInfo, res) {
  console.log(`🔄 Alternatif yöntem deneniyor: ${siteInfo.name}`);
  
  try {
    // Daha basit headers ile dene
    const simpleHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    };
    
    const response = await fetch(url, {
      headers: simpleHeaders,
      timeout: 8000
    });
    
    if (response.ok) {
      const html = await response.text();
      const $ = load(html);
      
      const title = extractProductTitle($, siteInfo, html, url);
      const priceResult = extractPriceSimple($, html, siteInfo);
      
      if (priceResult.price) {
        return res.json({
          success: true,
          urun: title,
          fiyat: priceResult.price,
          site: siteInfo.name,
          link: url,
          timestamp: new Date().toISOString(),
          method: 'alternative',
          note: 'Basit yöntemle çekildi'
        });
      }
    }
  } catch (altError) {
    console.error('Alternatif yöntem de başarısız:', altError.message);
  }
  
  // Hiçbiri çalışmazsa
  return res.json({
    success: false,
    error: 'Site erişimi engellendi',
    urun: 'Ürün',
    fiyat: 'Fiyat çekilemedi',
    site: siteInfo.name,
    link: url,
    note: 'Site bot erişimini engellemiş olabilir'
  });
}

// ========== ÜRÜN ADI ÇEKME ==========

function extractProductTitle($, siteInfo, html, url) {
  let title = '';
  
  // Site'ye özel title selector'ları
  const siteTitleSelectors = {
    // TRENDYOL
    'Trendyol': [
      'h1.pr-new-br',
      '[data-drroot="product-title"]',
      '.product-detail-container h1',
      'h1[class*="prd-title"]'
    ],
    
    // HEPSIBURADA
    'Hepsiburada': [
      'h1[data-bind="text: productName"]',
      'h1.product-name',
      '#product-name',
      '.product-title h1'
    ],
    
    // N11
    'n11': [
      'h1.productName',
      'h1.proName',
      '.unf-p-summary-title'
    ],
    
    // AMAZON
    'Amazon TR': [
      '#productTitle',
      'h1#title',
      '#titleSection h1'
    ],
    
    // MEDİAMARKT
    'MediaMarkt': [
      'h1.product-name',
      '.product-title h1',
      'h1[itemprop="name"]'
    ],
    
    // VATAN BİLGİSAYAR
    'Vatan Bilgisayar': [
      'h1.product-list__product-name',
      '.product-name h1',
      'h1.product-title'
    ],
    
    // TEKNOSA
    'Teknosa': [
      'h1.product-name',
      '.product-detail h1',
      '.product-info h1'
    ],
    
    // ÇİÇEK SEPETİ
    'ÇiçekSepeti': [
      'h1.product-name',
      '.product-detail-header h1',
      'h1[itemprop="name"]'
    ],
    
    // PAZARAMA
    'Pazarama': [
      'h1.product-title',
      '.product-header h1',
      'h1.product-name'
    ],
    
    // İTORYA / İNCEHESAP (teknoloji siteleri)
    'İtopya': [
      'h1.product-title',
      '.product-name h1',
      'h1.product-detail-title'
    ],
    'İnceHesap': [
      'h1.product-title',
      '.product-name',
      'h1[itemprop="name"]'
    ],
    
    // İDEFİX
    'İdefix': [
      'h1.product-title',
      '.product-name h1',
      'h1.prd-name'
    ],
    
    // PTT AVm
    'PTT AVm': [
      'h1.product-name',
      '.product-title',
      'h1.product-detail-name'
    ],
    
    // GENEL SELECTOR'LAR
    'default': [
      'h1',
      '.product-title',
      '.title',
      '[itemprop="name"]',
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'title'
    ]
  };
  
  const selectors = siteTitleSelectors[siteInfo.name] || siteTitleSelectors.default;
  
  // Selector'ları dene
  for (const selector of selectors) {
    if (selector.startsWith('meta')) {
      title = $(selector).attr('content') || '';
    } else {
      title = $(selector).first().text().trim();
    }
    
    if (title && title.length > 3 && title.length < 200) {
      break;
    }
  }
  
  // Meta tag'lerden dene
  if (!title || title.length < 3) {
    title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text().trim();
  }
  
  // URL'den fallback
  if (!title || title.length < 3) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      // URL'den ürün adını çıkar
      const urlParts = path.split('/').filter(p => p && !p.match(/^p-|product-|urun-|\d+$/));
      if (urlParts.length > 0) {
        title = urlParts.map(p => 
          p.replace(/-/g, ' ')
           .replace(/\+/g, ' ')
           .replace(/%20/g, ' ')
           .trim()
        ).join(' - ');
      }
    } catch (e) {
      // URL parse hatası
    }
  }
  
  // Temizleme
  title = title || 'Ürün';
  title = title.replace(/\s+/g, ' ').trim();
  title = title.substring(0, 200);
  
  return title;
}

// ========== EVRENSEL FİYAT ÇEKME ==========

async function extractPriceUniversal($, siteInfo, html, url) {
  console.log(`💰 ${siteInfo.name} için fiyat aranıyor...`);
  
  const methods = [
    { name: 'direct', func: () => extractPriceByDirectSelectors($, siteInfo) },
    { name: 'meta', func: () => extractPriceFromMetaTags($) },
    { name: 'jsonld', func: () => extractPriceFromJsonLd($, html) },
    { name: 'scripts', func: () => extractPriceFromScriptTags($, html) },
    { name: 'regex', func: () => extractPriceByRegex(html, siteInfo) },
    { name: 'attributes', func: () => extractPriceByAttributes($) },
    { name: 'wildcard', func: () => extractPriceWildcard($, html) }
  ];
  
  // Tüm yöntemleri dene
  for (const method of methods) {
    try {
      const result = method.func();
      if (result && result.price) {
        const formattedPrice = formatPriceForTurkey(result.price);
        if (formattedPrice && formattedPrice !== 'Fiyat çekilemedi') {
          console.log(`🎯 ${method.name.toUpperCase()} çalıştı: ${formattedPrice}`);
          return {
            success: true,
            price: formattedPrice,
            method: method.name,
            confidence: result.confidence || 'medium',
            raw: result.price
          };
        }
      }
    } catch (error) {
      // Yöntem başarısız, diğerine geç
      continue;
    }
  }
  
  // Hiçbiri çalışmazsa
  return {
    success: false,
    error: 'Fiyat bulunamadı',
    price: null,
    method: 'none',
    confidence: 'low'
  };
}

// ========== FİYAT ÇEKME YÖNTEMLERİ ==========

function extractPriceByDirectSelectors($, siteInfo) {
  // Site'ye özel fiyat selector'ları
  const sitePriceSelectors = {
    // TRENDYOL
    'Trendyol': [
      { selector: '[data-bind="markupText: currentPrice"]', type: 'text' },
      { selector: '.prc-dsc', type: 'text' },
      { selector: '.prc-box-dscntd', type: 'text' },
      { selector: '[data-product-new-price]', type: 'attr', attr: 'data-product-new-price' },
      { selector: '.product-price-container', type: 'text' }
    ],
    
    // HEPSIBURADA
    'Hepsiburada': [
      { selector: '[data-bind="text: price"]', type: 'text' },
      { selector: '[itemprop="price"]', type: 'attr', attr: 'content' },
      { selector: '.price', type: 'text' },
      { selector: '#offering-price', type: 'text' },
      { selector: '.product-price', type: 'text' }
    ],
    
    // N11
    'n11': [
      { selector: '.newPrice', type: 'text' },
      { selector: 'ins', type: 'text' },
      { selector: '.unf-p-summary-price', type: 'text' },
      { selector: '.price', type: 'text' }
    ],
    
    // MEDİAMARKT
    'MediaMarkt': [
      { selector: '.product-price', type: 'text' },
      { selector: '.mm-price', type: 'text' },
      { selector: '[itemprop="price"]', type: 'attr', attr: 'content' }
    ],
    
    // VATAN BİLGİSAYAR
    'Vatan Bilgisayar': [
      { selector: '.product-list__price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.product-price', type: 'text' }
    ],
    
    // TEKNOSA
    'Teknosa': [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.currentPrice', type: 'text' }
    ],
    
    // ÇİÇEK SEPETİ
    'ÇiçekSepeti': [
      { selector: '.price', type: 'text' },
      { selector: '.product-price', type: 'text' },
      { selector: '.current-price', type: 'text' }
    ],
    
    // PAZARAMA
    'Pazarama': [
      { selector: '.product-price', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '.current-price', type: 'text' }
    ],
    
    // AMAZON
    'Amazon TR': [
      { selector: '.a-price-whole', type: 'text' },
      { selector: '.a-offscreen', type: 'text' },
      { selector: '.priceBlockBuyingPriceString', type: 'text' }
    ],
    
    // GENEL SELECTOR'LAR
    'default': [
      { selector: '.price', type: 'text' },
      { selector: '.fiyat', type: 'text' },
      { selector: '.product-price', type: 'text' },
      { selector: '.current-price', type: 'text' },
      { selector: '.sale-price', type: 'text' },
      { selector: '[class*="price"]', type: 'text' },
      { selector: '[class*="Price"]', type: 'text' },
      { selector: '[class*="fiyat"]', type: 'text' },
      { selector: 'ins', type: 'text' },
      { selector: '[itemprop="price"]', type: 'attr', attr: 'content' }
    ]
  };
  
  const selectors = sitePriceSelectors[siteInfo.name] || sitePriceSelectors.default;
  
  for (const item of selectors) {
    const element = $(item.selector).first();
    if (element.length) {
      let price = '';
      
      if (item.type === 'attr' && item.attr) {
        price = element.attr(item.attr) || '';
      } else {
        price = element.text().trim();
      }
      
      if (price && price.length > 0) {
        // Fiyatı temizle
        price = price.replace(/\s+/g, ' ').trim();
        
        // Sayısal değer kontrolü
        const numericMatch = price.match(/([\d.,]+)/);
        if (numericMatch && numericMatch[1]) {
          console.log(`🔍 Direct selector bulundu: ${price}`);
          return { price: price, confidence: 'high' };
        }
      }
    }
  }
  
  return null;
}

function extractPriceFromMetaTags($) {
  const metaSelectors = [
    'meta[property="product:price:amount"]',
    'meta[itemprop="price"]',
    'meta[name="twitter:data1"]',
    'meta[property="og:price:amount"]',
    'meta[name="price"]'
  ];
  
  for (const selector of metaSelectors) {
    const price = $(selector).attr('content');
    if (price) {
      console.log(`🔍 Meta tag bulundu: ${price}`);
      return { price: price, confidence: 'high' };
    }
  }
  
  return null;
}

function extractPriceFromJsonLd($, html) {
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
          
          // Common price properties
          if (obj.price) return obj.price;
          if (obj.offers && obj.offers.price) return obj.offers.price;
          if (obj.offers && Array.isArray(obj.offers) && obj.offers[0] && obj.offers[0].price) {
            return obj.offers[0].price;
          }
          
          // Recursive search
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
          console.log(`🔍 JSON-LD bulundu: ${price}`);
          return { price: String(price), confidence: 'high' };
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    // Silent fail
  }
  
  return null;
}

function extractPriceFromScriptTags($, html) {
  const scripts = $('script');
  const pricePatterns = [
    /"price"\s*:\s*["']?([\d.,]+)["']?/gi,
    /priceAmount["'\s:]*["']?([\d.,]+)["']?/gi,
    /currentPrice["'\s:]*["']?([\d.,]+)["']?/gi,
    /"value"\s*:\s*["']?([\d.,]+)["']?/gi,
    /"amount"\s*:\s*["']?([\d.,]+)["']?/gi,
    /fiyat["'\s:]*["']?([\d.,]+)["']?/gi,
    /product_price["'\s:]*["']?([\d.,]+)["']?/gi
  ];
  
  for (let i = 0; i < scripts.length; i++) {
    const content = $(scripts[i]).html() || '';
    
    for (const pattern of pricePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const priceMatch = match.match(/([\d.,]+)/);
          if (priceMatch && priceMatch[1]) {
            const price = priceMatch[1];
            // Validasyon: 10'dan büyük mü?
            const numeric = parseFloat(price.replace('.', '').replace(',', '.'));
            if (!isNaN(numeric) && numeric > 10) {
              console.log(`🔍 Script tag bulundu: ${price}`);
              return { price: price, confidence: 'medium' };
            }
          }
        }
      }
    }
  }
  
  return null;
}

function extractPriceByRegex(html, siteInfo) {
  // Türkçe fiyat pattern'leri
  const patterns = [
    /(?:₺|TL)\s*([\d.,]{3,})/gi,      // ₺ veya TL ile başlayan
    /([\d.,]{3,})\s*(?:₺|TL)/gi,      // ₺ veya TL ile biten
    /<[^>]*>([\d.,]{3,})[^<]*(?:₺|TL)[^<]*<\/[^>]*>/gi, // HTML içinde
    /data-price=["']([\d.,]+)["']/gi, // data-price attribute
    /data-amount=["']([\d.,]+)["']/gi // data-amount attribute
  ];
  
  const allPrices = [];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (matches) {
      for (const match of matches) {
        const priceMatch = match.match(/([\d.,]{3,})/);
        if (priceMatch && priceMatch[1]) {
          const price = priceMatch[1];
          // Basic validation
          const numeric = parseFloat(price.replace('.', '').replace(',', '.'));
          if (!isNaN(numeric) && numeric > 10 && numeric < 1000000) {
            allPrices.push({
              price: price,
              numeric: numeric,
              source: 'regex'
            });
          }
        }
      }
    }
  }
  
  if (allPrices.length > 0) {
    // En sık geçen fiyatı bul
    const priceCounts = {};
    allPrices.forEach(p => {
      priceCounts[p.price] = (priceCounts[p.price] || 0) + 1;
    });
    
    let mostCommonPrice = null;
    let maxCount = 0;
    
    for (const [price, count] of Object.entries(priceCounts)) {
      if (count > maxCount) {
        mostCommonPrice = price;
        maxCount = count;
      }
    }
    
    if (mostCommonPrice) {
      console.log(`🔍 Regex bulundu: ${mostCommonPrice} (${maxCount} kez)`);
      return { 
        price: mostCommonPrice, 
        confidence: maxCount > 1 ? 'medium' : 'low' 
      };
    }
  }
  
  return null;
}

function extractPriceByAttributes($) {
  // Price/fiyat içeren attribute'ları ara
  const priceElements = $('[class*="price"], [class*="Price"], [class*="fiyat"], [class*="Fiyat"]');
  
  const prices = [];
  
  priceElements.each((i, el) => {
    const text = $(el).text().trim();
    const html = $(el).html() || '';
    
    if (text && (text.includes('₺') || text.includes('TL') || /\d[\d.,]{3,}/.test(text))) {
      // Extract numeric price
      const priceMatch = text.match(/([\d.,]+)/);
      if (priceMatch && priceMatch[1]) {
        const numeric = parseFloat(priceMatch[1].replace('.', '').replace(',', '.'));
        if (!isNaN(numeric) && numeric > 10) {
          prices.push({
            text: text,
            price: priceMatch[1],
            numeric: numeric
          });
        }
      }
    }
  });
  
  if (prices.length > 0) {
    // En mantıklı fiyatı bul (genelde ortalama civarı)
    const sorted = prices.sort((a, b) => a.numeric - b.numeric);
    const medianIndex = Math.floor(sorted.length / 2);
    const medianPrice = sorted[medianIndex];
    
    console.log(`🔍 Attributes bulundu: ${medianPrice.price}`);
    return { price: medianPrice.price, confidence: 'medium' };
  }
  
  return null;
}

function extractPriceWildcard($, html) {
  // Son çare: Sayfadaki tüm sayıları bul ve analiz et
  const text = $('body').text();
  const numberPattern = /[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g;
  const numbers = text.match(numberPattern) || [];
  
  const validPrices = numbers
    .map(num => {
      const clean = num.replace(/\./g, '').replace(',', '.');
      const numeric = parseFloat(clean);
      return { original: num, numeric: numeric };
    })
    .filter(p => !isNaN(p.numeric) && p.numeric > 50 && p.numeric < 100000)
    .sort((a, b) => a.numeric - b.numeric);
  
  if (validPrices.length > 0) {
    // Gruplama: Benzer fiyatları grupla
    const groups = [];
    let currentGroup = [validPrices[0]];
    
    for (let i = 1; i < validPrices.length; i++) {
      const prev = validPrices[i-1].numeric;
      const curr = validPrices[i].numeric;
      
      if (Math.abs(curr - prev) / prev < 0.3) { // %30'dan az fark
        currentGroup.push(validPrices[i]);
      } else {
        groups.push([...currentGroup]);
        currentGroup = [validPrices[i]];
      }
    }
    groups.push(currentGroup);
    
    // En büyük grubu bul
    const largestGroup = groups.reduce((a, b) => a.length > b.length ? a : b);
    
    if (largestGroup.length >= 2) {
      const medianIndex = Math.floor(largestGroup.length / 2);
      const selectedPrice = largestGroup[medianIndex];
      
      console.log(`🔍 Wildcard bulundu: ${selectedPrice.original} (${largestGroup.length} benzer)`);
      return { price: selectedPrice.original, confidence: 'low' };
    }
  }
  
  return null;
}

function extractPriceSimple($, html, siteInfo) {
  // Basit fiyat arama (403/429 durumları için)
  const pricePatterns = [
    /₺\s*[\d.,]{3,}/g,
    /TL\s*[\d.,]{3,}/g,
    /[\d.,]{3,}\s*₺/g,
    /[\d.,]{3,}\s*TL/g
  ];
  
  const text = $('body').text().substring(0, 5000); // İlk 5000 karakter
  
  for (const pattern of pricePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // En uzun olanı al (genelde gerçek fiyat daha detaylı)
      const longest = matches.reduce((a, b) => a.length > b.length ? a : b);
      return { price: longest.replace(/\s+/g, ''), confidence: 'low' };
    }
  }
  
  return { price: null, confidence: 'none' };
}

// ========== FİYAT FORMATLAMA ==========

function formatPriceForTurkey(price) {
  if (!price || price === 'undefined' || price === 'null') {
    return 'Fiyat çekilemedi';
  }
  
  let formatted = String(price).trim();
  
  // Temizle
  formatted = formatted.replace(/\s+/g, '');
  
  // ₺ ekle (yoksa)
  if (!formatted.includes('₺') && !formatted.includes('TL')) {
    formatted = '₺' + formatted;
  }
  
  // Binlik ayracını kaldır (1.000 → 1000)
  formatted = formatted.replace(/\.(?=\d{3})/g, '');
  
  // Ondalık ayracını standardize et
  if (formatted.includes(',') && formatted.includes('.')) {
    // Son 2 haneden önceki noktayı virgül yap
    formatted = formatted.replace(/\.(\d{2})$/, ',$1');
  } else if (formatted.includes(',')) {
    // Virgülü koru
    const parts = formatted.split(',');
    if (parts.length === 2 && parts[1].length === 2) {
      // Zaten doğru formatta
    } else {
      // Formatı düzelt
      const match = formatted.match(/(\d+),(\d+)/);
      if (match && match[2].length > 2) {
        // Binlik ayracı yanlış kullanılmış
        formatted = formatted.replace(',', '');
      }
    }
  }
  
  // Son kontrol: Geçerli bir fiyat mı?
  const numericMatch = formatted.match(/([\d.,]+)/);
  if (!numericMatch) {
    return 'Fiyat çekilemedi';
  }
  
  const numericStr = numericMatch[1].replace('.', '').replace(',', '.');
  const numeric = parseFloat(numericStr);
  
  if (isNaN(numeric) || numeric <= 0) {
    return 'Fiyat çekilemedi';
  }
  
  return formatted;
}

// ========== DİĞER ENDPOINT'LER ==========

app.post('/fiyat-cek', async (req, res) => {
  try {
    const { urun } = req.body;
    res.json({
      success: true,
      fiyatlar: [],
      query: urun,
      note: 'Linkten fiyat çekmek için /fiyat-cek-link endpointini kullanın'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

app.post('/ai/yorum', (req, res) => {
  res.json({
    success: true,
    yorum: 'AI yorum sistemi aktif.',
    note: 'Geliştirme aşamasında'
  });
});

app.post('/ai/compare', (req, res) => {
  res.json({
    success: true,
    analysis: 'Karşılaştırma sistemi aktif.',
    note: 'Geliştirme aşamasında'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Universal Fiyat API çalışıyor',
    version: '5.0.0',
    supported_sites: [
      'Trendyol', 'Hepsiburada', 'n11', 'Amazon TR', 'Pazarama', 'ÇiçekSepeti',
      'Teknosa', 'MediaMarkt', 'Vatan Bilgisayar', 'İtopya', 'İnceHesap',
      'İdefix', 'PTT AVm'
    ],
    note: '20+ site destekleniyor'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    version: '5.0.0',
    timestamp: new Date().toISOString(),
    endpoints: ['/health', '/fiyat-cek', '/fiyat-cek-link', '/ai/yorum', '/ai/compare'],
    capability: 'universal_price_extraction_v2'
  });
});

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  console.log(`
  🚀 UNIVERSAL FİYAT API v5.0
  📍 Port: ${PORT}
  🏪 Desteklenen Siteler: 20+
  🔧 Yöntemler: 7 farklı fiyat bulma
  ✅ Hazır: /fiyat-cek-link
  ⚡ Tüm linkler için optimize edildi
  `);
});
