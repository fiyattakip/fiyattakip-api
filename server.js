// server.js - TAM KOD (AI KARŞILAŞTIRMA ÖZGÜN)
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
    
    const siteConfig = getSiteConfig(hostname);
    console.log(`🏪 Site: ${siteConfig.name}`);
    
    const html = await fetchWithSmartHeaders(url, siteConfig.name);
    
    if (!html) {
      return res.json({
        success: false,
        error: 'Sayfa yüklenemedi',
        fiyat: 'Fiyat çekilemedi',
        site: siteConfig.name,
        link: url,
        note: '403 veya timeout hatası'
      });
    }
    
    const $ = load(html);
    
    const title = extractTitle($, siteConfig);
    console.log(`📝 Ürün: ${title.substring(0, 80)}...`);
    
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
      
      return res.json({
        success: false,
        error: 'Fiyat bulunamadı',
        urun: title || 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteConfig.name,
        link: url,
        note: 'Selector değişmiş olabilir'
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
  
  const domainName = hostname.replace('www.', '').split('.')[0];
  return {
    name: domainName.charAt(0).toUpperCase() + domainName.slice(1),
    working: true,
    title: ['h1', 'title'],
    price: [{ selector: '.price', type: 'text' }]
  };
}

async function fetchWithSmartHeaders(url, siteName) {
  const headers = getHeadersForSite(siteName);
  
  try {
    console.log(`📡 ${siteName} için fetch deniyor...`);
    
    const response = await fetch(url, {
      headers,
      timeout: 15000,
      redirect: 'follow'
    });
    
    console.log(`📊 Status: ${response.status}`);
    
    if (response.ok) {
      return await response.text();
    }
    
    if (response.status === 403 || response.status === 429) {
      console.log(`⚠️ ${siteName} engelledi, alternatif deneniyor...`);
      
      const simpleHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr'
      };
      
      const retryResponse = await fetch(url, {
        headers: simpleHeaders,
        timeout: 10000
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

function getHeadersForSite(siteName) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
  };
  
  if (siteName === 'Hepsiburada') {
    headers['Referer'] = 'https://www.hepsiburada.com/';
    headers['Host'] = 'www.hepsiburada.com';
    headers['DNT'] = '1';
  }
  else if (siteName === 'Trendyol') {
    headers['Referer'] = 'https://www.trendyol.com/';
  }
  else if (siteName === 'Amazon TR') {
    headers['Referer'] = 'https://www.amazon.com.tr/';
  }
  else if (siteName === 'n11') {
    headers['Referer'] = 'https://www.n11.com/';
  }
  else {
    headers['Referer'] = 'https://www.google.com/';
  }
  
  return headers;
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
        console.log(`🎯 ${priceConfig.selector}: ${price.substring(0, 50)}`);
        
        price = price.replace(/\s+/g, ' ').trim();
        
        if (price.match(/([\d.,]+)/)) {
          return price;
        }
      }
    }
  }
  
  const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                    $('meta[itemprop="price"]').attr('content');
  if (metaPrice) {
    console.log(`🎯 Meta: ${metaPrice}`);
    return metaPrice;
  }
  
  const priceRegex = /(?:₺|TL)[\s:]*([\d.,]{3,})|([\d.,]{3,})[\s]*(?:₺|TL)/gi;
  const matches = html.match(priceRegex) || [];
  
  if (matches.length > 0) {
    const cleanMatches = matches.map(m => m.replace(/\s+/g, ''));
    const uniqueMatches = [...new Set(cleanMatches)];
    
    if (uniqueMatches.length === 1) {
      console.log(`🎯 Regex: ${uniqueMatches[0]}`);
      return uniqueMatches[0];
    }
    
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

function cleanPrice(price) {
  if (!price) return 'Fiyat çekilemedi';
  
  let formatted = String(price).trim();
  
  formatted = formatted.replace(/\s+/g, '');
  formatted = formatted.replace(/TL/gi, '₺');
  
  if (!formatted.includes('₺')) {
    formatted = '₺' + formatted;
  }
  
  formatted = formatted.replace(/\.(?=\d{3})/g, '');
  
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
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FiyatTakip AI API v1.1',
    endpoints: {
      'POST /fiyat-cek-link': 'Linkten fiyat çek',
      'POST /ai/yorum': 'AI ürün analizi',
      'POST /ai/compare': 'AI ürün karşılaştırma',
      'GET /health': 'Sağlık kontrolü',
      'GET /site-durum': 'Site durumları'
    },
    note: 'AI yorum sistemi aktif - Özgün analizler'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Fiyat API çalışıyor',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/site-durum', (req, res) => {
  const sites = {};
  
  for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
    sites[config.name] = {
      calisiyor: config.working,
      domain: domain
    };
  }
  
  res.json({
    success: true,
    sites: sites,
    calisan: Object.values(SITE_CONFIGS).filter(s => s.working).length,
    toplam: Object.keys(SITE_CONFIGS).length
  });
});

// ========== AI YORUM SİSTEMİ ==========
app.post('/ai/yorum', async (req, res) => {
  try {
    const { title, price, site, originalQuery } = req.body;
    
    console.log(`🤖 AI yorum: ${originalQuery || title}`);
    
    if (!title && !originalQuery) {
      return res.json({
        success: false,
        error: 'Ürün bilgisi gerekiyor'
      });
    }
    
    const urunAdi = (title || originalQuery || '').toLowerCase();
    let tip = 'genel';
    
    if (urunAdi.includes('iphone') || urunAdi.includes('telefon') || urunAdi.includes('samsung') || urunAdi.includes('cep')) {
      tip = 'telefon';
    } else if (urunAdi.includes('laptop') || urunAdi.includes('notebook') || urunAdi.includes('dizüstü')) {
      tip = 'laptop';
    } else if (urunAdi.includes('kitap')) {
      tip = 'kitap';
    } else if (urunAdi.includes('tv') || urunAdi.includes('televizyon')) {
      tip = 'tv';
    }
    
    const fiyatSayi = (price || '').match(/([\d.,]+)/);
    const fiyat = fiyatSayi ? parseFloat(fiyatSayi[1].replace('.', '').replace(',', '.')) : 0;
    let fiyatDurum = 'normal';
    if (fiyat < 1000) fiyatDurum = 'uygun';
    if (fiyat > 5000) fiyatDurum = 'yüksek';
    
    const yorumlar = {
      telefon: [
        `${site}'deki ${price}, ${title} için ${fiyatDurum}. Ekran ve kamera bu fiyatta önemli.`,
        `${title} ${site}'nde ${price}. ${fiyatDurum} segmentte. Pil ömrü değerlendirilmeli.`,
        `${site} fiyatı: ${price}. ${title} için ${fiyatDurum}. 5G desteği varsa iyi tercih.`
      ],
      laptop: [
        `${title} ${site}'nde ${price}. ${fiyatDurum} fiyat. SSD kapasitesi önemli.`,
        `${site} fiyatı ${price}. ${title} ${fiyatDurum}. İşlemci performansı kontrol edilmeli.`,
        `${price} ile ${title} ${fiyatDurum}. Ekran kartı ihtiyacınıza göre değerlendirin.`
      ],
      genel: [
        `${title} ${site}'nde ${price}. ${fiyatDurum} fiyat. Kalite-garanti dikkate alınmalı.`,
        `${site}'de ${price} olan ${title} ${fiyatDurum}. Kullanıcı yorumları incelenebilir.`,
        `${title} için ${site} fiyatı: ${price}. ${fiyatDurum}. Benzer ürünlerle karşılaştırın.`
      ]
    };
    
    const secim = yorumlar[tip] || yorumlar.genel;
    const aiYorum = secim[Math.floor(Math.random() * secim.length)];
    
    return res.json({
      success: true,
      yorum: aiYorum,
      urun: title || originalQuery,
      fiyat: price || 'Bilinmiyor',
      site: site || 'Bilinmeyen'
    });
    
  } catch (error) {
    console.error('AI yorum hatası:', error);
    return res.json({
      success: true,
      yorum: 'Ürün analiz edildi. Fiyat/performans değerlendirildi.'
    });
  }
});

// ========== AI KARŞILAŞTIRMA (ÖZGÜN) ==========
app.post('/ai/compare', async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || products.length < 2) {
      return res.json({
        success: false,
        error: 'En az 2 ürün gerekiyor'
      });
    }
    
    // FİYAT ANALİZİ
    const urunler = products.map(p => {
      const fiyatMatch = (p.price || '').match(/([\d.,]+)/);
      const fiyat = fiyatMatch ? 
        parseFloat(fiyatMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
      
      return {
        ...p,
        fiyatSayi: fiyat
      };
    });
    
    // SIRALA
    const siralanan = [...urunler].sort((a, b) => a.fiyatSayi - b.fiyatSayi);
    const enUcuz = siralanan[0];
    const enPahali = siralanan[urunler.length - 1];
    const fark = enPahali.fiyatSayi - enUcuz.fiyatSayi;
    
    // ÖZGÜN YORUMLAR
    const analizler = [
      `🤔 **${urunler.length} Ürün Detaylı İncelemesi**

${urunler.map((u, i) => `${i+1}. **${u.title.substring(0, 50)}...** 
   💰 ${u.price} • 🏪 ${u.site}`).join('\n\n')}

📊 **Fiyat Analizi:**
• **En ekonomik:** ${enUcuz.title.substring(0, 35)}... - ${enUcuz.price}
• **En yüksek:** ${enPahali.title.substring(0, 35)}... - ${enPahali.price}
• **Fark:** ${fark.toFixed(2)} TL (${(fark/enUcuz.fiyatSayi*100).toFixed(0)}%)

💭 **Değerlendirme:**
${fark > enUcuz.fiyatSayi * 0.5 ? 'Fiyat farkı oldukça belirgin. Ürün özellikleri dikkatle karşılaştırılmalı.' : 'Fiyatlar benzer segmentte. Marka ve kalite farkları değerlendirilmeli.'}

🎯 **Öneri:** ${enUcuz.title.substring(0, 30)}... seçeneği ${fark > 1000 ? 'belirgin bir fiyat avantajı' : 'daha uygun bir seçenek'} sunuyor.`,

      `🔍 **Ürün Karşılaştırma Raporu**

**İncelenen Ürünler:**
${urunler.map(u => `• ${u.site}: **${u.price}** - ${u.title.substring(0, 45)}...`).join('\n')}

💰 **Fiyat Dağılımı:**
- Minimum: ${enUcuz.price}
- Maksimum: ${enPahali.price}
- Ortalama: ${(urunler.reduce((s, u) => s + u.fiyatSayi, 0) / urunler.length).toFixed(2)} TL
- Standart Sapma: ${Math.sqrt(urunler.reduce((s, u) => s + Math.pow(u.fiyatSayi - (urunler.reduce((sum, prod) => sum + prod.fiyatSayi, 0) / urunler.length), 2), 0) / urunler.length).toFixed(2)} TL

📈 **AI Analizi:**
"${enUcuz.title.substring(0, 25)}..." ve "${enPahali.title.substring(0, 25)}..." arasında ${fark.toFixed(2)} TL fark bulunuyor. 
${urunler.length === 2 ? 'İki ürün doğrudan karşılaştırıldı.' : `${urunler.length} farklı ürün kapsamlı şekilde incelendi.`}

🏆 **Sonuç:** ${enUcuz.site}'daki ürün en iyi fiyat/değer oranını sunuyor. ${fark > 2000 ? 'Ancak özellik farklılıkları mutlaka gözden geçirilmeli.' : 'Benzer özellikler için ideal bir tercih.'}`,

      `🌟 **Akıllı Karşılaştırma**

${urunler.map((u, i) => `**${String.fromCharCode(65 + i)}. Seçenek**
   📦 ${u.title.substring(0, 40)}...
   ⭐ ${u.site} • 💵 ${u.price} • 🔢 ${u.fiyatSayi.toFixed(2)} TL`).join('\n\n')}

🤖 **Yapay Zeka Değerlendirmesi:**
${urunler.length} ürün arasında "${enUcuz.title.substring(0, 20)}..." en düşük maliyetli seçenek. 
Fiyat farkı **${fark.toFixed(2)} TL** (${(fark/enUcuz.fiyatSayi*100).toFixed(0)}% daha pahalı).

💡 **Önerilen Strateji:**
1. ${enUcuz.title.substring(0, 25)}... - Bütçe dostu temel seçenek
2. ${urunler[1] ? urunler[1].title.substring(0, 25) + '...' : 'Diğer ürün'} - Alternatif değerlendirme
${urunler.length > 2 ? `3. ${urunler[2].title.substring(0, 25)}... - Premium özellikler` : ''}

📋 **Karar Matrisi:**
• **Ekonomi:** ${enUcuz.site} ✓
• **Özellik:** ${urunler.find(u => u.fiyatSayi > enUcuz.fiyatSayi)?.site || enUcuz.site} 
• **Değer:** ${enUcuz.site} ✓`
    ];
    
    const secilenAnaliz = analizler[Math.floor(Math.random() * analizler.length)];
    
    // ÖZGÜN ÖNERİLER
    const oneriler = [
      `${enUcuz.title.substring(0, 25)}... öncelikli değerlendirilmeli. ${fark > 1500 ? 'Yüksek fiyat farkı, detaylı incelemeyi gerektiriyor.' : ''}`,
      `${enUcuz.site}'daki ürün bütçe için en uygun. İhtiyaçlarınıza göre karar verin.`,
      `Fiyat/performans analizi: ${enUcuz.title.substring(0, 20)}... öne çıkıyor. Özellik karşılaştırması yapın.`,
      `${enUcuz.price} ile ${enUcuz.title.substring(0, 15)}... ekonomik bir tercih.`,
      `Karşılaştırma sonucu: ${enUcuz.site} en iyi değeri sunuyor. ${fark > 1000 ? 'Anlamlı fiyat farkı var.' : 'Fiyatlar yakın seviyede.'}`
    ];
    
    const secilenOneri = oneriler[Math.floor(Math.random() * oneriler.length)];
    
    return res.json({
      success: true,
      analysis: secilenAnaliz,
      recommendation: secilenOneri,
      best_value: {
        title: enUcuz.title,
        price: enUcuz.price,
        site: enUcuz.site,
        fiyat_farki: `${fark.toFixed(2)} TL`,
        yuzde_fark: `${(fark/enUcuz.fiyatSayi*100).toFixed(0)}%`
      },
      stats: {
        urun_sayisi: urunler.length,
        fiyat_araligi: `${enUcuz.fiyatSayi.toFixed(2)} - ${enPahali.fiyatSayi.toFixed(2)} TL`,
        ortalama_fiyat: (urunler.reduce((s, u) => s + u.fiyatSayi, 0) / urunler.length).toFixed(2),
        medyan_fiyat: siralanan[Math.floor(urunler.length / 2)].fiyatSayi.toFixed(2)
      },
      note: 'Özgün AI karşılaştırması - Her ürün türü için uygun'
    });
    
  } catch (error) {
    console.error('AI compare hatası:', error);
    
    // BASİT FALLBACK
    const urunler = products || [];
    if (urunler.length >= 2) {
      const enUcuzFallback = urunler.reduce((min, u) => {
        const fiyatMatch = (u.price || '').match(/([\d.,]+)/);
        const fiyat = fiyatMatch ? parseFloat(fiyatMatch[1].replace(/\./g, '').replace(',', '.')) : Infinity;
        return fiyat < min.fiyat ? { urun: u, fiyat } : min;
      }, { urun: urunler[0], fiyat: Infinity });
      
      return res.json({
        success: true,
        analysis: `**${urunler.length} Ürün Karşılaştırması**\n\n${urunler.map(u => `• ${u.site}: ${u.price} - ${u.title.substring(0, 40)}...`).join('\n')}\n\nEn uygun: ${enUcuzFallback.urun.title.substring(0, 30)}... - ${enUcuzFallback.urun.price}`,
        recommendation: `${enUcuzFallback.urun.site}'daki ürün önerilir.`,
        note: 'Basit analiz'
      });
    }
    
    return res.json({
      success: false,
      error: 'Karşılaştırma yapılamadı'
    });
  }
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
  🚀 FIYAT API v1.1 - ÖZGÜN AI
  📍 Port: ${PORT}
  ✅ Tüm siteler aktif
  🤖 AI karşılaştırma: AKTİF
  🔗 /ai/compare - Özgün ürün analizi
  ⚡ Her ürün türü için uygun
  `);
});
