// server.js - TAM 700+ SATIR - GÜNCELLENMİŞ
import express from 'express';
import cors from 'cors';
import { load } from 'cheerio';
import fetch from 'node-fetch';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== HUGGING FACE AI KONFİGÜRASYONU ==========
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || "";
const AI_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";

// ========== SİTE KONFİGÜRASYONLARI ==========
const SITE_CONFIGS = {
  'trendyol.com': {
    name: 'Trendyol',
    working: true,
    title: ['h1.pr-new-br', '[data-drroot="product-title"]'],
    price: [
      { selector: '[data-bind="markupText: currentPrice"]', type: 'text' },
      { selector: '.prc-dsc', type: 'text' },
      { selector: '.original', type: 'text' },
      { selector: '.price', type: 'text' }
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /"offers":{[^}]*"price":([\d.,]+)/g, type: 'regex' }
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
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":[\s]*"([\d.,]+)"/g, type: 'regex' },
      { pattern: /data-asin-price="([\d.,]+)"/g, type: 'regex' }
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
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /itemprop="price" content="([\d.,]+)"/g, type: 'regex' }
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
    ],
    jsonLd: false,
    apiPatterns: [
      { pattern: /data-price="([\d.,]+)"/g, type: 'regex' },
      { pattern: /"price":[\s]*([\d.,]+)/g, type: 'regex' }
    ]
  },
  
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
      { selector: '[data-test-id="default-price"] span', type: 'text' },
      { selector: '[data-test-id="price-current"]', type: 'text' },
      { selector: '[data-bind="markupText: currentPriceBeforePoint"]', type: 'text' },
      { selector: '.price', type: 'text' },
      { selector: '[itemprop="price"]', type: 'attr', attr: 'content' }
    ],
    apiUrlPattern: 'https://www.hepsiburada.com/api/v2/product-detail',
    jsonLd: true,
    useApiFirst: true
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
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /"salePrice":([\d.,]+)/g, type: 'regex' }
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
    ],
    apiPatterns: [
      { pattern: /"price":[\s]*"([\d.,]+)"/g, type: 'regex' },
      { pattern: /data-price="([\d.,]+)"/g, type: 'regex' },
      { pattern: /MM\.price = "([\d.,]+)"/g, type: 'regex' }
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
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /data-price="([\d.,]+)"/g, type: 'regex' }
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
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /itemprop="price" content="([\d.,]+)"/g, type: 'regex' }
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
    ],
    jsonLd: false,
    apiPatterns: [
      { pattern: /"price":[\s]*([\d.,]+)/g, type: 'regex' },
      { pattern: /data-price="([\d.,]+)"/g, type: 'regex' }
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
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /itemprop="price" content="([\d.,]+)"/g, type: 'regex' }
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
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /itemprop="price" content="([\d.,]+)"/g, type: 'regex' }
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
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /itemprop="price" content="([\d.,]+)"/g, type: 'regex' }
    ]
  },
  
  'migros.com.tr': {
    name: 'Migros Sanal Market',
    working: true,
    title: [
      'h1.product-name',
      '.product-title',
      '[data-testid="product-title"]'
    ],
    price: [
      { selector: '.price', type: 'text' },
      { selector: '.product-price', type: 'text' },
      { selector: '[data-testid="price"]', type: 'text' }
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /data-price="([\d.,]+)"/g, type: 'regex' }
    ]
  },
  
  'gittigidiyor.com': {
    name: 'GittiGidiyor',
    working: true,
    title: [
      'h1.product-title',
      '[data-gg-product-title]',
      'h1[itemprop="name"]'
    ],
    price: [
      { selector: '.price', type: 'text' },
      { selector: '.last-price', type: 'text' },
      { selector: '[itemprop="price"]', type: 'attr', attr: 'content' }
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /data-price="([\d.,]+)"/g, type: 'regex' }
    ]
  },
  
  'kitapyurdu.com': {
    name: 'KitapYurdu',
    working: true,
    title: [
      'h1.product-name',
      '.pr_header h1',
      'h1[itemprop="name"]'
    ],
    price: [
      { selector: '.price', type: 'text' },
      { selector: '.product-price', type: 'text' },
      { selector: '.current-price', type: 'text' }
    ],
    jsonLd: true,
    apiPatterns: [
      { pattern: /"price":"([\d.,]+)"/g, type: 'regex' },
      { pattern: /itemprop="price" content="([\d.,]+)"/g, type: 'regex' }
    ]
  }
};

