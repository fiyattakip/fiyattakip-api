// server.js - GERÇEK FİYAT ÇEKME (mock yok)
const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

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
        if (hostname.includes('teknosa')) return 'Teknosa';
        if (hostname.includes('mediamarkt')) return 'MediaMarkt';
        if (hostname.includes('vatan')) return 'Vatan';
        
        return hostname.replace('www.', '').split('.')[0].toUpperCase();
      } catch {
        return 'Bilinmeyen';
      }
    };
    
    const siteName = getSiteName(url);
    
    // 1. User-Agent ayarla
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // 2. Sayfayı çek (zaman aşımı ile)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    let response;
    try {
      response = await fetch(url, {
        headers,
        signal: controller.signal,
        redirect: 'follow',
        timeout: 15000
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('Fetch hatası:', fetchError.message);
      return res.json({
        success: false,
        error: 'Sayfa yüklenemedi',
        urun: 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteName,
        link: url
      });
    }
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`HTTP ${response.status}: ${response.statusText}`);
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
    const $ = cheerio.load(html);
    
    // 3. ÜRÜN ADI ÇEKME
    let title = '';
    
    // Siteye özel title selector'ları
    if (siteName === 'Trendyol') {
      title = $('h1.pr-new-br').text().trim() || 
              $('[data-drroot="product-title"]').text().trim() ||
              $('h1').first().text().trim();
    } 
    else if (siteName === 'Hepsiburada') {
      title = $('h1[data-bind="text: productName"]').text().trim() ||
              $('h1.product-name').text().trim() ||
              $('h1.title').text().trim();
    }
    else if (siteName === 'n11') {
      title = $('h1.productName').text().trim() ||
              $('h1.proName').text().trim() ||
              $('h1.name').text().trim();
    }
    else if (siteName === 'Amazon') {
      title = $('#productTitle').text().trim() ||
              $('h1#title').text().trim();
    }
    else {
      // Genel title çekme
      title = $('h1').first().text().trim() ||
              $('title').text().trim();
    }
    
    // Title temizleme
    title = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    title = title.substring(0, 150);
    
    // 4. FİYAT ÇEKME (TÜM YÖNTEMLERLE)
    let price = '';
    
    // Yöntem 1: Siteye özel selector'lar
    if (siteName === 'Trendyol') {
      price = $('[data-bind="markupText: currentPrice"]').text().trim() ||
              $('.prc-dsc').text().trim() ||
              $('.product-price-container span').last().text().trim() ||
              $('.price').text().trim();
    }
    else if (siteName === 'Hepsiburada') {
      price = $('[data-bind="text: price"]').text().trim() ||
              $('[itemprop="price"]').attr('content') ||
              $('.price').text().trim() ||
              $('.product-price').text().trim();
    }
    else if (siteName === 'n11') {
      price = $('.newPrice').text().trim() ||
              $('ins').text().trim() ||
              $('.unf-p-summary-price').text().trim() ||
              $('.price').text().trim();
    }
    else if (siteName === 'Amazon') {
      price = $('.a-price-whole').first().text().trim() ||
              $('.priceBlockBuyingPriceString').text().trim() ||
              $('.a-color-price').first().text().trim();
      if (price && !price.includes('₺') && !price.includes('TL')) {
        price = '₺' + price;
      }
    }
    
    // Yöntem 2: Meta etiketlerinden fiyat çek
    if (!price) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                        $('meta[itemprop="price"]').attr('content') ||
                        $('meta[name="twitter:data1"]').attr('content') ||
                        $('meta[property="og:price:amount"]').attr('content');
      
      if (metaPrice) {
        price = '₺' + parseFloat(metaPrice).toLocaleString('tr-TR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
    }
    
    // Yöntem 3: Regex ile sayfada fiyat ara
    if (!price) {
      const priceRegex = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:TL|₺|TRY)/gi;
      const matches = html.match(priceRegex);
      if (matches && matches.length > 0) {
        price = matches[0];
      }
    }
    
    // Yöntem 4: Sayfadaki tüm span'larda fiyat ara
    if (!price) {
      $('span').each((i, el) => {
        const text = $(el).text().trim();
        if (text.match(/₺\s*\d[\d.,]*/) || text.match(/\d[\d.,]*\s*(?:TL|₺|TRY)/)) {
          if (!price) price = text;
        }
      });
    }
    
    // 5. FİYAT TEMİZLEME ve FORMATLAMA
    if (price) {
      // Boşlukları temizle
      price = price.replace(/\s+/g, '').trim();
      
      // TL/₺ kontrolü
      if (!price.includes('₺') && !price.includes('TL')) {
        price = '₺' + price;
      }
      
      // Format kontrolü
      if (!price.includes(',') && price.match(/₺\d+$/)) {
        price = price + ',00';
      }
      
      console.log(`✅ ${siteName} - Fiyat bulundu: ${price}`);
    } else {
      console.log(`❌ ${siteName} - Fiyat bulunamadı`);
      return res.json({
        success: false,
        error: 'Fiyat bilgisi sayfada bulunamadı',
        urun: title || 'Ürün',
        fiyat: 'Fiyat çekilemedi',
        site: siteName,
        link: url,
        note: 'Lütfen farklı bir link deneyin'
      });
    }
    
    // 6. BAŞARILI YANIT
    res.json({
      success: true,
      urun: title || 'Ürün',
      fiyat: price,
      site: siteName,
      link: url,
      timestamp: new Date().toISOString(),
      note: 'Gerçek fiyat'
    });
    
  } catch (error) {
    console.error('❌ Beklenmeyen hata:', error.message);
    
    // HATA DURUMUNDA - KESİNLİKLE MOCK FİYAT YOK!
    res.json({
      success: false,
      error: `Sunucu hatası: ${error.message}`,
      urun: 'Ürün',
      fiyat: 'Fiyat çekilemedi',
      site: 'Bilinmeyen',
      link: req.body?.url || '',
      note: 'Tekrar deneyin veya farklı bir link kullanın'
    });
  }
});

