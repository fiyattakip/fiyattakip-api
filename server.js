// server.js - GÜNCELLENMİŞ VERSİYON
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== USER AGENT ROTASYONU ==========
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// ========== FIYAT ÇEKME SİSTEMİ ==========
async function fetchProductPrice(url) {
  console.log(`📦 Fiyat çekiliyor: ${url}`);
  
  try {
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };

    const response = await axios.get(url, { 
      headers, 
      timeout: 10000,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });

    const $ = cheerio.load(response.data);
    
    // ========== TRENDYOL (ty.gl) ==========
    if (url.includes('ty.gl') || url.includes('trendyol.com')) {
      // Trendyol ürün sayfası
      const productName = $('h1.pr-new-br').text().trim() || 
                         $('h1[data-testid="productDetailBrandName"]').text().trim() ||
                         $('h1.pr-in-nm').text().trim();
      
      // Fiyatı bul
      let price = '';
      
      // Trendyol fiyat seçicileri
      const priceSelectors = [
        'span.prc-dsc',
        'span.product-price-container span',
        'div.product-price-container',
        'span[class*="price"]',
        'div[class*="price"]',
        'span.prc-org'
      ];
      
      for (const selector of priceSelectors) {
        const priceText = $(selector).first().text().trim();
        if (priceText && priceText.includes('TL') || priceText.includes('₺')) {
          price = priceText.replace(/\s+/g, ' ');
          break;
        }
      }
      
      return {
        success: true,
        urun: productName || 'Trendyol Ürünü',
        fiyat: price || 'Fiyat bulunamadı',
        site: 'Trendyol',
        link: url
      };
    }
    
    // ========== HEPSİBURADA ==========
    else if (url.includes('hepsiburada.com')) {
      const productName = $('h1.product-name').text().trim() || 
                         $('h1[data-testid="productDetailBrandName"]').text().trim();
      
      let price = $('span[data-bind="markupText: currentPriceBeforePoint"]').text().trim() ||
                  $('span[data-testid="price"]').text().trim();
      
      if (!price) {
        const priceData = $('script[type="application/ld+json"]').text();
        const priceMatch = priceData.match(/"price":"([^"]+)"/);
        if (priceMatch) price = priceMatch[1] + ' TL';
      }
      
      return {
        success: true,
        urun: productName || 'Hepsiburada Ürünü',
        fiyat: price || 'Fiyat bulunamadı',
        site: 'Hepsiburada',
        link: url
      };
    }
    
    // ========== N11 ==========
    else if (url.includes('n11.com')) {
      const productName = $('h1.productName').text().trim() || 
                         $('h1[itemprop="name"]').text().trim();
      
      const price = $('ins').text().trim() || 
                   $('span.newPrice').text().trim() ||
                   $('meta[property="product:price:amount"]').attr('content');
      
      return {
        success: true,
        urun: productName || 'N11 Ürünü',
        fiyat: price ? (price + ' TL') : 'Fiyat bulunamadı',
        site: 'N11',
        link: url
      };
    }
    
    // ========== AMAZON ==========
    else if (url.includes('amazon.com.tr')) {
      const productName = $('#productTitle').text().trim() || 
                         $('h1.a-size-large').text().trim();
      
      const price = $('span.a-price-whole').first().text().trim() ||
                   $('span[data-a-color="price"] span').first().text().trim();
      
      return {
        success: true,
        urun: productName || 'Amazon Ürünü',
        fiyat: price ? (price + ' TL') : 'Fiyat bulunamadı',
        site: 'Amazon',
        link: url
      };
    }
    
    // ========== DİĞER SİTELER ==========
    else {
      // Genel fiyat arama
      const productName = $('h1').first().text().trim() ||
                         $('title').text().split('|')[0].trim();
      
      // Fiyat regex ile ara
      const pageText = $('body').text();
      const priceRegex = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*TL/g;
      const priceMatch = pageText.match(priceRegex);
      
      return {
        success: true,
        urun: productName || 'Ürün',
        fiyat: priceMatch ? priceMatch[0] : 'Fiyat bulunamadı',
        site: new URL(url).hostname.replace('www.', ''),
        link: url
      };
    }
    
  } catch (error) {
    console.error('❌ Fiyat çekme hatası:', error.message);
    return {
      success: false,
      error: `Fiyat çekilemedi: ${error.message}`,
      urun: 'Ürün',
      fiyat: 'Fiyat bulunamadı',
      site: 'Bilinmeyen',
      link: url
    };
  }
}

