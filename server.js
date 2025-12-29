const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

// -------------------- Gemini --------------------
let gemini = null;
try {
  const key = process.env.GEMINI_API_KEY;
  if (key) gemini = new GoogleGenerativeAI(key);
} catch (e) {
  console.error('Gemini init error:', e);
  gemini = null;
}

// -------------------- Cache --------------------
const cache = {
  prices: new Map(), // key -> {time,data}
  durationMs: 3 * 60 * 1000
};

// -------------------- Helpers --------------------
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function normalizeText(s){
  return String(s || '')
    .toLowerCase()
    .replace(/&amp;/g,'&')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9ğüşıöç]/g,''); // keep tr chars in title; remove spaces/punct
}

function priceToNumber(p){
  const t = String(p || '');
  // pick first number-ish
  const cleaned = t.replace(/\./g,'').replace(',', '.').replace(/[^0-9.]/g,'');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

async function httpGet(url){
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
  };
  return axios.get(url, { headers, timeout: 20000, maxRedirects: 5, validateStatus: s => s>=200 && s<400 });
}

// -------------------- Scrapers --------------------
const SITES = [
  {
    key: 'trendyol',
    name: 'Trendyol',
    url: (q) => `https://www.trendyol.com/sr?q=${encodeURIComponent(q)}`,
    extract: ($) => {
      const out = [];
      // multiple selectors; Trendyol changes often
      const cards = $('div.p-card-wrppr, div.p-card-chldrn-cntnr');
      cards.each((_, el) => {
        if (out.length >= 8) return;
        const a = $(el).find('a').first();
        const href = a.attr('href') || '';
        const link = href.startsWith('http') ? href : ('https://www.trendyol.com' + href);
        const title = $(el).find('span.prdct-desc-cntnr-name, div.prdct-desc-cntnr-ttl, h3').first().text().trim() || a.text().trim();
        const price = $(el).find('div.prc-box-dscntd, div.prc-box-sllng, span.prc-box-dscntd, span.prc-box-sllng').first().text().trim();
        if (!link || !title) return;
        out.push({ site: 'Trendyol', urun: title, fiyat: price || 'Fiyat yok', link });
      });
      return out;
    }
  },
  {
    key: 'hepsiburada',
    name: 'Hepsiburada',
    url: (q) => `https://www.hepsiburada.com/ara?q=${encodeURIComponent(q)}`,
    extract: ($) => {
      const out = [];
      const cards = $('[data-testid="product-card"]');
      cards.each((_, el) => {
        if (out.length >= 8) return;
        const a = $(el).find('a').first();
        let href = a.attr('href') || '';
        if (!href) return;
        const link = href.startsWith('http') ? href : ('https://www.hepsiburada.com' + href);
        const title = $(el).find('[data-testid="product-card-name"], h3, h2').first().text().trim() || a.text().trim();
        const price = $(el).find('[data-testid="price-current-price"], [data-testid="price-value"], .price').first().text().trim();
        out.push({ site: 'Hepsiburada', urun: title || 'Ürün', fiyat: price || 'Fiyat yok', link });
      });

      // fallback selector
      if (out.length === 0){
        $('li[class*="productList"]').each((_, el) => {
          if (out.length >= 8) return;
          const a = $(el).find('a').first();
          const href = a.attr('href') || '';
          const link = href ? (href.startsWith('http') ? href : 'https://www.hepsiburada.com' + href) : '';
          const title = $(el).find('h3, h2').first().text().trim();
          const price = $(el).find('[class*="price"], .price').first().text().trim();
          if (link) out.push({ site:'Hepsiburada', urun: title || 'Ürün', fiyat: price || 'Fiyat yok', link });
        });
      }
      return out;
    }
  },
  {
    key: 'n11',
    name: 'n11',
    url: (q) => `https://www.n11.com/arama?q=${encodeURIComponent(q)}`,
    extract: ($) => {
      const out = [];
      const cards = $('li.column, div.productListItem, .listItem');
      cards.each((_, el) => {
        if (out.length >= 8) return;
        const a = $(el).find('a').first();
        const href = a.attr('href') || '';
        const link = href.startsWith('http') ? href : '';
        const title = $(el).find('h3.productName, h3, .productName').first().text().trim();
        const price = $(el).find('.newPrice, .price').first().text().trim();
        if (!link) return;
        out.push({ site: 'n11', urun: title || 'Ürün', fiyat: price || 'Fiyat yok', link });
      });
      return out;
    }
  },
  {
    key: 'amazontr',
    name: 'Amazon TR',
    url: (q) => `https://www.amazon.com.tr/s?k=${encodeURIComponent(q)}`,
    extract: ($) => {
      const out = [];
      $('div.s-result-item[data-component-type="s-search-result"]').each((_, el) => {
        if (out.length >= 8) return;
        const a = $(el).find('h2 a').first();
        const href = a.attr('href') || '';
        const link = href ? ('https://www.amazon.com.tr' + href) : '';
        const title = a.text().trim();
        const whole = $(el).find('span.a-price-whole').first().text().trim();
        const frac = $(el).find('span.a-price-fraction').first().text().trim();
        const price = whole ? `${whole},${frac || '00'} TL` : '';
        if (!link) return;
        out.push({ site: 'Amazon TR', urun: title || 'Ürün', fiyat: price || 'Fiyat yok', link });
      });
      return out;
    }
  }
];

