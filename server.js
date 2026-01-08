// server.js - BOT ENGELLEME ATLATMA SİSTEMİ
import express from 'express';
import cors from 'cors';
import { load } from 'cheerio';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== AKILLI PROXY/HEADERS YÖNETİCİSİ ==========
class SmartFetcher {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    
    this.referers = {
      'MediaMarkt': 'https://www.google.com/',
      'PTT AVm': 'https://www.google.com/',
      'İnceHesap': 'https://www.akakce.com/',
      'Vatan Bilgisayar': 'https://www.google.com/',
      'default': 'https://www.google.com/'
    };
  }
  
  getHeadersForSite(siteName) {
    const randomUA = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    const referer = this.referers[siteName] || this.referers.default;
    
    return {
      'User-Agent': randomUA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'Referer': referer,
      'DNT': '1',
      'Connection': 'keep-alive'
    };
  }
  
  async fetchWithRetry(url, siteName, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${siteName} için deneme ${attempt + 1}/${maxRetries + 1}`);
        
        const headers = this.getHeadersForSite(siteName);
        
        // Her denemede farklı timeout
        const timeout = 8000 + (attempt * 2000);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          headers,
          signal: controller.signal,
          redirect: 'follow',
          // Cloudflare bypass için
          cf: {
            cacheEverything: false,
            cacheTtl: 0
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 403 || response.status === 429) {
          console.log(`⚠️ ${siteName}: HTTP ${response.status} - Bot engellendi`);
          
          if (attempt < maxRetries) {
            // Bekle ve tekrar dene
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          } else {
            throw new Error(`Bot engellendi: HTTP ${response.status}`);
          }
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return response;
        
      } catch (error) {
        console.error(`${siteName} fetch hatası (attempt ${attempt + 1}):`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
}

const fetcher = new SmartFetcher();

// ========== ÖZEL SİTE HANDLER'LARI ==========

const siteHandlers = {
  // MEDIAMARKT ÖZEL HANDLER
  'MediaMarkt': {
    async fetch(url) {
      console.log('🎯 MediaMarkt özel handler çalışıyor...');
      
      // MediaMarkt için özel headers
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.google.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1'
      };
      
      try {
        const response = await fetch(url, {
          headers,
          timeout: 10000,
          redirect: 'follow'
        });
        
        if (response.ok) {
          return response;
        }
        
        // 403/429 durumunda alternatif URL dene
        if (response.status === 403 || response.status === 429) {
          console.log('🔄 MediaMarkt alternatif URL deneniyor...');
          
          // URL'yi temizle
          const cleanUrl = url.split('?')[0]; // Query param'leri kaldır
          const altResponse = await fetch(cleanUrl, {
            headers: { ...headers, 'User-Agent': fetcher.userAgents[2] },
            timeout: 8000
          });
          
          if (altResponse.ok) {
            return altResponse;
          }
        }
        
        throw new Error(`MediaMarkt: HTTP ${response.status}`);
        
      } catch (error) {
        console.error('MediaMarkt handler hatası:', error.message);
        throw error;
      }
    },
    
    extractPrice($, html) {
      console.log('🔍 MediaMarkt fiyat çekiliyor...');
      
      // MediaMarkt için özel selector'lar
      const priceSelectors = [
        '.price-box',
        '.product-price',
        '.mm-price',
        '[itemprop="price"]',
        '.sales-price',
        '.current-price',
        '.price-tag'
      ];
      
      for (const selector of priceSelectors) {
        const element = $(selector).first();
        if (element.length) {
          const priceText = element.text().trim();
          if (priceText && (priceText.includes('₺') || priceText.includes('TL') || /\d[\d.,]{3,}/.test(priceText))) {
            console.log(`🎯 MediaMarkt selector bulundu (${selector}): ${priceText}`);
            return priceText;
          }
        }
      }
      
      // Meta tag'lerden dene
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                       $('meta[itemprop="price"]').attr('content');
      
      if (metaPrice) {
        console.log(`🎯 MediaMarkt meta bulundu: ${metaPrice}`);
        return '₺' + metaPrice;
      }
      
      // Script tag'lerinde ara
      const scripts = $('script');
      for (let i = 0; i < scripts.length; i++) {
        const scriptContent = $(scripts[i]).html() || '';
        if (scriptContent.includes('price') || scriptContent.includes('fiyat')) {
          const priceMatch = scriptContent.match(/"price"\s*:\s*["']?([\d.,]+)["']?/);
          if (priceMatch && priceMatch[1]) {
            console.log(`🎯 MediaMarkt script bulundu: ${priceMatch[1]}`);
            return '₺' + priceMatch[1];
          }
        }
      }
      
      return null;
    }
  },
  
  // PTT AVm ÖZEL HANDLER
  'PTT AVm': {
    async fetch(url) {
      console.log('🎯 PTT AVm özel handler çalışıyor...');
      
      // PTT AVm için daha basit headers (bazen daha iyi çalışıyor)
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Referer': 'https://www.akakce.com/',
        'Cache-Control': 'no-cache'
      };
      
      try {
        const response = await fetch(url, {
          headers,
          timeout: 12000,
          redirect: 'follow'
        });
        
        return response;
        
      } catch (error) {
        console.error('PTT AVm handler hatası:', error.message);
        throw error;
      }
    },
    
    extractPrice($, html) {
      console.log('🔍 PTT AVm fiyat çekiliyor...');
      
      // PTT AVm için selector'lar
      const priceSelectors = [
        '.product-price',
        '.price',
        '.sales-price',
        '.current-price',
        '.discount-price',
        '[class*="price"]'
      ];
      
      for (const selector of priceSelectors) {
        const elements = $(selector);
        for (let i = 0; i < elements.length; i++) {
          const priceText = $(elements[i]).text().trim();
          if (priceText && (priceText.includes('₺') || priceText.includes('TL') || /\d[\d.,]{3,}/.test(priceText))) {
            console.log(`🎯 PTT AVm selector bulundu (${selector}): ${priceText}`);
            return priceText;
          }
        }
      }
      
      return null;
    }
  },
  
  // İNCEHESAP ÖZEL HANDLER
  'İnceHesap': {
    async fetch(url) {
      console.log('🎯 İnceHesap özel handler çalışıyor...');
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Referer': 'https://www.akakce.com/',
        'Origin': 'https://www.akakce.com',
        'Cache-Control': 'no-cache'
      };
      
      try {
        const response = await fetch(url, {
          headers,
          timeout: 10000
        });
        
        return response;
        
      } catch (error) {
        console.error('İnceHesap handler hatası:', error.message);
        throw error;
      }
    },
    
    extractPrice($, html) {
      console.log('🔍 İnceHesap fiyat çekiliyor...');
      
      // İnceHesap genellikle bu selector'ları kullanıyor
      const priceSelectors = [
        '.product-price',
        '#product-price',
        '.price',
        '.current-price',
        '[itemprop="price"]'
      ];
      
      for (const selector of priceSelectors) {
        const element = $(selector).first();
        if (element.length) {
          let price = element.text().trim();
          if (!price && element.attr('content')) {
            price = element.attr('content');
          }
          
          if (price && (price.includes('₺') || price.includes('TL') || /\d[\d.,]{3,}/.test(price))) {
            console.log(`🎯 İnceHesap selector bulundu (${selector}): ${price}`);
            return price;
          }
        }
      }
      
      return null;
    }
  }
};

// ========== ANA FIYAT ÇEKME ENDPOINT'İ ==========

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
    
    console.log(`🌐 Fiyat çekme başlatılıyor: ${url}`);
    
    // Site tanıma
    const siteInfo = detectSite(url);
    console.log(`🏪 Site: ${siteInfo.name}, Zorluk: ${siteInfo.difficulty}`);
    
    // Özel handler var mı?
    const specialHandler = siteHandlers[siteInfo.name];
    
    let response;
    let html;
    let $;
    
    if (specialHandler) {
      // ÖZEL HANDLER KULLAN
      console.log(`🎯 ${siteInfo.name} için özel handler kullanılıyor...`);
      
      try {
        response = await specialHandler.fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        html = await response.text();
        $ = load(html);
        
        // Özel handler ile fiyat çek
        const price = specialHandler.extractPrice($, html);
        
        if (price) {
          const formattedPrice = formatPrice(price);
          const title = extractTitle($, siteInfo);
          
          return res.json({
            success: true,
            urun: title,
            fiyat: formattedPrice,
            site: siteInfo.name,
            link: url,
            timestamp: new Date().toISOString(),
            method: 'special_handler'
          });
        }
        
      } catch (handlerError) {
        console.error(`${siteInfo.name} özel handler hatası:`, handlerError.message);
        // Fallback to normal method
        console.log('🔄 Normal yönteme geçiliyor...');
      }
    }
    
    // NORMAL YÖNTEM (özel handler yoksa veya başarısız olduysa)
    console.log(`🔄 ${siteInfo.name} için normal yöntem deneniyor...`);
    
    try {
      // Retry mekanizması ile fetch
      response = await fetcher.fetchWithRetry(url, siteInfo.name);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      html = await response.text();
      $ = load(html);
      
      // Bot engelleme kontrolü
      if (isBotBlocked($, html, siteInfo.name)) {
        console.log(`🚫 ${siteInfo.name} bot engellemiş görünüyor`);
        return res.json({
          success: false,
          error: 'Site bot erişimini engelledi',
          urun: 'Ürün',
          fiyat: 'Fiyat çekilemedi',
          site: siteInfo.name,
          link: url,
          note: 'Cloudflare veya benzeri koruma tespit edildi'
        });
      }
      
      // Ürün adı
      const title = extractTitle($, siteInfo);
      console.log(`📝 Ürün: ${title.substring(0, 80)}...`);
      
      // Fiyat çek
      const priceResult = extractPriceWithMultipleMethods($, html, siteInfo);
      
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
        console.log(`❌ Fiyat bulunamadı: ${priceResult.error}`);
        
        return res.json({
          success: false,
          error: priceResult.error,
          urun: title,
          fiyat: 'Fiyat çekilemedi',
          site: siteInfo.name,
          link: url,
          note: 'HTML yapısı farklı olabilir'
        });
      }
      
    } catch (fetchError) {
      console.error(`❌ ${siteInfo.name} fetch hatası:`, fetchError.message);
      
      // SON ÇARE: Public API/Alternative source dene
      console.log('🆘 Alternatif kaynak deneniyor...');
      const fallbackResult = await tryFallbackSources(url, siteInfo);
      
      if (fallbackResult.success) {
        return res.json(fallbackResult);
      }
      
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

// ========== YARDIMCI FONKSİYONLAR ==========

function detectSite(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    const siteMap = {
      // Bot korumalı siteler (yüksek zorluk)
      'mediamarkt.com.tr': { name: 'MediaMarkt', difficulty: 'high', needsSpecialHandler: true },
      'pttavm.com': { name: 'PTT AVm', difficulty: 'high', needsSpecialHandler: true },
      'incehesap.com': { name: 'İnceHesap', difficulty: 'medium', needsSpecialHandler: true },
      
      // Normal siteler
      'trendyol.com': { name: 'Trendyol', difficulty: 'low', needsSpecialHandler: false },
      'hepsiburada.com': { name: 'Hepsiburada', difficulty: 'low', needsSpecialHandler: false },
      'n11.com': { name: 'n11', difficulty: 'low', needsSpecialHandler: false },
      'vatanbilgisayar.com': { name: 'Vatan Bilgisayar', difficulty: 'medium', needsSpecialHandler: false },
      'teknosa.com': { name: 'Teknosa', difficulty: 'medium', needsSpecialHandler: false },
      'ciceksepeti.com': { name: 'ÇiçekSepeti', difficulty: 'medium', needsSpecialHandler: false },
      'pazarama.com': { name: 'Pazarama', difficulty: 'medium', needsSpecialHandler: false },
      'itopya.com': { name: 'İtopya', difficulty: 'medium', needsSpecialHandler: false },
      'idefix.com': { name: 'İdefix', difficulty: 'medium', needsSpecialHandler: false },
      'amazon.com.tr': { name: 'Amazon TR', difficulty: 'medium', needsSpecialHandler: false }
    };
    
    for (const [domain, info] of Object.entries(siteMap)) {
      if (hostname.includes(domain)) {
        return info;
      }
    }
    
    // Bilinmeyen site
    const domainName = hostname.replace('www.', '').split('.')[0];
    return { 
      name: domainName.charAt(0).toUpperCase() + domainName.slice(1), 
      difficulty: 'high',
      needsSpecialHandler: false
    };
    
  } catch (error) {
    return { name: 'Bilinmeyen', difficulty: 'high', needsSpecialHandler: false };
  }
}

function isBotBlocked($, html, siteName) {
  // Cloudflare veya bot koruması işaretlerini kontrol et
  
  // 1. Cloudflare challenge sayfası
  if (html.includes('cf-browser-verification') || 
      html.includes('challenge-running') ||
      html.includes('cloudflare')) {
    console.log(`🚫 ${siteName}: Cloudflare tespit edildi`);
    return true;
  }
  
  // 2. "Access denied" veya "Bot" mesajları
  const blockedIndicators = [
    'access denied',
    'bot detected',
    'robot detected',
    'forbidden',
    'captcha',
    'security check'
  ];
  
  const pageText = $('body').text().toLowerCase();
  for (const indicator of blockedIndicators) {
    if (pageText.includes(indicator)) {
      console.log(`🚫 ${siteName}: ${indicator} tespit edildi`);
      return true;
    }
  }
  
  // 3. Çok kısa HTML (genelde redirect veya block sayfası)
  if (html.length < 5000 && !html.includes(siteName.toLowerCase())) {
    console.log(`🚫 ${siteName}: Çok kısa HTML (${html.length} karakter)`);
    return true;
  }
  
  return false;
}

function extractTitle($, siteInfo) {
  let title = '';
  
  // Site'ye özel title selector'ları
  const titleSelectors = {
    'MediaMarkt': ['h1.product-name', '.product-title', 'h1[itemprop="name"]'],
    'PTT AVm': ['h1.product-name', '.product-title', '.product-header h1'],
    'İnceHesap': ['h1.product-title', '.product-name', 'h1[itemprop="name"]'],
    'Vatan Bilgisayar': ['h1.product-list__product-name', '.product-name h1'],
    'default': ['h1', '.product-title', '[itemprop="name"]', 'title']
  };
  
  const selectors = titleSelectors[siteInfo.name] || titleSelectors.default;
  
  for (const selector of selectors) {
    title = $(selector).first().text().trim();
    if (title && title.length > 3) break;
  }
  
  // Meta tag fallback
  if (!title || title.length < 3) {
    title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text().trim();
  }
  
  // URL fallback
  if (!title || title.length < 3) {
    try {
      const urlObj = new URL(siteInfo.url || '');
      const pathParts = urlObj.pathname.split('/').filter(p => p && !p.match(/^\d+$/));
      if (pathParts.length > 0) {
        title = pathParts[pathParts.length - 1]
          .replace(/-/g, ' ')
          .replace(/\+/g, ' ')
          .trim();
      }
    } catch (e) {}
  }
  
  title = title || 'Ürün';
  title = title.replace(/\s+/g, ' ').trim().substring(0, 150);
  
  return title;
}

function extractPriceWithMultipleMethods($, html, siteInfo) {
  const methods = [
    { name: 'direct_selectors', func: () => extractWithDirectSelectors($, siteInfo) },
    { name: 'meta_tags', func: () => extractFromMetaTags($) },
    { name: 'json_ld', func: () => extractFromJsonLd($, html) },
    { name: 'regex_search', func: () => extractWithRegex(html) },
    { name: 'wildcard', func: () => extractWithWildcard($, html) }
  ];
  
  for (const method of methods) {
    try {
      const price = method.func();
      if (price) {
        const formatted = formatPrice(price);
        if (formatted && formatted !== 'Fiyat çekilemedi') {
          return {
            success: true,
            price: formatted,
            method: method.name,
            confidence: 'medium',
            raw: price
          };
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return {
    success: false,
    error: 'Fiyat bulunamadı',
    price: null,
    method: 'none'
  };
}

function extractWithDirectSelectors($, siteInfo) {
  const selectorGroups = {
    'MediaMarkt': ['.price-box', '.product-price', '.mm-price', '[itemprop="price"]'],
    'PTT AVm': ['.product-price', '.price', '.sales-price', '[class*="price"]'],
    'İnceHesap': ['.product-price', '#product-price', '[itemprop="price"]'],
    'Vatan Bilgisayar': ['.product-list__price', '.price', '.product-price'],
    'default': ['.price', '.product-price', '[itemprop="price"]', '[class*="price"]', '[class*="fiyat"]']
  };
  
  const selectors = selectorGroups[siteInfo.name] || selectorGroups.default;
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      let price = element.text().trim();
      
      // Attribute'dan da kontrol et
      if (!price && element.attr('content')) {
        price = element.attr('content');
      }
      
      if (price && (price.includes('₺') || price.includes('TL') || /\d[\d.,]{3,}/.test(price))) {
        console.log(`🎯 Direct selector (${selector}): ${price}`);
        return price;
      }
    }
  }
  
  return null;
}

function extractFromMetaTags($) {
  const metaSelectors = [
    'meta[property="product:price:amount"]',
    'meta[itemprop="price"]',
    'meta[name="twitter:data1"]'
  ];
  
  for (const selector of metaSelectors) {
    const price = $(selector).attr('content');
    if (price) {
      console.log(`🎯 Meta tag: ${price}`);
      return price;
    }
  }
  
  return null;
}

function extractFromJsonLd($, html) {
  try {
    const scripts = $('script[type="application/ld+json"]');
    
    for (let i = 0; i < scripts.length; i++) {
      try {
        const scriptText = $(scripts[i]).html();
        if (!scriptText) continue;
        
        const data = JSON.parse(scriptText);
        
        // Recursive price search
        const findPrice = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.price) return obj.price;
          if (obj.offers && obj.offers.price) return obj.offers.price;
          
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
  
  return null;
}

function extractWithRegex(html) {
  const patterns = [
    /(?:₺|TL)\s*([\d.,]{3,})/g,
    /([\d.,]{3,})\s*(?:₺|TL)/g,
    /data-price=["']([\d.,]+)["']/g,
    /"price"\s*:\s*["']?([\d.,]+)["']?/g
  ];
  
  const allMatches = [];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (matches) {
      for (const match of matches) {
        const priceMatch = match.match(/([\d.,]{3,})/);
        if (priceMatch && priceMatch[1]) {
          allMatches.push(priceMatch[1]);
        }
      }
    }
  }
  
  if (allMatches.length > 0) {
    // En sık geçeni bul
    const counts = {};
    allMatches.forEach(m => {
      counts[m] = (counts[m] || 0) + 1;
    });
    
    let mostCommon = null;
    let maxCount = 0;
    
    for (const [price, count] of Object.entries(counts)) {
      if (count > maxCount) {
        mostCommon = price;
        maxCount = count;
      }
    }
    
    if (mostCommon) {
      console.log(`🎯 Regex: ${mostCommon} (${maxCount} kez)`);
      return mostCommon;
    }
  }
  
  return null;
}

function extractWithWildcard($, html) {
  const text = $('body').text();
  const numberPattern = /[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g;
  const numbers = text.match(numberPattern) || [];
  
  const validPrices = numbers
    .map(num => ({
      original: num,
      numeric: parseFloat(num.replace(/\./g, '').replace(',', '.'))
    }))
    .filter(p => !isNaN(p.numeric) && p.numeric > 50 && p.numeric < 50000)
    .sort((a, b) => a.numeric - b.numeric);
  
  if (validPrices.length >= 3) {
    // Median price'ı al
    const medianIndex = Math.floor(validPrices.length / 2);
    const selected = validPrices[medianIndex];
    
    console.log(`🎯 Wildcard: ${selected.original}`);
    return selected.original;
  }
  
  return null;
}

async function tryFallbackSources(url, siteInfo) {
  console.log(`🆘 Fallback kaynak deneniyor: ${siteInfo.name}`);
  
  // Akakçe API'si veya benzeri fallback
  try {
    // Ürün adını çıkar
    const productName = extractProductNameFromURL(url);
    
    if (productName) {
      // Akakçe arama URL'si (genel fiyat bilgisi için)
      const akakceUrl = `https://www.akakce.com/arama/?q=${encodeURIComponent(productName)}`;
      
      const response = await fetch(akakceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      });
      
      if (response.ok) {
        const html = await response.text();
        const $ = load(html);
        
        // Akakçe'de fiyat ara
        const priceElement = $('.pt_v8').first();
        if (priceElement.length) {
          const price = priceElement.text().trim();
          if (price && price.includes('TL')) {
            console.log(`🆘 Fallback (Akakçe) bulundu: ${price}`);
            
            return {
              success: true,
              urun: productName,
              fiyat: price.replace('TL', '₺'),
              site: siteInfo.name,
              link: url,
              timestamp: new Date().toISOString(),
              method: 'fallback_akakce',
              note: 'Akakçe üzerinden yaklaşık fiyat'
            };
          }
        }
      }
    }
  } catch (fallbackError) {
    console.error('Fallback hatası:', fallbackError.message);
  }
  
  return {
    success: false,
    error: 'Fallback kaynaklarda da fiyat bulunamadı'
  };
}