// ========== ARAMA İLE FIYAT ÇEKME (mevcut) ==========
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
    
    console.log(`🔍 Arama yapılıyor: ${urun} (Sayfa: ${page})`);
    
    // MOCK ARAMA SONUÇLARI (bu kısmı koruyabilirsiniz)
    const mockProducts = [
      {
        urun: `${urun} - En Ucuz Seçenek`,
        fiyat: '₺???',
        site: 'Trendyol',
        link: `https://www.trendyol.com/sr?q=${encodeURIComponent(urun)}`,
        note: 'Fiyat için linke tıklayın'
      },
      {
        urun: `${urun} - Orta Seviye`,
        fiyat: '₺???',
        site: 'Hepsiburada',
        link: `https://www.hepsiburada.com/ara?q=${encodeURIComponent(urun)}`,
        note: 'Fiyat için linke tıklayın'
      }
    ];
    
    res.json({
      success: true,
      fiyatlar: mockProducts,
      toplamUrun: mockProducts.length,
      sayfa: page,
      toplamSayfa: 1,
      siralama: sort,
      query: urun,
      note: 'Fiyatları görmek için linklere tıklayın'
    });
    
  } catch (error) {
    console.error('❌ Fiyat çekme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sunucu hatası',
      fiyatlar: []
    });
  }
});

// Diğer endpoint'ler (ai/yorum, ai/compare, health, api/status) aynı kalacak...

// ========== AI YORUM SİSTEMİ ==========
app.post('/ai/yorum', async (req, res) => {
  // ... mevcut kodunuz
});

// ========== AI KARŞILAŞTIRMA ==========
app.post('/ai/compare', async (req, res) => {
  // ... mevcut kodunuz
});

// ========== API DURUMU ==========
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'FiyatTakip API çalışıyor',
    version: '2.0.0',
    features: ['fiyat-cek', 'fiyat-cek-link', 'ai-yorum', 'ai-compare'],
    note: 'Linkten gerçek fiyat çekme AKTİF'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/health',
      '/fiyat-cek',
      '/fiyat-cek-link', 
      '/ai/yorum',
      '/ai/compare',
      '/api/status'
    ],
    note: 'Gerçek fiyat çekme sistemi çalışıyor'
  });
});

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  console.log(`\n🚀 FiyatTakip API çalışıyor: http://localhost:${PORT}`);
  console.log(`📦 Link'ten GERÇEK fiyat çekme: AKTİF`);
  console.log(`❌ MOCK FİYAT YOK - Sadece gerçek fiyatlar`);
  console.log(`✅ Endpoints: /fiyat-cek-link, /fiyat-cek, /ai/yorum, /ai/compare`);
  console.log(`⚠️  NOT: Fiyat çekilemezse "Fiyat çekilemedi" yazar\n`);
});
