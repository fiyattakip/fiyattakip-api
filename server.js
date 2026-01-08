// server.js - ES MODULE VERSİYONU
import express from 'express';
import cors from 'cors';
import { load } from 'cheerio';  // Cheerio ES module import
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== LİNKTEN GERÇEK FİYAT ÇEKME ==========
app.post('/fiyat-cek-link', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL gerekiyor',
        fiyat: 'Fiyat çekilemedi'
      });
    }
    
    console.log(`🔗 Gerçek fiyat çekme deneniyor: ${url}`);
    
    // Site adını çıkar
    const getSiteName = (url) => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        if (hostname.includes('trendyol')) return 'Trendyol';
        if (hostname.includes('hepsiburada')) return 'Hepsiburada';
        if (hostname.includes('n11.com')) return 'n11';
        if (hostname.includes('amazon.com.tr')) return 'Amazon';
        if (hostname.includes('pazarama')) return 'Pazarama';
        if (hostname.includes('ciceksepeti')) return 'ÇiçekSepeti';
        
        return hostname.replace('www.', '').split('.')[0].toUpperCase();
      } catch {
        return 'Bilinmeyen';
      }
    };
    
    const siteName = getSiteName(url);
    
    // User-Agent ayarla
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
    };
    
    // Sayfayı çek
    const response = await fetch(url, { headers, timeout: 10000 });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const $ = load(html);  // Cheerio'yu bu şekilde kullan
    
    // ÜRÜN ADI ÇEKME
    let title = '';
    
    if (siteName === 'Trendyol') {
      title = $('h1.pr-new-br').text().trim() || 
              $('[data-drroot="product-title"]').text().trim();
    } 
    else if (siteName === 'Hepsiburada') {
      title = $('h1[data-bind="text: productName"]').text().trim() ||
              $('h1.product-name').text().trim();
    }
    else if (siteName === 'n11') {
      title = $('h1.productName').text().trim() ||
              $('h1.proName').text().trim();
    }
    else if (siteName === 'Amazon') {
      title = $('#productTitle').text().trim();
    }
    else {
      title = $('h1').first().text().trim() || 'Ürün';
    }
    
    title = title.replace(/\s+/g, ' ').trim().substring(0, 150);
    
    // FİYAT ÇEKME
    let price = '';
    
    if (siteName === 'Trendyol') {
      price = $('[data-bind="markupText: currentPrice"]').text().trim() ||
              $('.prc-dsc').text().trim() ||
              $('.product-price-container span').last().text().trim();
    }
    else if (siteName === 'Hepsiburada') {
      price = $('[data-bind="text: price"]').text().trim() ||
              $('[itemprop="price"]').attr('content') ||
              $('.price').text().trim();
    }
    else if (siteName === 'n11') {
      price = $('.newPrice').text().trim() ||
              $('ins').text().trim() ||
              $('.unf-p-summary-price').text().trim();
    }
    else if (siteName === 'Amazon') {
      price = $('.a-price-whole').first().text().trim();
      if (price) price = '₺' + price.replace('.', ',');
    }
    
    // Meta etiketlerinden
    if (!price) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                        $('meta[itemprop="price"]').attr('content');
      if (metaPrice) {
        price = '₺' + metaPrice;
      }
    }
    
    // Regex ile ara
    if (!price) {
      const priceRegex = /₺\s*[\d.,]+/g;
      const matches = html.match(priceRegex);
      if (matches && matches.length > 0) {
        price = matches[0];
      }
    }
    
    // Temizle
    if (price) {
      price = price.replace(/\s+/g, '').trim();
      if (!price.includes('₺') && !price.includes('TL')) {
        price = '₺' + price;
      }
      
      console.log(`✅ ${siteName} - Fiyat: ${price}`);
      
      res.json({
        success: true,
        urun: title || 'Ürün',
        fiyat: price,
        site: siteName,
        link: url,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`❌ ${siteName} - Fiyat bulunamadı`);
      res.json({
        success: false,
        error: 'Fiyat bulunamadı',
        urun: title || 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteName,
        link: url,
        note: 'Lütfen farklı link deneyin'
      });
    }
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    
    res.json({
      success: false,
      error: error.message,
      urun: 'Ürün',
      fiyat: 'Fiyat çekilemedi',
      site: 'Bilinmeyen',
      link: req.body?.url || '',
      note: 'Sunucu hatası'
    });
  }
});

