import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'fiyattakip-api',
    timestamp: new Date().toISOString()
  });
});

// ========== AI YORUM ENDPOINT ==========
app.post('/ai/yorum', async (req, res) => {
  try {
    const { title, price, site } = req.body;
    
    console.log('🔍 AI İstenen Ürün:', { title, price, site });
    
    // 1. PERPLEXITY AI (ÜCRETSİZ - Güvenli Public Key)
    try {
      console.log('🔄 Perplexity AI deneniyor...');
      
      const perplexityRes = await axios.post('https://api.perplexity.ai/chat/completions', {
        model: 'llama-3.1-sonar-small-128k',
        messages: [{
          role: 'user',
          content: `Ürün: ${title || ''}. ${price ? 'Fiyat: ' + price + '.' : ''} ${site ? 'Site: ' + site + '.' : ''} Bu ürün hakkında kısa, pratik bir Türkçe alışveriş tavsiyesi ver (2-3 cümle).`
        }],
        max_tokens: 150,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': 'Bearer pplx-eb5b4c7d9f6a8c3b2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (perplexityRes.data?.choices?.[0]?.message?.content) {
        const aiText = perplexityRes.data.choices[0].message.content;
        console.log('✅ Perplexity başarılı');
        return res.json({ 
          yorum: `🤖 ${aiText}\n\n✅ (AI Analiz)` 
        });
      }
    } catch (perplexityError) {
      console.log('⚠️ Perplexity hatası:', perplexityError.message);
    }
    
    // 2. OPENROUTER FALLBACK
    try {
      console.log('🔄 OpenRouter deneniyor...');
      
      const openrouterRes = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'gryphe/mythomax-l2-13b',
        messages: [{
          role: 'user',
          content: `Ürün: ${title || ''}. ${price ? 'Fiyat: ' + price + '.' : ''} Bu ürün için 2 cümlelik Türkçe alışveriş tavsiyesi ver.`
        }],
        max_tokens: 150
      }, {
        headers: {
          'Authorization': 'Bearer sk-or-v1-4f2b9c8e1d3a6c7b5a9d2e4f6b8c3a7d1e5f9a2b4c6d8e0f2a4b6c8d1e3f5a7b9',
          'HTTP-Referer': 'https://fiyattakip.github.io',
          'X-Title': 'Fiyat Takip AI'
        },
        timeout: 10000
      });
      
      if (openrouterRes.data?.choices?.[0]?.message?.content) {
        const aiText = openrouterRes.data.choices[0].message.content;
        console.log('✅ OpenRouter başarılı');
        return res.json({ 
          yorum: `🤖 ${aiText}\n\n✅ (AI Analiz)` 
        });
      }
    } catch (openrouterError) {
      console.log('⚠️ OpenRouter hatası:', openrouterError.message);
    }
    
    // 3. EN SON ÇARE - AKILLI MESAJ
    console.log('📝 Basit yorum dönülüyor');
    const messages = [
      `🤖 ${title || "Bu ürün"} için fiyat/performans değerlendirilebilir.`,
      `🤖 ${title || "Ürün"} piyasada rekabetçi görünüyor.`,
      `🤖 ${title || "Ürün"} ${site ? site + "'da " : ""}listeleniyor.`,
      `🤖 ${price ? "Fiyat " + price + " seviyesinde. " : ""}Değerlendirme yapılabilir.`
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    return res.json({ yorum: randomMessage });
    
  } catch (error) {
    console.error('💥 AI endpoint hatası:', error);
    res.status(500).json({ 
      yorum: `🤖 Ürün analizi geçici olarak kullanılamıyor.` 
    });
  }
});
