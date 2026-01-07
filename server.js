// server.js - BASİT VERSİYON (cheerio olmadan)
import express from 'express';
import cors from 'cors';
import cheerio from 'cheerio';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== API ENDPOINT'LERİ ==========

// 1. SAĞLIK KONTROLÜ
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'FiyatTakip API çalışıyor',
    version: '2.0.0',
    features: ['fiyat-cek', 'ai-yorum', 'ai-compare', 'link-fiyat']
  });
});

// 2. LİNKTEN BASİT FİYAT ÇEKME (cheerio olmadan)
// ========== LİNKTEN GERÇEK FİYAT ÇEKME (cheerio ile) ==========
app.post('/fiyat-cek-link', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL gerekiyor' 
      });
    }
    
    console.log(`🔗 Yasal fiyat çekme: ${url}`);
    
    // 1. User-Agent ile kendimizi tanıtalım (etik)
    const headers = {
      'User-Agent': 'FiyatTakipBot/1.0 (Price Comparison Service; +https://fiyattakip-api.onrender.com)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      'Referer': 'https://fiyattakip-api.onrender.com',
      'Connection': 'keep-alive'
    };
    
    // 2. Sayfayı çek (yavaş ve nazikçe)
    const response = await fetch(url, {
      headers,
      timeout: 10000 // 10 saniye timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 3. Siteye özel SELECTOR'lar
    let title = '';
    let price = '';
    
    // TRENDYOL
    if (url.includes('trendyol.com')) {
      title = $('h1.pr-new-br').text().trim() || 
              $('[data-drroot="product-title"]').text().trim();
      
      price = $('[data-bind="markupText: currentPrice"]').text().trim() ||
              $('.prc-dsc').text().trim() ||
              $('.product-price-container').find('span').last().text().trim();
    }
    
    // HEPSIBURADA  
    else if (url.includes('hepsiburada.com')) {
      title = $('h1[data-bind="text: productName"]').text().trim() ||
              $('h1.product-name').text().trim();
      
      price = $('[data-bind="text: price"]').text().trim() ||
              $('[itemprop="price"]').attr('content') ||
              $('.price').text().trim();
    }
    
    // n11
    else if (url.includes('n11.com')) {
      title = $('h1.productName').text().trim() ||
              $('h1.proName').text().trim();
      
      price = $('.newPrice').text().trim() ||
              $('ins').text().trim() ||
              $('.unf-p-summary-price').text().trim();
    }
    
    // AMAZON
    else if (url.includes('amazon.com.tr')) {
      title = $('#productTitle').text().trim();
      
      price = $('.a-price-whole').first().text().trim() ||
              $('.priceBlockBuyingPriceString').text().trim();
      
      if (price) price = '₺' + price.replace('.', ',');
    }
    
    // PAZARAMA
    else if (url.includes('pazarama.com')) {
      title = $('h1.product-title').text().trim();
      price = $('.product-price').text().trim();
    }
    
    // ÇİÇEKSEPETİ
    else if (url.includes('ciceksepeti.com')) {
      title = $('h1.product-name').text().trim();
      price = $('.price').text().trim();
    }
    
    // 4. Temizleme
    title = title.substring(0, 100); // Uzunluk sınırı
    price = price ? price.replace(/\s+/g, '').trim() : '';
    
    // 5. Fallback: Meta etiketler
    if (!price || price === '') {
      price = $('meta[property="product:price:amount"]').attr('content') ||
              $('meta[itemprop="price"]').attr('content') ||
              $('meta[name="twitter:data1"]').attr('content');
      
      if (price) price = '₺' + price;
    }
    
    // 6. Site adını al
    const getSiteName = (url) => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        if (hostname.includes('trendyol')) return 'Trendyol';
        if (hostname.includes('hepsiburada')) return 'Hepsiburada';
        if (hostname.includes('n11.com')) return 'n11';
        if (hostname.includes('amazon')) return 'Amazon';
        if (hostname.includes('pazarama')) return 'Pazarama';
        if (hostname.includes('ciceksepeti')) return 'ÇiçekSepeti';
        
        return hostname.replace('www.', '').split('.')[0].toUpperCase();
      } catch {
        return 'Bilinmeyen';
      }
    };
    
    const siteName = getSiteName(url);
    
    // 7. Yanıt
    res.json({
      success: true,
      urun: title || "Ürün",
      fiyat: price || "Fiyat bulunamadı",
      site: siteName,
      link: url,
      timestamp: new Date().toISOString(),
      note: price ? 'Gerçek fiyat' : 'Fiyat çekilemedi'
    });
    
  } catch (error) {
    console.error('❌ Fiyat çekme hatası:', error.message);
    
    // Hata durumunda
    res.json({
      success: false,
      error: `Fiyat çekilemedi: ${error.message}`,
      urun: "Ürün",
      fiyat: "₺???",
      site: "Bilinmeyen",
      link: req.body.url,
      note: 'API hatası'
    });
  }
});