async function scrapeAll(query){
  const results = [];
  for (const s of SITES){
    try{
      const url = s.url(query);
      const resp = await httpGet(url);
      const html = resp.data;
      const $ = cheerio.load(html);
      const items = s.extract($) || [];
      items.forEach(it => results.push(it));
    }catch(e){
      // ignore per-site errors
    }
    await sleep(120); // be gentle
  }
  return results;
}

function filterRelevantProducts(products, query){
  const qNorm = normalizeText(query);
  const tokens = String(query||'').toLowerCase().split(/\s+/).filter(Boolean);
  const tokenNorms = tokens
    .map(t=>normalizeText(t))
    .filter(t=>t.length>=2);

  if (products.length === 0) return [];
  if (tokenNorms.length === 0) return products;

  const scored = products.map(p=>{
    const tNorm = normalizeText(p.urun);
    let score = 0;
    for (const w of tokenNorms){
      if (!w) continue;
      if (tNorm.includes(w)) score += 10;
      if (tNorm.startsWith(w)) score += 4;
      // also allow match against compact full query
      if (w.length>=3 && qNorm && tNorm.includes(qNorm)) score += 8;
      // handle 8gb vs 8gb/8gb
      if (w.match(/^\d+(gb|tb|mb)$/) && tNorm.includes(w)) score += 12;
    }
    // mild penalty for missing price
    if (!p.fiyat || String(p.fiyat).toLowerCase().includes('fiyat yok')) score -= 5;
    return { ...p, relevanceScore: score };
  });

  const filtered = scored.filter(x=>x.relevanceScore > 0).sort((a,b)=>b.relevanceScore-a.relevanceScore);

  // fallback: if filter wipes everything, return unfiltered (so user still sees something)
  return filtered.length ? filtered : scored;
}

