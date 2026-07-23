const cheerio = require('cheerio');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Strip everything except digits, separators and minus sign.
  const cleaned = str.replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;

  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > -1 && lastComma > lastDot) {
    // Comma is the decimal separator (e.g. "1.299,90").
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > -1 && lastDot > lastComma) {
    // Dot is the decimal separator (e.g. "1,299.90").
    normalized = cleaned.replace(/,/g, '');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }

  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function findJsonLdOffer($) {
  let result = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (result) return;
    let json;
    try {
      json = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const candidates = Array.isArray(json) ? json : [json, ...(json['@graph'] || [])];
    for (const node of candidates) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      if (!isProduct) continue;

      let offers = node.offers;
      if (Array.isArray(offers)) offers = offers[0];

      const price = offers?.price ?? offers?.priceSpecification?.price;
      const currency = offers?.priceCurrency ?? offers?.priceSpecification?.priceCurrency;
      const image = Array.isArray(node.image) ? node.image[0] : node.image;

      if (price !== undefined || node.name || image) {
        result = {
          title: node.name || null,
          image: image || null,
          price: parsePrice(price),
          currency: currency || null,
        };
        break;
      }
    }
  });
  return result;
}

function meta($, ...selectors) {
  for (const sel of selectors) {
    const val = $(sel).attr('content');
    if (val) return val;
  }
  return null;
}

async function scrapeProduct(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let html;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  const $ = cheerio.load(html);
  const jsonLd = findJsonLdOffer($) || {};

  const title =
    jsonLd.title ||
    meta($, 'meta[property="og:title"]', 'meta[name="twitter:title"]') ||
    $('title').first().text().trim() ||
    null;

  const image =
    jsonLd.image ||
    meta($, 'meta[property="og:image"]', 'meta[name="twitter:image"]') ||
    null;

  let price = jsonLd.price;
  if (price === null || price === undefined) {
    const priceRaw = meta(
      $,
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      'meta[itemprop="price"]'
    );
    price = parsePrice(priceRaw ?? $('[itemprop="price"]').first().attr('content') ?? $('[itemprop="price"]').first().text());
  }

  let currency = jsonLd.currency;
  if (!currency) {
    currency = meta(
      $,
      'meta[property="product:price:currency"]',
      'meta[property="og:price:currency"]',
      'meta[itemprop="priceCurrency"]'
    );
  }

  return {
    title: title ? title.slice(0, 300) : null,
    image: image || null,
    price: price ?? null,
    currency: currency || null,
  };
}

module.exports = { scrapeProduct, parsePrice };