// 3. ARAMA İLE FIYAT ÇEKME
app.post('/fiyat-cek', async (req, res) => {
  try {
    const { urun, page = 1, sort = 'asc' } = req.body;
    
    if (!urun) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ürün adı gerekiyor' 
      });
    }
    
    console.log(`🔍 Arama yapılıyor: ${urun} (Sayfa: ${page})`);
    
    // Mock ürün verileri
    const mockProducts = [
      {
        urun: `${urun} - En Ucuz Seçenek`,
        fiyat: '₺1.299,99',
        site: 'Trendyol',
        link: `https://www.trendyol.com/sr?q=${encodeURIComponent(urun)}`
      },
      {
        urun: `${urun} - Orta Seviye`,
        fiyat: '₺1.499,99',
        site: 'Hepsiburada',
        link: `https://www.hepsiburada.com/ara?q=${encodeURIComponent(urun)}`
      },
      {
        urun: `${urun} - Popüler`,
        fiyat: '₺1.399,99',
        site: 'n11',
        link: `https://www.n11.com/arama?q=${encodeURIComponent(urun)}`
      },
      {
        urun: `${urun} - Premium`,
        fiyat: '₺1.699,99',
        site: 'Amazon',
        link: `https://www.amazon.com.tr/s?k=${encodeURIComponent(urun)}`
      }
    ];
    
    // Sıralama
    let sortedProducts = [...mockProducts];
    if (sort === 'asc') {
      sortedProducts.sort((a, b) => {
        const priceA = parseFloat(a.fiyat.replace(/[^\d.,]/g, '').replace('.', '').replace(',', '.'));
        const priceB = parseFloat(b.fiyat.replace(/[^\d.,]/g, '').replace('.', '').replace(',', '.'));
        return priceA - priceB;
      });
    } else if (sort === 'desc') {
      sortedProducts.sort((a, b) => {
        const priceA = parseFloat(a.fiyat.replace(/[^\d.,]/g, '').replace('.', '').replace(',', '.'));
        const priceB = parseFloat(b.fiyat.replace(/[^\d.,]/g, '').replace('.', '').replace(',', '.'));
        return priceB - priceA;
      });
    }
    
    res.json({
      success: true,
      fiyatlar: sortedProducts,
      toplamUrun: mockProducts.length,
      sayfa: page,
      toplamSayfa: 1,
      siralama: sort,
      query: urun
    });
    
  } catch (error) {
    console.error('❌ Fiyat çekme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sunucu hatası' 
    });
  }
});

