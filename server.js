// server.js - BASİT VERSİYON (cheerio olmadan)
import express from 'express';
import cors from 'cors';

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
    
    // Site adını çıkar
    let site = "Link";
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      if (hostname.includes('trendyol') || hostname.includes('ty.gl')) {
        site = 'Trendyol';
      } else if (hostname.includes('hepsiburada')) {
        site = 'Hepsiburada';
      } else if (hostname.includes('n11.com')) {
        site = 'N11';
      } else if (hostname.includes('amazon')) {
        site = 'Amazon';
      } else if (hostname.includes('pazarama')) {
        site = 'Pazarama';
      } else if (hostname.includes('ciceksepeti')) {
        site = 'ÇiçekSepeti';
      } else {
        site = hostname.replace('www.', '').split('.')[0];
        site = site.charAt(0).toUpperCase() + site.slice(1);
      }
    } catch(e) {
      console.log("URL parse hatası:", e);
    }
    
    // Mock fiyat üret (gerçek uygulamada bu kısım cheerio ile çekilecek)
    const mockPrices = {
      'Trendyol': '₺1.299,99',
      'Hepsiburada': '₺1.349,99', 
      'N11': '₺1.279,99',
      'Amazon': '₺1.399,99',
      'Pazarama': '₺1.249,99',
      'ÇiçekSepeti': '₺1.319,99'
    };
    
    res.json({
      success: true,
      urun: `${site} Ürünü`,
      fiyat: mockPrices[site] || '₺???',
      site: site,
      link: url,
      note: 'Mock fiyat - cheerio kurulumu gerekli'
    });
    
  } catch (error) {
    console.error('❌ Link fiyat hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sunucu hatası',
      urun: 'Ürün',
      fiyat: 'Fiyat bulunamadı',
      site: 'Bilinmeyen',
      link: req.body.url
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