function extractProductNameFromURL(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // URL'den ürün adını çıkar
    const segments = pathname.split('/').filter(s => s && !s.match(/^p-|product-|urun-|\d+$|\.html$/));
    
    if (segments.length > 0) {
      return segments[segments.length - 1]
        .replace(/-/g, ' ')
        .replace(/\+/g, ' ')
        .replace(/_/g, ' ')
        .trim();
    }
  } catch (e) {
    // Hata yok say
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
  
  // ₺ ekle
  if (!formatted.includes('₺') && !formatted.includes('TL')) {
    formatted = '₺' + formatted;
  } else if (formatted.includes('TL')) {
    formatted = formatted.replace('TL', '₺');
  }
  
  // Binlik ayracını kaldır
  formatted = formatted.replace(/\.(?=\d{3})/g, '');
  
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
      note: 'Linkten fiyat çekmek için /fiyat-cek-link kullanın'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Akıllı Fiyat API çalışıyor',
    version: '6.0.0',
    features: ['bot_bypass', 'special_handlers', 'fallback_system'],
    supported_sites: [
      'Trendyol', 'Hepsiburada', 'n11', 'Amazon TR', 'Pazarama', 'ÇiçekSepeti',
      'Teknosa', 'MediaMarkt', 'Vatan Bilgisayar', 'İtopya', 'İnceHesap',
      'İdefix', 'PTT AVm'
    ],
    note: 'Bot engellemeli siteler için özel handler\'lar aktif'
  });
});

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  console.log(`
  🚀 AKILLI FİYAT API v6.0
  📍 Port: ${PORT}
  🛡️  Özellik: Bot engelleme bypass
  🎯 Özel Handler: MediaMarkt, PTT AVm, İnceHesap
  🔄 Retry: 3 deneme + farklı User-Agent
  🆘 Fallback: Akakçe entegrasyonu
  ✅ Hazır: /fiyat-cek-link
  `);
});