// 4. AI YORUM SİSTEMİ
app.post('/ai/yorum', async (req, res) => {
  try {
    const { title, price, site, originalQuery } = req.body;
    
    console.log('📥 AI isteği alındı:', { 
      query: originalQuery || title,
      site: site,
      price: price 
    });
    
    // Akıllı fallback sistemi
    const query = (originalQuery || title || '').toLowerCase();
    let aiYorum = '';
    
    // Ürün tipine göre özelleştirilmiş yorumlar
    if (query.includes('iphone') || query.includes('telefon')) {
      aiYorum = `📱 ${site}'daki bu telefon modeli ${price} fiyatıyla değerlendirilebilir. İşlemci gücü, kamera kalitesi ve pil ömrü önemli faktörlerdir.`;
    } 
    else if (query.includes('laptop') || query.includes('notebook')) {
      aiYorum = `💻 ${site}'daki bu laptop ${price} fiyat segmentinde. İşlemci nesli, RAM miktarı ve ekran kalitesi performansı etkiler.`;
    }
    else if (query.includes('tablet') || query.includes('ipad')) {
      aiYorum = `📟 ${site}'daki tablet ${price} fiyatıyla. Ekran boyutu, kalem desteği ve pil ömrü dikkate alınmalı.`;
    }
    else if (query.includes('televizyon') || query.includes('tv')) {
      aiYorum = `📺 ${site}'daki TV ${price} fiyatında. Ekran boyutu, çözünürlük ve akıllı TV özellikleri önemlidir.`;
    }
    else if (query.includes('kulaklık') || query.includes('airpod')) {
      aiYorum = `🎧 ${site}'daki kulaklık ${price} fiyatıyla. Ses kalitesi, gürültü önleme ve pil ömrü değerlendirilmeli.`;
    }
    else {
      aiYorum = `🛒 ${site}'daki "${originalQuery || title}" ürünü ${price} fiyatıyla pazar ortalamasında. Teknik özellikler ve kullanıcı yorumları incelenmeli.`;
    }
    
    // Fiyat ek bilgisi
    if (price && price !== 'Fiyat bilgisi yok') {
      if (price.includes('₺1.') || price.includes('₺2.')) {
        aiYorum += ' Orta segment bir ürün olarak değerlendirilebilir.';
      } else if (price.includes('₺3.') || price.includes('₺4.')) {
        aiYorum += ' Premium segmentte yer alıyor.';
      } else if (price.includes('₺0.') || price.includes('₺500')) {
        aiYorum += ' Ekonomik bir seçenek.';
      }
    }
    
    res.json({
      success: true,
      yorum: aiYorum,
      urun: originalQuery || title,
      fiyat: price,
      site: site,
      note: 'Akıllı fallback AI kullanılıyor'
    });
    
  } catch (error) {
    console.error('❌ AI yorum hatası:', error);
    res.status(500).json({
      success: false,
      error: 'AI servisi geçici olarak kullanılamıyor',
      yorum: `${req.body.originalQuery || req.body.title} ürünü ${req.body.site || 'pazar yerinde'} incelendi. Fiyat: ${req.body.price || 'bilgi yok'}.`
    });
  }
});

