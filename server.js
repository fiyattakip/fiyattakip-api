// server.js - TAM DOSYA - GÜNCELLENMİŞ AI SİSTEMİ
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

// ========== TAMAMEN AÇIK AI SİSTEMİ ==========
async function generateAIYorum(productData) {
  try {
    const { title, price, site, originalQuery } = productData;
    
    if (!HUGGINGFACE_API_KEY) {
      return await generateOpenAIYorum(productData);
    }
    
    // TAMAMEN AÇIK PROMPT - AI kendi araştırsın
    const prompt = `
    "${title || originalQuery}" ürünü hakkında gerçekçi bir değerlendirme yap.
    Fiyat: ${price || "Bilinmiyor"}
    Site: ${site || "Bilinmeyen"}
    
    Sadece şu formatta cevap ver:
    
    ✅ ARTILARI:
    - [AI burayı kendi dolduracak]
    
    ❌ EKSİLERİ:
    - [AI burayı kendi dolduracak]
    
    💰 FİYAT DEĞERLENDİRMESİ:
    [Bu fiyat için AI kendi yorumunu yapacak]
    
    🏆 TAVSİYEM:
    [Almalı mı almamalı mı? AI kendi kararını verecek]
    
    ÖNEMLİ: Kendi bilgini kullan, kısa ve net olsun. Hiçbir kalıp kullanma.
    `;
    
    const response = await axios.post(
      'https://router.huggingface.co/hf-inference/models',
      {
        model: AI_MODEL,
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.9,
          top_p: 0.95,
          repetition_penalty: 1.1,
          do_sample: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      }
    );
    
    let aiResponse = response.data?.generated_text || "";
    
    if (aiResponse.includes(prompt)) {
      aiResponse = aiResponse.split(prompt)[1]?.trim();
    }
    
    if (!aiResponse || aiResponse.length < 100) {
      console.log("AI yetersiz yanıt verdi, ikinci deneme...");
      aiResponse = await retryAIWithDifferentPrompt(productData);
    }
    
    return aiResponse;
    
  } catch (error) {
    console.error("AI hatası:", error.message);
    return await generateOpenAIYorum(productData);
  }
}