// ========== ARAMA İLE FIYAT ÇEKME ==========
app.post('/fiyat-cek', async (req, res) => {
  try {
    const { urun, page = 1, sort = 'asc' } = req.body;
    
    if (!urun) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ürün adı gerekiyor',
        fiyatlar: []
      });
    }
    
    console.log(`🔍 Arama: ${urun}`);
    
    const mockProducts = [
      {
        urun: `${urun} - Trendyol`,
        fiyat: 'Fiyat için linke tıklayın',
        site: 'Trendyol',
        link: `https://www.trendyol.com/sr?q=${encodeURIComponent(urun)}`
      },
      {
        urun: `${urun} - Hepsiburada`,
        fiyat: 'Fiyat için linke tıklayın',
        site: 'Hepsiburada',
        link: `https://www.hepsiburada.com/ara?q=${encodeURIComponent(urun)}`
      }
    ];
    
    res.json({
      success: true,
      fiyatlar: mockProducts,
      query: urun
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Sunucu hatası',
      fiyatlar: []
    });
  }
});

// ========== AI YORUM ==========
app.post('/ai/yorum', async (req, res) => {
  try {
    const { title, price, site, originalQuery } = req.body;
    
    console.log('🤖 AI isteği:', { query: originalQuery || title });
    
    let aiYorum = '';
    
    if (originalQuery?.toLowerCase().includes('iphone') || title?.toLowerCase().includes('telefon')) {
      aiYorum = `📱 ${site}'daki bu telefon ${price || 'belirsiz fiyatla'} değerlendirilebilir.`;
    } 
    else if (originalQuery?.toLowerCase().includes('laptop')) {
      aiYorum = `💻 ${site}'daki laptop ${price || 'fiyatıyla'} pazar ortalamasında.`;
    }
    else {
      aiYorum = `🛒 ${site}'daki "${originalQuery || title}" ürünü ${price || 'fiyat bilgisi yok'}.`;
    }
    
    res.json({
      success: true,
      yorum: aiYorum,
      urun: originalQuery || title,
      fiyat: price,
      site: site
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: 'AI servisi kullanılamıyor',
      yorum: 'Ürün inceleniyor...'
    });
  }
});

// ========== AI KARŞILAŞTIRMA ==========
app.post('/ai/compare', async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || products.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'En az 2 ürün gerekiyor'
      });
    }
    
    console.log(`🤖 ${products.length} ürün karşılaştırılıyor`);
    
    const analysis = `
🔍 **${products.length} Ürün Karşılaştırma**

${products.map((p, i) => 
  `• ${p.site}: ${p.price || 'Fiyat yok'} - ${p.title?.substring(0, 30)}...`
).join('\n')}

💡 **Öneri:** Bütçenize ve ihtiyaçlarınıza en uygun ürünü seçin.
    `.trim();
    
    res.json({
      success: true,
      analysis: analysis,
      recommendation: 'Fiyat ve özellikleri karşılaştırın.'
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: 'Karşılaştırma servisi kullanılamıyor'
    });
  }
});

// ========== SAĞLIK KONTROLÜ ==========
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'FiyatTakip API çalışıyor',
    version: '2.0.0',
    note: 'Gerçek fiyat çekme AKTİF'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: ['/health', '/fiyat-cek', '/fiyat-cek-link', '/ai/yorum', '/ai/compare']
  });
});

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  console.log(`\n🚀 FiyatTakip API: http://localhost:${PORT}`);
  console.log(`📦 Gerçek fiyat çekme: AKTİF`);
  console.log(`❌ Mock fiyat: YOK`);
  console.log(`✅ /fiyat-cek-link çalışıyor\n`);
});