function paginateAndSort(products, page, sort){
  const withNum = products.map(p=>({ ...p, _num: priceToNumber(p.fiyat) }));
  withNum.sort((a,b)=>{
    const an = Number.isFinite(a._num) ? a._num : (sort==='asc'? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
    const bn = Number.isFinite(b._num) ? b._num : (sort==='asc'? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
    return sort==='asc' ? (an-bn) : (bn-an);
  });

  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(withNum.length / pageSize));
  const p = Math.min(Math.max(1, Number(page)||1), totalPages);
  const start = (p-1)*pageSize;
  const slice = withNum.slice(start, start+pageSize).map(({_num, ...rest})=>rest);
  return { slice, totalPages, page: p };
}

// -------------------- Routes --------------------
app.get('/', (req,res)=>{
  res.status(200).json({ ok:true, service:'fiyattakip-api', health:'/health', apiHealth:'/api/health' });
});

app.get('/health', (req,res)=>{
  res.json({ status:'online', time:new Date().toISOString(), ai: gemini ? 'aktif' : 'pasif' });
});
app.get('/api/health', (req,res)=>{
  res.json({ status:'online', time:new Date().toISOString(), ai: gemini ? 'aktif' : 'pasif' });
});

// fiyat-cek (both /api and root aliases)
async function fiyatCekHandler(req,res){
  try{
    const { urun, page = 1, sort = 'asc' } = req.body || {};
    if (!urun || String(urun).trim().length < 2){
      return res.status(400).json({ success:false, error:'En az 2 karakter girin', fiyatlar:[] });
    }
    const query = String(urun).trim();
    const cacheKey = `${query}::${page}::${sort}`;
    const cached = cache.prices.get(cacheKey);
    if (cached && Date.now()-cached.time < cache.durationMs) return res.json(cached.data);

    const raw = await scrapeAll(query);
    const relevant = filterRelevantProducts(raw, query);

    const { slice, totalPages, page: p } = paginateAndSort(relevant, page, sort);

    const response = {
      success: true,
      query,
      sayfa: p,
      toplamSayfa: totalPages,
      siralama: sort,
      toplamUrun: relevant.length,
      fiyatlar: slice
    };

    cache.prices.set(cacheKey, { time: Date.now(), data: response });
    res.json(response);
  }catch(e){
    console.error('fiyat-cek error:', e);
    res.status(500).json({ success:false, error:'Sunucu hatası', fiyatlar:[] });
  }
}
app.post('/api/fiyat-cek', fiyatCekHandler);
app.post('/fiyat-cek', fiyatCekHandler);

// AI yorum
async function aiYorumHandler(req,res){
  try{
    if (!gemini) return res.status(503).json({ error:'AI aktif değil (GEMINI_API_KEY yok)' });

    const { urun, fiyatlar } = req.body || {};
    const productName = String(urun || '').trim();
    if (!productName) return res.status(400).json({ error:'Ürün bilgisi gerekli' });

    const list = Array.isArray(fiyatlar) ? fiyatlar : [];
    const priceLines = list.slice(0, 12).map(x=>{
      const site = x.site || x.siteName || 'Site';
      const fiyat = x.fiyat || x.price || 'Fiyat yok';
      return `- ${site}: ${fiyat}`;
    }).join('\n');

    const prompt = [
      `Aşağıdaki ürün için KISA ve ÖZ bir “alınır mı / değer mi” yorumu yap.`,
      `Ürün: ${productName}`,
      priceLines ? `Fiyatlar:
${priceLines}` : `Fiyatlar: (veri yok)`,
      ``,
      `Kurallar:`,
      `- Türkçe yaz ve 3-4 cümleyi geçme.`,
      `- Fiyatlar varsa: en ucuz ve en pahalı farkını yorumla, “bu fiyattan alınır mı / beklenir mi” net söyle.`,
      `- Fiyat yoksa: ürünün genel olarak alınabilirliğini değerlendir (kimlere uygun, kimlere uygun değil) ve 1 cümleyle “değer / değmez” yönünde net görüş ver.`,
      `- Klişe cümleler kullanma (örn: “en uygun seçeneği tercih edin”, “fiyatlar karşılaştırıldı”).`,
      `- Satıcı/garanti/iade/kargo ve ürün varyantı (GB/RAM) gibi 1-2 kontrol noktası ekle.`
    ].join('\n');

    const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const text = (result && result.response && typeof result.response.text === 'function') ? result.response.text() : '';

    res.json({ yorum: text || 'AI yanıtı alınamadı.' });
  }catch(e){
    console.error('ai-yorum error:', e);
    res.status(500).json({ error:'AI hata' });
  }
}
app.post('/api/ai-yorum', aiYorumHandler);
app.post('/ai-yorum', aiYorumHandler);

// Kamera AI (şimdilik stub: frontend base64 yollasa bile basit cevap)
app.post('/api/kamera-ai', async (req,res)=>{
  // İstersen daha sonra Gemini Vision ekleriz.
  res.json({ success:false, error:'Kamera AI henüz aktif değil' });
});
app.post('/kamera-ai', async (req,res)=>{
  res.json({ success:false, error:'Kamera AI henüz aktif değil' });
});

// -------------------- Start --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>{
  console.log(`API running on ${PORT}`);
});