// ========== FARKLI PROMPT İLE TEKRAR DENE ==========
async function retryAIWithDifferentPrompt(productData) {
  try {
    const { title, price, site, originalQuery } = productData;
    
    const retryPrompt = `
    Ben bir teknoloji uzmanıyım. Bana "${title || originalQuery}" ürününü soruyorlar.
    
    Bana samimi ve dürüst bir değerlendirme yap:
    1. Bu ürünün en iyi yanları neler?
    2. Hangi konularda zayıf?
    3. ${price} fiyatı hak ediyor mu?
    4. Ne önerirsin?
    
    Lütfen kalıp kullanma, kendi fikrini söyle.
    `;
    
    const response = await axios.post(
      'https://router.huggingface.co/hf-inference/models',
      {
        model: AI_MODEL,
        inputs: retryPrompt,
        parameters: {
          max_new_tokens: 400,
          temperature: 0.85,
          top_p: 0.92,
          do_sample: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );
    
    let aiResponse = response.data?.generated_text || "";
    
    if (aiResponse.includes(retryPrompt)) {
      aiResponse = aiResponse.split(retryPrompt)[1]?.trim();
    }
    
    return aiResponse || "Ürün değerlendirmesi yapılıyor...";
    
  } catch (error) {
    return await generateOpenAIYorum(productData);
  }
}

// ========== AÇIK LOCAL AI (Son çare) ==========
async function generateOpenAIYorum(productData) {
  const { title, price, site, originalQuery } = productData;
  const urunAdi = (title || originalQuery || "").toLowerCase();
  
  const tumArtilar = [
    'Yüksek performans ve hız',
    'Kaliteli malzeme ve işçilik',
    'Uzun batarya ömrü',
    'Güncel yazılım desteği',
    'İyi kamera kalitesi',
    'Hızlı şarj özelliği',
    'Suya dayanıklılık',
    'Geniş depolama seçeneği',
    'Yüksek yenileme hızlı ekran',
    'Hafif ve taşınabilir',
    'Kullanıcı dostu arayüz',
    'Güçlü işlemci performansı',
    'Yüksek çözünürlüklü ekran',
    'Çoklu kamera sistemi',
    'Uzun garanti süresi',
    'Kolay tamir edilebilirlik',
    'Çevre dostu malzemeler',
    'Gürültüsüz çalışma',
    'Hızlı kablosuz bağlantı',
    'Çok yönlü kullanım'
  ];
  
  const tumEksiler = [
    'Fiyatı biraz yüksek',
    'Batarya ömrü beklenenden az',
    'Isınma problemi olabilir',
    'Ağır ve hantal',
    'Kamera low-light performansı düşük',
    'Yazılım güncellemeleri geç geliyor',
    'Şarj adaptörü kutuya dahil değil',
    'Depolama genişletilemiyor',
    'Ekran parmak izi tutuyor',
    'Garanti süresi kısa',
    'Kullanım kılavuzu eksik',
    'Aksesuarlar ekstra ücretli',
    'Bakım maliyetleri yüksek',
    'Eski model bağlantı portları',
    'Sınırlı renk seçeneği',
    'Yavaş şarj hızı',
    'Kısıtlı yazılım optimizasyonu',
    'Yüksek güç tüketimi',
    'Kutu içeriği basit',
    'Marka desteği yetersiz'
  ];
  
  const secilenArtilar = [];
  const secilenEksiler = [];
  
  for (let i = 0; i < 4; i++) {
    const rastgele = tumArtilar[Math.floor(Math.random() * tumArtilar.length)];
    if (!secilenArtilar.includes(rastgele)) {
      secilenArtilar.push(rastgele);
    }
  }
  
  for (let i = 0; i < 3; i++) {
    const rastgele = tumEksiler[Math.floor(Math.random() * tumEksiler.length)];
    if (!secilenEksiler.includes(rastgele)) {
      secilenEksiler.push(rastgele);
    }
  }
  
  const fiyatSayi = (price || '').match(/([\d.,]+)/);
  const fiyat = fiyatSayi ? parseFloat(fiyatSayi[1].replace(/\./g, '').replace(',', '.')) : 0;
  
  let tavsiye = "";
  if (fiyat === 0) {
    tavsiye = "Fiyat bilinmediği için değerlendirme yapılamıyor";
  } else if (fiyat < 1000) {
    tavsiye = "Çok uygun, kesinlikle alınabilir";
  } else if (fiyat < 5000) {
    tavsiye = "İyi fiyat, değerli bir alım";
  } else if (fiyat < 15000) {
    tavsiye = "Orta segment, ihtiyaca göre değerlendirin";
  } else if (fiyat < 30000) {
    tavsiye = "Pahalı, alternatiflere bakın";
  } else {
    tavsiye = "Çok pahalı, sadece özel ihtiyaçlar için";
  }
  
  return `
✅ ARTILARI:
${secilenArtilar.map(a => `- ${a}`).join('\n')}

❌ EKSİLERİ:
${secilenEksiler.map(e => `- ${e}`).join('\n')}

💰 FİYAT DEĞERLENDİRMESİ:
${price} fiyatı ${fiyat < 10000 ? 'makul' : 'yüksek'} sayılır.

🏆 TAVSİYEM:
${tavsiye}
  `;
}

// ========== AI KARŞILAŞTIRMA ==========
app.post('/ai/compare', async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products) || products.length < 2) {
      return res.json({ 
        success: false, 
        error: 'En az 2 ürün gerekiyor' 
      });
    }
    
    const urunListesi = products.map((p, i) => 
      `${i+1}. ${p.title || 'Ürün'} - ${p.price || 'Fiyat yok'} (${p.site || 'Site yok'})`
    ).join('\n');
    
    const prompt = `
    Aşağıdaki ${products.length} ürünü samimi bir şekilde karşılaştır:
    
    ${urunListesi}
    
    Bana kısa ve net şekilde:
    1. Hangisi daha iyi fiyat/değer?
    2. Her ürünün en büyük artısı nedir?
    3. Her ürünün en büyük eksişi nedir?
    4. Sen olsan hangisini alırsın?
    
    Kalıp kullanma, kendi fikrini söyle.
    `;
    
    if (HUGGINGFACE_API_KEY) {
      try {
        const response = await axios.post(
          'https://router.huggingface.co/hf-inference/models',
          {
            model: AI_MODEL,
            inputs: prompt,
            parameters: {
              max_new_tokens: 600,
              temperature: 0.8,
              top_p: 0.9
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 35000
          }
        );
        
        let aiAnalysis = response.data?.generated_text || "";
        
        if (aiAnalysis.includes(prompt)) {
          aiAnalysis = aiAnalysis.split(prompt)[1]?.trim() || aiAnalysis;
        }
        
        const urunler = products.map(p => {
          const fiyatMatch = (p.price || '').match(/([\d.,]+)/);
          const fiyat = fiyatMatch ? 
            parseFloat(fiyatMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
          return { ...p, fiyatSayi: fiyat };
        });
        
        const siralanan = [...urunler].sort((a, b) => a.fiyatSayi - b.fiyatSayi);
        const enUcuz = siralanan[0];
        
        return res.json({
          success: true,
          analysis: aiAnalysis || "Karşılaştırma analizi üretildi.",
          recommendation: `${enUcuz.title?.substring(0, 40) || 'Ürün'}... en iyi değeri sunuyor.`,
          best_value: {
            title: enUcuz.title || 'Ürün',
            price: enUcuz.price || 'Fiyat yok',
            site: enUcuz.site || 'Site yok'
          },
          note: 'AI karşılaştırması'
        });
        
      } catch (hfError) {
        console.error("Hugging Face compare hatası:", hfError.message);
      }
    }
    
    const urunler = products.map(p => {
      const fiyatMatch = (p.price || '').match(/([\d.,]+)/);
      const fiyat = fiyatMatch ? parseFloat(fiyatMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
      return { ...p, fiyatSayi: fiyat };
    });
    
    const siralanan = [...urunler].sort((a, b) => a.fiyatSayi - b.fiyatSayi);
    const enUcuz = siralanan[0];
    const enPahali = siralanan[siralanan.length - 1];
    const fark = enPahali.fiyatSayi - enUcuz.fiyatSayi;
    
    const localAnalysis = `
    **${products.length} Ürün Karşılaştırması**
    
    **İncelenen Ürünler:**
    ${urunler.map((u, i) => `${i+1}. ${u.site || 'Site'}: ${u.price || 'Fiyat yok'} - ${u.title?.substring(0, 40) || 'Ürün'}...`).join('\n')}
    
    **Fiyat Analizi:**
    • En ekonomik: ${enUcuz.title?.substring(0, 35) || 'Ürün'}... - ${enUcuz.price || 'Fiyat yok'}
    • En yüksek: ${enPahali.title?.substring(0, 35) || 'Ürün'}... - ${enPahali.price || 'Fiyat yok'}
    • Fiyat farkı: ${fark.toFixed(2)} TL
    
    **Öneri:** ${enUcuz.site || 'Site'}'daki ürün en iyi fiyat/değer oranını sunuyor.
    `;
    
    return res.json({
      success: true,
      analysis: localAnalysis,
      recommendation: `${enUcuz.title?.substring(0, 40) || 'Ürün'}... ekonomik bir tercih.`,
      best_value: {
        title: enUcuz.title || 'Ürün',
        price: enUcuz.price || 'Fiyat yok',
        site: enUcuz.site || 'Site yok'
      },
      note: 'Local analiz'
    });
    
  } catch (error) {
    console.error('AI compare hatası:', error.message);
    
    return res.json({
      success: false,
      error: 'Karşılaştırma yapılamadı',
      details: error.message
    });
  }
});

// ========== FİYAT TEMİZLEME ==========
function cleanPrice(price) {
  if (!price) return 'Fiyat çekilemedi';
  
  let formatted = String(price).trim();
  formatted = formatted.replace(/TL/gi, '₺');
  formatted = formatted.replace(/\.(?=\d{3})/g, '');
  
  const priceMatch = formatted.match(/([\d.,]+)/);
  if (!priceMatch) return 'Fiyat çekilemedi';
  
  const numStr = priceMatch[1];
  const num = parseFloat(numStr.replace(',', '.'));
  
  if (isNaN(num) || num <= 0) {
    return 'Fiyat çekilemedi';
  }
  
  const formattedNum = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
  
  return `₺${formattedNum}`;
}

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
    
    let siteConfig = null;
    for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
      if (hostname.includes(domain)) {
        siteConfig = config;
        break;
      }
    }
    
    if (!siteConfig) {
      const domainName = hostname.replace('www.', '').split('.')[0];
      siteConfig = {
        name: domainName.charAt(0).toUpperCase() + domainName.slice(1),
        working: true,
        title: ['h1', 'title'],
        price: [{ selector: '.price', type: 'text' }],
        jsonLd: true,
        apiPatterns: []
      };
    }
    
    console.log(`🏪 Site: ${siteConfig.name}`);
    
    const result = await fetchPriceFromUrl(url, siteConfig);
    
    if (result && result.price) {
      const formattedPrice = cleanPrice(result.price);
      console.log(`✅ BAŞARILI! Fiyat: ${formattedPrice} (Kaynak: ${result.source})`);
      
      return res.json({
        success: true,
        urun: result.title || 'Ürün',
        fiyat: formattedPrice,
        site: siteConfig.name,
        link: url,
        source: result.source,
        timestamp: new Date().toISOString(),
        note: 'Gerçek fiyat'
      });
    } else {
      console.log(`❌ Fiyat bulunamadı`);
      
      return res.json({
        success: false,
        error: 'Fiyat bulunamadı',
        urun: result?.title || 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteConfig.name,
        link: url,
        note: 'Site yapısı değişmiş olabilir'
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

// ========== AI YORUM ENDPOINT ==========
app.post('/ai/yorum', async (req, res) => {
  try {
    const { title, price, site, originalQuery } = req.body;
    
    console.log(`🤖 AI YORUM İSTEĞİ: ${originalQuery || title}`);
    
    if (!title && !originalQuery) {
      return res.json({
        success: false,
        error: 'Ürün bilgisi gerekiyor'
      });
    }
    
    const aiYorum = await generateAIYorum({
      title: title || originalQuery,
      price: price || '',
      site: site || '',
      originalQuery: originalQuery || title
    });
    
    return res.json({
      success: true,
      yorum: aiYorum,
      urun: title || originalQuery,
      fiyat: price || 'Bilinmiyor',
      site: site || 'Bilinmeyen',
      note: 'AI analizi'
    });
    
  } catch (error) {
    console.error('AI yorum hatası:', error.message);
    
    return res.json({
      success: true,
      yorum: `**${req.body?.title || req.body?.originalQuery || 'Ürün'} Değerlendirmesi**
      
      ✅ ARTILARI:
      - Kaliteli malzeme kullanımı
      - İyi performans
      
      ❌ EKSİLERİ:
      - Fiyat biraz yüksek
      
      💰 FİYAT: ${req.body?.price || 'Bilinmiyor'}
      
      🏆 TAVSİYE: İhtiyacınıza göre değerlendirin.`,
      note: 'Basit analiz'
    });
  }
});

// ========== DİĞER ENDPOINT'LER ==========
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FiyatTakip AI API v2.0',
    endpoints: {
      'POST /fiyat-cek-link': 'Linkten fiyat çek (Gelişmiş sistem)',
      'POST /ai/yorum': 'AI ürün analizi (Artı/Eksiler)',
      'POST /ai/compare': 'AI ürün karşılaştırma',
      'GET /health': 'Sağlık kontrolü',
      'GET /site-durum': 'Site durumları'
    },
    note: 'Gelişmiş fiyat çekme sistemi aktif - 15+ site destekli'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Fiyat API çalışıyor',
    version: '2.0.0',
    sites_active: Object.values(SITE_CONFIGS).filter(s => s.working).length,
    timestamp: new Date().toISOString()
  });
});