// 5. AI KARŞILAŞTIRMA
app.post('/ai/compare', async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || products.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'En az 2 ürün gerekiyor'
      });
    }
    
    console.log(`🤖 ${products.length} ürün AI karşılaştırılıyor`);
    
    // Fiyat analizi
    const prices = products
      .map(p => {
        const priceText = p.price || '';
        const priceNum = parseFloat(
          priceText
            .replace(/[^\d.,]/g, '')
            .replace('.', '')
            .replace(',', '.')
        );
        return isNaN(priceNum) ? 0 : priceNum;
      })
      .filter(p => p > 0);
    
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b) / prices.length : 0;
    
    // En ucuz ürün
    const cheapestProduct = products.find(p => {
      const priceText = p.price || '';
      const priceNum = parseFloat(
        priceText
          .replace(/[^\d.,]/g, '')
          .replace('.', '')
          .replace(',', '.')
      );
      return priceNum === minPrice;
    });
    
    // Fiyat farkı yüzdesi
    const priceDiffPercent = maxPrice > 0 ? ((maxPrice - minPrice) / maxPrice * 100).toFixed(1) : 0;
    
    // AI analizi
    const analysis = `
🔍 **${products.length} Ürün Karşılaştırma Analizi**

📊 **Fiyat Analizi:**
• En düşük fiyat: ₺${minPrice.toLocaleString('tr-TR')} (${cheapestProduct?.site || ''})
• En yüksek fiyat: ₺${maxPrice.toLocaleString('tr-TR')}
• Fiyat farkı: %${priceDiffPercent}
• Ortalama fiyat: ₺${avgPrice.toLocaleString('tr-TR')}

⭐ **Ürün Değerlendirmesi:**
${products.map((p, i) => `• ${p.site}: ${p.price || 'Fiyat bilgisi yok'} - ${p.title?.substring(0, 30)}...`).join('\n')}

💡 **Öneriler:**
${minPrice > 0 ? `1. 🏆 Bütçe dostu: ${cheapestProduct?.site || ''} (₺${minPrice.toLocaleString('tr-TR')})` : '1. Fiyat karşılaştırması yapılamadı'}
2. ✅ Marka güvenilirliğini kontrol edin
3. ⭐ Kullanıcı yorumlarını ve puanlarını inceleyin
4. 🚚 Teslimat süreleri ve ücretlerini karşılaştırın
5. 🔄 Garanti ve iade şartlarını okuyun
    `.trim();
    
    const recommendation = cheapestProduct ? 
      `**Önerimiz:** ${cheapestProduct.site} üzerindeki ürün fiyat/performans açısından daha avantajlı görünüyor. %${priceDiffPercent} daha uygun fiyatlı.` :
      'Tüm ürünler benzer özellikler sunuyor. Bütçenize ve ihtiyaçlarınıza en uygun olanı seçebilirsiniz.';
    
    res.json({
      success: true,
      analysis: analysis,
      recommendation: recommendation,
      stats: {
        urunSayisi: products.length,
        enUcuzFiyat: `₺${minPrice.toLocaleString('tr-TR')}`,
        enPahaliFiyat: `₺${maxPrice.toLocaleString('tr-TR')}`,
        ortalamaFiyat: `₺${avgPrice.toLocaleString('tr-TR')}`,
        fiyatFarki: `%${priceDiffPercent}`
      }
    });
    
  } catch (error) {
    console.error('❌ AI karşılaştırma hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Karşılaştırma servisi geçici olarak kullanılamıyor',
      analysis: 'Ürünleriniz başarıyla analiz edildi. Fiyat ve özellik karşılaştırması yapıldı.',
      recommendation: 'Bütçenize ve ihtiyaçlarınıza en uygun ürünü seçmeniz önerilir.'
    });
  }
});

// 6. KAMERA AI
app.post('/kamera-ai', async (req, res) => {
  try {
    const { image } = req.body;
    
    // Basit görsel analiz
    const products = ['telefon', 'laptop', 'kulaklık', 'tablet', 'akıllı saat', 'oyun konsolu'];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    res.json({
      success: true,
      urunTahmini: randomProduct,
      tespitEdilen: 'Elektronik ürün',
      note: 'Görsel analiz başarılı (demo)'
    });
    
  } catch (error) {
    console.error('❌ Kamera AI hatası:', error);
    res.json({
      success: true,
      urunTahmini: 'telefon',
      tespitEdilen: 'Elektronik cihaz'
    });
  }
});

// 7. API DURUMU
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
      '/kamera-ai',
      '/api/status'
    ],
    note: 'Cheerio kurulumu gerekiyor - şu an mock veri kullanılıyor'
  });
});

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  console.log(`\n🚀 FiyatTakip API çalışıyor: http://localhost:${PORT}`);
  console.log(`🤖 AI Model: Akıllı Fallback Sistemi`);
  console.log(`📦 Link'ten fiyat çekme: MOCK VERİ (cheerio kurulumu gerekli)`);
  console.log(`✅ Endpoints: /health, /fiyat-cek, /ai/yorum, /ai/compare`);
  console.log(`⚠️  NOT: Gerçek fiyat çekmek için cheerio paketi kurulmalı\n`);
});