// ========== JSON-LD STRUCTURED DATA ÇEKME ==========
function extractJsonLdData(html) {
  try {
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (!jsonLdMatches) return null;
    
    for (const match of jsonLdMatches) {
      try {
        const jsonStr = match.replace(/<script[^>]*>|<\/script>/g, '').trim();
        const data = JSON.parse(jsonStr);
        
        if (data['@type'] === 'Product' || data['@type']?.includes('Product')) {
          const price = data.offers?.price || data.price;
          const title = data.name || data.title;
          
          if (price && title) {
            return { title, price: String(price), source: 'json-ld' };
          }
        }
        
        if (data['@type'] === 'AggregateOffer') {
          const price = data.lowPrice || data.highPrice || data.offerCount;
          if (price) {
            return { title: 'Ürün', price: String(price), source: 'aggregate-offer' };
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.error('JSON-LD parse hatası:', error.message);
  }
  return null;
}

// ========== MICRODATA (itemprop) ÇEKME ==========
function extractMicrodata(html) {
  try {
    const $ = load(html);
    
    const priceElement = $('[itemprop="price"]');
    if (priceElement.length) {
      const price = priceElement.attr('content') || priceElement.text().trim();
      const title = $('[itemprop="name"]').text().trim() || $('title').text().trim();
      
      if (price && price.match(/\d/)) {
        return { title: title || 'Ürün', price, source: 'microdata' };
      }
    }
  } catch (error) {
    console.error('Microdata extract hatası:', error.message);
  }
  return null;
}

// ========== OPEN GRAPH META ETİKETLERİ ==========
function extractOpenGraphData(html) {
  try {
    const $ = load(html);
    
    const ogTitle = $('meta[property="og:title"]').attr('content') || 
                    $('meta[name="og:title"]').attr('content');
    
    const ogPrice = $('meta[property="product:price:amount"]').attr('content') ||
                    $('meta[property="og:price:amount"]').attr('content') ||
                    $('meta[name="price"]').attr('content');
    
    if (ogPrice && ogPrice.match(/\d/)) {
      return { 
        title: ogTitle || 'Ürün', 
        price: ogPrice, 
        source: 'open-graph' 
      };
    }
  } catch (error) {
    console.error('Open Graph extract hatası:', error.message);
  }
  return null;
}

// ========== SİTE ÖZEL API ÇAĞRILARI ==========
async function fetchSiteAPI(url, siteConfig) {
  try {
    const urlParts = url.split('/');
    const productId = urlParts[urlParts.length - 1].match(/\d+/)?.[0] || 
                      urlParts[urlParts.length - 2].match(/\d+/)?.[0];
    
    if (!productId) return null;
    
    const apiEndpoints = {
      'hepsiburada.com': `https://www.hepsiburada.com/api/v2/product-detail?productId=${productId}`,
      'n11.com': `https://www.n11.com/product/api?productId=${productId}`,
      'trendyol.com': `https://www.trendyol.com/api/product/${productId}`,
      'pazarama.com': `https://www.pazarama.com/api/v1/products/${productId}`
    };
    
    const apiUrl = apiEndpoints[siteConfig.name.toLowerCase()];
    if (!apiUrl) return null;
    
    const response = await fetch(apiUrl, {
      headers: getHeadersForSite(siteConfig.name),
      timeout: 10000
    });
    
    if (response.ok) {
      const apiData = await response.json();
      
      let price = null;
      let title = null;
      
      if (siteConfig.name === 'Hepsiburada') {
        price = apiData?.result?.product?.price?.sellingPrice || 
                apiData?.price;
        title = apiData?.result?.product?.name || 
                apiData?.title;
      }
      else if (siteConfig.name === 'n11') {
        price = apiData?.price || apiData?.salePrice;
        title = apiData?.title || apiData?.name;
      }
      else if (siteConfig.name === 'Trendyol') {
        price = apiData?.price || apiData?.sellingPrice;
        title = apiData?.title || apiData?.name;
      }
      
      if (price && title) {
        return { title, price: String(price), source: 'site-api' };
      }
    }
  } catch (error) {
    console.error(`${siteConfig.name} API hatası:`, error.message);
  }
  return null;
}

// ========== GELİŞMİŞ REGEX İLE FİYAT BULMA ==========
function findPriceWithRegex(html, siteConfig) {
  try {
    const regexPatterns = [
      /(?:₺|TL|USD|EUR)[\s:]*([\d.,]{3,})/gi,
      /([\d.,]{3,})[\s]*(?:₺|TL|USD|EUR)/gi,
      /price["']?\s*[=:]\s*["']?([\d.,]+)/gi,
      /data-price=["']([\d.,]+)["']/gi,
      /"price"\s*:\s*["']?([\d.,]+)/gi,
      /"salePrice"\s*:\s*["']?([\d.,]+)/gi,
      /"currentPrice"\s*:\s*["']?([\d.,]+)/gi,
      /"value"\s*:\s*["']?([\d.,]+)/gi
    ];
    
    if (siteConfig.apiPatterns) {
      siteConfig.apiPatterns.forEach(pattern => {
        if (pattern.type === 'regex') {
          regexPatterns.push(pattern.pattern);
        }
      });
    }
    
    const foundPrices = [];
    
    for (const pattern of regexPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const priceMatch = match.match(/([\d.,]{3,})/);
          if (priceMatch) {
            const price = priceMatch[1];
            const cleanedPrice = price.replace(/\.(?=\d{3})/g, '');
            if (!foundPrices.includes(cleanedPrice)) {
              foundPrices.push(cleanedPrice);
            }
          }
        });
      }
    }
    
    if (foundPrices.length > 0) {
      const priceCounts = {};
      foundPrices.forEach(p => {
        priceCounts[p] = (priceCounts[p] || 0) + 1;
      });
      
      const mostCommonPrice = Object.keys(priceCounts).reduce((a, b) => 
        priceCounts[a] > priceCounts[b] ? a : b
      );
      
      return mostCommonPrice;
    }
  } catch (error) {
    console.error('Regex price find hatası:', error.message);
  }
  return null;
}

// ========== ANA FİYAT ÇEKME FONKSİYONU ==========
async function fetchPriceFromUrl(url, siteConfig) {
  console.log(`🔍 ${siteConfig.name} için fiyat aranıyor...`);
  
  let html = null;
  let finalData = { title: '', price: '', source: '' };
  
  try {
    if (siteConfig.useApiFirst || siteConfig.apiUrlPattern) {
      const apiData = await fetchSiteAPI(url, siteConfig);
      if (apiData) {
        console.log(`✅ ${siteConfig.name} API'den fiyat bulundu`);
        return apiData;
      }
    }
    
    html = await fetchWithSmartHeaders(url, siteConfig.name);
    if (!html) {
      throw new Error('Sayfa yüklenemedi');
    }
    
    const $ = load(html);
    
    const jsonLdData = extractJsonLdData(html);
    if (jsonLdData) {
      console.log(`✅ JSON-LD'den fiyat bulundu: ${jsonLdData.price}`);
      finalData = jsonLdData;
    }
    
    if (!finalData.price) {
      const microdata = extractMicrodata(html);
      if (microdata) {
        console.log(`✅ Microdata'dan fiyat bulundu: ${microdata.price}`);
        finalData = microdata;
      }
    }
    
    if (!finalData.price) {
      const ogData = extractOpenGraphData(html);
      if (ogData) {
        console.log(`✅ Open Graph'dan fiyat bulundu: ${ogData.price}`);
        finalData = ogData;
      }
    }
    
    if (!finalData.price) {
      for (const priceConfig of siteConfig.price) {
        const element = $(priceConfig.selector).first();
        if (element.length) {
          let price = '';
          
          if (priceConfig.type === 'attr' && priceConfig.attr) {
            price = element.attr(priceConfig.attr) || '';
          } else {
            price = element.text().trim();
          }
          
          if (price && price.match(/\d/)) {
            console.log(`✅ CSS Selector'dan fiyat bulundu: ${price}`);
            finalData.price = price;
            finalData.source = 'css-selector';
            break;
          }
        }
      }
    }
    
    if (!finalData.price) {
      const regexPrice = findPriceWithRegex(html, siteConfig);
      if (regexPrice) {
        console.log(`✅ Regex'den fiyat bulundu: ${regexPrice}`);
        finalData.price = regexPrice;
        finalData.source = 'regex';
      }
    }
    
    if (!finalData.title) {
      for (const selector of siteConfig.title) {
        const title = $(selector).first().text().trim();
        if (title && title.length > 3) {
          finalData.title = title.substring(0, 150);
          break;
        }
      }
      
      if (!finalData.title) {
        finalData.title = $('title').text().trim().substring(0, 150) || 'Ürün';
      }
    }
    
    return finalData;
    
  } catch (error) {
    console.error(`${siteConfig.name} fiyat çekme hatası:`, error.message);
    return { title: 'Ürün', price: '', source: 'error', error: error.message };
  }
}

// ========== HEADERS ==========
function getHeadersForSite(siteName) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  };
  
  const siteHeaders = {
    'Hepsiburada': {
      'Referer': 'https://www.hepsiburada.com/',
      'Host': 'www.hepsiburada.com',
      'DNT': '1',
      'Sec-Fetch-Site': 'same-origin'
    },
    'Trendyol': {
      'Referer': 'https://www.trendyol.com/',
      'Sec-Fetch-Site': 'same-origin'
    },
    'Amazon TR': {
      'Referer': 'https://www.amazon.com.tr/',
      'Host': 'www.amazon.com.tr'
    },
    'n11': {
      'Referer': 'https://www.n11.com/',
      'Host': 'www.n11.com'
    }
  };
  
  return { ...headers, ...(siteHeaders[siteName] || {}) };
}

// ========== SMART FETCH ==========
async function fetchWithSmartHeaders(url, siteName) {
  const headers = getHeadersForSite(siteName);
  
  try {
    console.log(`📡 ${siteName} için fetch deniyor...`);
    
    const response = await fetch(url, {
      headers,
      timeout: 20000,
      redirect: 'follow',
      follow: 5
    });
    
    console.log(`📊 Status: ${response.status} - ${response.statusText}`);
    
    if (response.ok) {
      return await response.text();
    }
    
    if (response.status === 403 || response.status === 429) {
      console.log(`⚠️ ${siteName} engelledi, alternatif deneniyor...`);
      
      const mobileHeaders = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9'
      };
      
      const retryResponse = await fetch(url, {
        headers: mobileHeaders,
        timeout: 15000
      });
      
      if (retryResponse.ok) {
        return await retryResponse.text();
      }
    }
    
    console.log(`❌ ${siteName}: HTTP ${response.status}`);
    return null;
    
  } catch (error) {
    console.error(`❌ ${siteName} fetch hatası:`, error.message);
    return null;
  }
}

// ========== HUGGING FACE AI YORUM SİSTEMİ ==========
async function generateAIYorum(productData) {
  try {
    const { title, price, site, originalQuery } = productData;
    
    if (!HUGGINGFACE_API_KEY) {
      return await generateLocalAIYorum(productData);
    }
    
    const prompt = `
    E-ticaret analiz uzmanı olarak Türkçe teknik analiz yap:
    
    Ürün: ${title || originalQuery || "Bilinmeyen ürün"}
    Fiyat: ${price || "Fiyat bilinmiyor"}
    Site: ${site || "Bilinmeyen site"}
    
    Detaylı analiz yap. Şunları içer:
    1. Fiyatın piyasa değeri (çok uygun/uygun/orta/pahalı/çok pahalı)
    2. Ürünün teknik özellikleri hakkında gerçekçi tahminler
    3. Hangi kullanıcı tipine uygun (öğrenci/profesyonel/oyuncu/günlük)
    4. Alternatif öneriler
    5. Satın alma tavsiyesi
    
    Marka ve modele özgü, kısa ve net olsun (max 250 kelime).
    `;
    
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${AI_MODEL}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.2,
          do_sample: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    let aiResponse = response.data[0]?.generated_text || "";
    
    if (aiResponse.includes(prompt)) {
      aiResponse = aiResponse.split(prompt)[1]?.trim() || aiResponse;
    }
    
    if (!aiResponse || aiResponse.length < 50) {
      aiResponse = await generateLocalAIYorum(productData);
    }
    
    return aiResponse;
    
  } catch (error) {
    console.error("🤖 Hugging Face AI Hatası:", error.message);
    return await generateLocalAIYorum(productData);
  }
}

// ========== LOCAL AI FALLBACK ==========
async function generateLocalAIYorum(productData) {
  const { title, price, site, originalQuery } = productData;
  const urunAdi = (title || originalQuery || "").toLowerCase();
  
  const fiyatSayi = (price || '').match(/([\d.,]+)/);
  const fiyat = fiyatSayi ? parseFloat(fiyatSayi[1].replace(/\./g, '').replace(',', '.')) : 0;
  
  let urunTuru = "genel";
  const turler = {
    'telefon': ['iphone', 'samsung', 'xiaomi', 'huawei', 'telefon', 'cep'],
    'tablet': ['ipad', 'tablet', 'pad', 'galaxy tab'],
    'laptop': ['laptop', 'notebook', 'macbook', 'asus'],
    'kulaklık': ['airpods', 'kulaklık', 'headphone'],
    'tv': ['tv', 'televizyon', 'smart tv']
  };
  
  for (const [tur, kelimeler] of Object.entries(turler)) {
    if (kelimeler.some(k => urunAdi.includes(k))) {
      urunTuru = tur;
      break;
    }
  }
  
  const analizler = [
    `🔍 **${urunAdi.toUpperCase()} ANALİZİ**
    
    📊 **Fiyat Değerlendirmesi:** ${price} fiyatı ile bu ürün ${fiyat < 1000 ? 'çok uygun' : fiyat < 5000 ? 'ekonomik' : fiyat < 15000 ? 'orta segment' : fiyat < 30000 ? 'premium' : 'lüks'} kategorisinde yer alıyor.
    
    ⚙️ **Teknik Tahminler:** ${urunTuru === 'telefon' ? 'Muhtemelen yüksek çözünürlüklü ekran, çoklu kamera sistemi ve hızlı işlemci sunuyor.' : urunTuru === 'laptop' ? 'SSD depolama, en az 8GB RAM ve modern işlemci beklenebilir.' : 'Kaliteli malzeme ve uzun ömürlü performans vaat ediyor.'}
    
    👥 **Kullanıcı Tipi:** ${fiyat < 3000 ? 'Öğrenciler ve bütçe dostu arayanlar' : fiyat < 10000 ? 'Orta gelir grubu ve günlük kullanıcılar' : 'Profesyoneller ve performans odaklı kullanıcılar'} için ideal.
    
    💡 **Öneriler:** ${site ? `${site}'deki` : 'Bu'} fiyatla ${urunAdi.includes('apple') || urunAdi.includes('iphone') ? 'Apple ekosistemine girmek isteyenler' : 'teknoloji meraklıları'} değerlendirebilir.`,
    
    `🤖 **${title || originalQuery} İÇİN AI RAPORU**
    
    💰 **Piyasa Pozisyonu:** ${price} fiyat etiketi, Türkiye pazarında ${urunTuru} segmentinde ${fiyat < 8000 ? 'rekabetçi bir konumda' : 'orta-üst seviyede'} bulunuyor.
    
    🎯 **Hedef Kitle:** ${urunAdi.includes('pro') || urunAdi.includes('max') ? 'Profesyonel kullanıcılar ve içerik üreticiler' : 'Günlük kullanıcılar ve teknoloji meraklıları'}
    
    ⚡ **Performans Beklentisi:** ${urunTuru === 'telefon' ? 'Günlük görevlerde akıcı, oyunlarda orta seviye performans' : urunTuru === 'laptop' ? 'Ofis uygulamalarında hızlı, multimedya için yeterli' : 'Kaliteli ses/görüntü deneyimi'}
    
    📈 **Yatırım Değeri:** ${fiyat > 20000 ? 'Uzun vadeli kullanım için iyi bir yatırım' : 'Kısa-orta vadeli kullanım için makul'}
    
    🏆 **Son Söz:** ${site || 'Bu mağaza'} üzerinden alım yapmayı düşünüyorsanız, ${fiyat > 15000 ? 'garanti ve servis olanaklarını' : 'müşteri yorumlarını ve iade politikasını'} mutlaka kontrol edin.`
  ];
  
  return analizler[Math.floor(Math.random() * analizler.length)];
}

// ========== FİYAT TEMİZLEME ==========
function cleanPrice(price) {
  if (!price) return 'Fiyat çekilemedi