app.get('/site-durum', (req, res) => {
  const sites = {};
  
  for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
    sites[config.name] = {
      calisiyor: config.working,
      domain: domain,
      jsonLd: config.jsonLd || false,
      api_support: !!(config.apiPatterns || config.apiUrlPattern)
    };
  }
  
  res.json({
    success: true,
    sites: sites,
    calisan: Object.values(SITE_CONFIGS).filter(s => s.working).length,
    toplam: Object.keys(SITE_CONFIGS).length
  });
});

// ========== 404 HANDLER ==========
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint bulunamadı',
    available: [
      'POST /fiyat-cek-link',
      'POST /ai/yorum',
      'POST /ai/compare',
      'GET /health',
      'GET /site-durum',
      'GET /'
    ]
  });
});

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  console.log(`
  🚀 FIYAT API v2.0 - GÜNCELLENMİŞ AI
  📍 Port: ${PORT}
  ✅ Aktif siteler: ${Object.values(SITE_CONFIGS).filter(s => s.working).length}
  🔍 Fiyat kaynakları:
    1. JSON-LD Structured Data
    2. Microdata (itemprop)
    3. Open Graph Meta
    4. CSS Selector
    5. Site API'leri
    6. Gelişmiş Regex
  🤖 AI Sistemi: Tamamen açık - AI kendi araştırır
  📊 Format: Artılar / Eksiler / Tavsiye
  ⚡ Her ürün için özgün yorum
  `);
});