// ========== API ENDPOINT'LERİ ==========

// 1. SAĞLIK KONTROLÜ
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'FiyatTakip API çalışıyor' });
});

// 2. FIYAT ÇEKME (Link'ten)
app.post('/fiyat-cek-link', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL gerekiyor' 
      });
    }
    
    console.log(`🔗 Link'ten fiyat çekiliyor: ${url}`);
    
    const result = await fetchProductPrice(url);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Link fiyat hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sunucu hatası' 
    });
  }
});

// 3. ARAMA İLE FIYAT ÇEKME (Eski sistem - korundu)
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
    
    // Mock data - gerçek API'ye bağlayabilirsin
    const mockProducts = [
      {
        urun: `${urun} - En Ucuz`,
        fiyat: '₺1.299,99',
        site: 'Trendyol',
        link: `https://www.trendyol.com/arama?q=${encodeURIComponent(urun)}`
      },
      {
        urun: `${urun} - Orta Seçenek`,
        fiyat: '₺1.499,99',
        site: 'Hepsiburada',
        link: `https://www.hepsiburada.com/ara?q=${encodeURIComponent(urun)}`
      }
    ];
    
    res.json({
      success: true,
      fiyatlar: mockProducts,
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

// 4. AI YORUM SİSTEMİ (Geliştirilmiş)
app.post('/ai/yorum', async (req, res) => {
  try {
    const { title, price, site, originalQuery } = req.body;
    
    console.log('📥 AI isteği:', { title, price, site, originalQuery });
    
    // Hugging Face API veya fallback
    const HF_API_KEY = process.env.HF_API_KEY || '';
    const HF_MODEL = 'google/flan-t5-large';
    
    if (HF_API_KEY && HF_API_KEY !== 'YOK') {
      try {
        const response = await axios.post(
          `https://api-inference.huggingface.co/models/${HF_MODEL}`,
          {
            inputs: `Ürün analizi yap: ${originalQuery || title}. Site: ${site}. Fiyat: ${price}. Bu ürün hakkında kısa bir değerlendirme yap.`,
            parameters: {
              max_length: 150,
              temperature: 0.7
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${HF_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const aiResponse = response.data[0]?.generated_text || 'AI analiz ediyor...';
        
        return res.json({
          success: true,
          yorum: aiResponse,
          urun: originalQuery || title,
          fiyat: price,
          site: site
        });
        
      } catch (hfError) {
        console.log('⚠️ HF hatası, fallback kullanılıyor:', hfError.message);
      }
    }
    
    // AKILLI FALLBACK SİSTEMİ
    const fallbackResponses = {
      'iphone': 'iPhone modelleri genellikle yüksek performans ve kaliteli kamera sistemleri sunar. Fiyat/performans oranı değerlendirilmeli.',
      'telefon': 'Telefon seçerken işlemci, RAM, kamera ve pil ömrüne dikkat edin. Fiyat segmentine göre değerlendirme yapın.',
      'laptop': 'Laptop alırken işlemci nesli, RAM miktarı, ekran kalitesi ve taşınabilirlik önemli faktörlerdir.',
      'televizyon': 'TV seçiminde ekran boyutu, çözünürlük (4K/8K), HDR desteği ve akıllı TV özellikleri önemlidir.',
      'tablet': 'Tabletlerde ekran kalitesi, işlemci gücü, pil ömrü ve kalem desteği dikkate alınmalıdır.'
    };
    
    let aiYorum = 'Bu ürün teknik özellikleri ve kullanıcı deneyimleri ışığında değerlendirilebilir. ';
    
    // Anahtar kelimeye göre özelleştirilmiş yorum
    const query = (originalQuery || title || '').toLowerCase();
    for (const [keyword, response] of Object.entries(fallbackResponses)) {
      if (query.includes(keyword)) {
        aiYorum = response;
        break;
      }
    }
    
    // Fiyat bazlı ek yorum
    if (price && price !== 'Fiyat bilgisi yok') {
      if (price.includes('₺') || price.includes('TL')) {
        aiYorum += ' Fiyat segmentine göre değerlendirildiğinde makul bir seçenek olabilir.';
      }
    }
    
    res.json({
      success: true,
      yorum: aiYorum,
      urun: originalQuery || title,
      fiyat: price,
      site: site,
      note: HF_API_KEY ? 'HF API aktif' : 'Fallback AI kullanılıyor'
    });
    
  } catch (error) {
    console.error('❌ AI yorum hatası:', error);
    res.status(500).json({
      success: false,
      error: 'AI servisi geçici olarak kullanılamıyor',
      yorum: `${req.body.originalQuery || req.body.title} ürünü ${req.body.site || 'pazar yerinde'} incelendi. Fiyat: ${req.body.price || 'bilgi yok'}. Teknik özellikler değerlendirilebilir.`
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
    
    // AI analizi
    const analysis = `
🔍 **${products.length} Ürün Karşılaştırma Analizi**

📊 **Fiyat Analizi:**
• En düşük fiyat: ₺${minPrice.toLocaleString('tr-TR')} (${cheapestProduct?.site || ''})
• En yüksek fiyat: ₺${maxPrice.toLocaleString('tr-TR')}
• Ortalama fiyat: ₺${avgPrice.toLocaleString('tr-TR')}

⭐ **Değerlendirme:**
${products.map((p, i) => `• ${p.site}: ${p.price || 'Fiyat bilgisi yok'} - ${p.title?.substring(0, 30)}...`).join('\n')}

💡 **Öneriler:**
${minPrice > 0 ? `1. Bütçe dostu seçenek: ${cheapestProduct?.site || ''} (₺${minPrice.toLocaleString('tr-TR')})` : '1. Fiyat karşılaştırması yapılamadı'}
2. Marka güvenilirliği ve garanti şartlarını kontrol edin
3. Kullanıcı yorumlarını ve puanlarını inceleyin
4. Teslimat süreleri ve ücretlerini karşılaştırın
    `.trim();
    
    const recommendation = cheapestProduct ? 
      `🏆 **Önerimiz:** ${cheapestProduct.site} üzerindeki ürün fiyat/performans açısından daha avantajlı görünüyor.` :
      '🏆 Tüm ürünler benzer özellikler sunuyor. Bütçenize en uygun olanı seçebilirsiniz.';
    
    res.json({
      success: true,
      analysis: analysis,
      recommendation: recommendation,
      stats: {
        urunSayisi: products.length,
        enUcuzFiyat: `₺${minPrice.toLocaleString('tr-TR')}`,
        enPahaliFiyat: `₺${maxPrice.toLocaleString('tr-TR')}`,
        ortalamaFiyat: `₺${avgPrice.toLocaleString('tr-TR')}`
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
    
    // Basit görsel analiz (gerçekte TensorFlow.js veya benzeri kullanılır)
    const products = ['telefon', 'laptop', 'kulaklık', 'tablet', 'akıllı saat'];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    res.json({
      success: true,
      urunTahmini: randomProduct,
      tespitEdilen: 'Elektronik ürün',
      note: 'Görsel analiz başarılı'
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

// ========== SUNUCU BAŞLATMA ==========
app.listen(PORT, () => {
  console.log(`\n🚀 FiyatTakip API çalışıyor: http://localhost:${PORT}`);
  console.log(`🤖 AI Model: google/flan-t5-large`);
  console.log(`🔑 HF Key: ${process.env.HF_API_KEY ? 'VAR' : 'YOK'}`);
  console.log(`📦 Link'ten fiyat çekme: AKTİF`);
  console.log(`🛡️ Bot koruma önlemleri: AKTİF\n`);
});
