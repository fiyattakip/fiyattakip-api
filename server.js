/**
 * FiyatTakip API (Light Scraper)
 * - /api/health
 * - /api/search?q=iphone+13&limit=10
 *
 * NOTE:
 * Scraping e‑ticaret siteleri sık sık değişir ve bot korumaları nedeniyle bazı ağlarda çalışmayabilir.
 * Bu sunucu "en azından doğru link" üretmek için her siteden JSON‑LD (application/ld+json) okumayı dener.
 * Başarısız olursa: o site için "searchUrl" döner (anasayfaya değil, arama sayfasına götürür).
 */

import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

const UA =
  process.env.USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const http = axios.create({
  timeout: 20000,
  headers: {
    "user-agent": UA,
    "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
  maxRedirects: 5,
  validateStatus: (s) => s >= 200 && s < 400,
});

function cleanPrice(val) {
  if (val == null) return null;
  const s = String(val)
    .replace(/[^\d,\.]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // thousand dots
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Try to read ItemList from JSON-LD blocks.
 */
function parseJsonLdItemList(html, siteId) {
  const $ = cheerio.load(html);
  const blocks = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).text())
    .get()
    .filter(Boolean);

  const items = [];
  for (const raw of blocks) {
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      // some pages have multiple json objects in one block
      try {
        const fixed = raw.trim().replace(/}\s*{/g, "},{");
        json = JSON.parse(`[${fixed}]`);
      } catch {
        continue;
      }
    }

    const arr = Array.isArray(json) ? json : [json];

    for (const obj of arr) {
      if (!obj) continue;
      // Find an ItemList
      if (obj["@type"] === "ItemList" && Array.isArray(obj.itemListElement)) {
        for (const el of obj.itemListElement) {
          const it = el.item || el;
          if (!it) continue;

          const name = it.name || null;
          const url = it.url || it["@id"] || null;

          // Offer could be nested
          const offers = it.offers || (it.aggregateOffer ? it.aggregateOffer : null);
          const price =
            offers?.price ??
            offers?.lowPrice ??
            offers?.highPrice ??
            offers?.offers?.price ??
            null;

          const currency = offers?.priceCurrency || "TRY";

          items.push({
            site: siteId,
            title: name,
            price: cleanPrice(price),
            currency,
            link: url,
          });
        }
      }

      // Some sites put Product schema directly (not ItemList). We still accept.
      if (obj["@type"] === "Product" && (obj.name || obj.offers)) {
        const name = obj.name || null;
        const url = obj.url || obj["@id"] || null;
        const offers = obj.offers || null;
        const price = offers?.price ?? offers?.lowPrice ?? null;
        const currency = offers?.priceCurrency || "TRY";
        items.push({
          site: siteId,
          title: name,
          price: cleanPrice(price),
          currency,
          link: url,
        });
      }
    }
  }

  // Clean + dedupe
  const seen = new Set();
  const cleaned = [];
  for (const it of items) {
    if (!it.title || !it.link) continue;
    const key = `${it.site}|${it.link}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(it);
  }
  return cleaned;
}

/**
 * Provider config: add as many as you want.
 * If parsing fails, we still return searchUrl so frontend opens the correct search page.
 */
const SITES = [
  {
    id: "trendyol",
    name: "Trendyol",
    searchUrl: (q) => `https://www.trendyol.com/sr?q=${encodeURIComponent(q)}`,
  },
  {
    id: "hepsiburada",
    name: "Hepsiburada",
    searchUrl: (q) => `https://www.hepsiburada.com/ara?q=${encodeURIComponent(q)}`,
  },
  {
    id: "n11",
    name: "n11",
    searchUrl: (q) => `https://www.n11.com/arama?q=${encodeURIComponent(q)}`,
  },
  {
    id: "amazontr",
    name: "Amazon TR",
    searchUrl: (q) =>
      `https://www.amazon.com.tr/s?k=${encodeURIComponent(q)}&language=tr_TR`,
  },
  {
    id: "teknosa",
    name: "Teknosa",
    searchUrl: (q) => `https://www.teknosa.com/arama?text=${encodeURIComponent(q)}`,
  },
  {
    id: "vatan",
    name: "Vatan",
    searchUrl: (q) =>
      `https://www.vatanbilgisayar.com/arama/${encodeURIComponent(q)}/`,
  },
  {
    id: "mediamarkt",
    name: "MediaMarkt",
    searchUrl: (q) =>
      `https://www.mediamarkt.com.tr/tr/search.html?query=${encodeURIComponent(q)}`,
  },
  {
    id: "pttavm",
    name: "PttAVM",
    searchUrl: (q) => `https://www.pttavm.com/arama?q=${encodeURIComponent(q)}`,
  },
  {
    id: "ciceksepeti",
    name: "ÇiçekSepeti",
    searchUrl: (q) =>
      `https://www.ciceksepeti.com/arama?query=${encodeURIComponent(q)}`,
  },
];

async function fetchSiteOffers(site, q, limitPerSite) {
  const url = site.searchUrl(q);
  try {
    const res = await http.get(url);
    const html = res.data;
    const parsed = parseJsonLdItemList(html, site.id).slice(0, limitPerSite);

    // Ensure absolute link for relative urls
    const abs = parsed.map((it) => ({
      ...it,
      link: it.link?.startsWith("http") ? it.link : new URL(it.link, url).toString(),
      searchUrl: url,
      siteName: site.name,
    }));

    return abs;
  } catch (e) {
    return []; // fail silently; caller adds site searchUrl separately
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 30);
  if (!q) return res.status(400).json({ ok: false, error: "q is required" });

  const limitPerSite = Math.max(3, Math.ceil(limit / 3));

  const all = [];
  await Promise.all(
    SITES.map(async (site) => {
      const offers = await fetchSiteOffers(site, q, limitPerSite);
      all.push(...offers);
    })
  );

  // Sort by price if available
  all.sort((a, b) => {
    const pa = a.price ?? Number.POSITIVE_INFINITY;
    const pb = b.price ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });

  // take limit
  const results = all.slice(0, limit).map((x) => ({
    site: x.site,
    siteName: x.siteName,
    title: x.title,
    price: x.price,
    currency: x.currency,
    link: x.link,
    url: x.link,
    // For safety: if link becomes empty, frontend can open searchUrl
    searchUrl: x.searchUrl,
  }));

  // Always provide site search links so frontend can still work if scraping fails
  const siteLinks = SITES.map((s) => ({
    id: s.id,
    name: s.name,
    searchUrl: s.searchUrl(q),
  }));

  res.json({ ok: true, query: q, results, sites: siteLinks });
});

app.listen(PORT, () => {
  console.log(`FiyatTakip API running on :${PORT}`);
});
